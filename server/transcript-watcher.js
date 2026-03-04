const fs = require('fs');
const { insertTranscriptEntry } = require('./db');

const watchers = new Map(); // sessionId -> { position, watcher }

function parseLine(line) {
  try { return JSON.parse(line); } catch { return null; }
}

// Extract a displayable entry from a raw transcript line.
// Returns null for entries we don't want to show (tool results, progress, etc.)
function extractEntry(d) {
  if (!d || !d.message) return null;
  const { type, message, timestamp, uuid, sessionId } = d;
  if (!uuid || !sessionId) return null;

  const rawContent = message.content;
  const content = Array.isArray(rawContent)
    ? rawContent
    : (typeof rawContent === 'string' && rawContent ? [{ type: 'text', text: rawContent }] : []);

  if (type === 'assistant') {
    const textBlocks = content.filter(b => b.type === 'text' && b.text?.trim());
    const toolUses = content.filter(b => b.type === 'tool_use');
    if (textBlocks.length === 0 && toolUses.length === 0) return null;

    return {
      id: uuid,
      session_id: sessionId,
      role: 'assistant',
      text: textBlocks.map(b => b.text).join('') || null,
      tool_uses: toolUses.length > 0
        ? toolUses.map(b => ({ name: b.name, input: b.input }))
        : null,
      timestamp: timestamp || new Date().toISOString(),
    };
  }

  if (type === 'user') {
    const textBlocks = content.filter(b => b.type === 'text' && b.text?.trim());
    if (textBlocks.length === 0) return null;
    const text = textBlocks.map(b => b.text).join('');
    // Skip internal Claude Code status messages
    if (text.startsWith('[Request interrupted') || text.startsWith('[Tool result')) return null;

    return {
      id: uuid,
      session_id: sessionId,
      role: 'user',
      text,
      tool_uses: null,
      timestamp: timestamp || new Date().toISOString(),
    };
  }

  return null;
}

function doWatch(sessionId, transcriptPath, io) {
  const state = { position: 0, watcher: null, pollInterval: null };

  function readNewLines() {
    try {
      const stat = fs.statSync(transcriptPath);
      if (stat.size <= state.position) return;

      const fd = fs.openSync(transcriptPath, 'r');
      const buf = Buffer.alloc(stat.size - state.position);
      fs.readSync(fd, buf, 0, buf.length, state.position);
      fs.closeSync(fd);
      state.position = stat.size;

      const lines = buf.toString('utf8').split('\n').filter(l => l.trim());
      for (const line of lines) {
        const entry = extractEntry(parseLine(line));
        if (!entry) continue;

        insertTranscriptEntry.run({
          id: entry.id,
          session_id: entry.session_id,
          role: entry.role,
          text: entry.text,
          tool_uses: entry.tool_uses ? JSON.stringify(entry.tool_uses) : null,
          timestamp: entry.timestamp,
        });

        io.emit('transcript:entry', entry);
      }
    } catch {
      // File might be locked or not exist yet
    }
  }

  // Read any content already in the file
  readNewLines();

  // Poll every 2s as a fallback — fs.watch can miss events on macOS
  // (e.g. atomic writes that use rename, or coalesced FSEvents)
  state.pollInterval = setInterval(readNewLines, 2000);

  try {
    // Handle both 'change' and 'rename' — some apps use atomic rename writes
    state.watcher = fs.watch(transcriptPath, () => readNewLines());
    state.watcher.on('error', () => {});
  } catch {
    // Ignore watch errors — polling will still work
  }

  watchers.set(sessionId, state);
}

function startWatching(sessionId, transcriptPath, io) {
  if (watchers.has(sessionId) || !transcriptPath) return;

  // The transcript file may not exist yet at session-start; retry briefly
  let attempts = 0;
  function tryStart() {
    if (fs.existsSync(transcriptPath)) {
      doWatch(sessionId, transcriptPath, io);
    } else if (attempts < 20) {
      attempts++;
      setTimeout(tryStart, 500);
    }
  }
  tryStart();
}

function stopWatching(sessionId) {
  const state = watchers.get(sessionId);
  if (state?.watcher) {
    try { state.watcher.close(); } catch {}
  }
  if (state?.pollInterval) clearInterval(state.pollInterval);
  watchers.delete(sessionId);
}

module.exports = { startWatching, stopWatching };
