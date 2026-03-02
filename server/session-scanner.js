const fs = require('fs');
const path = require('path');
const os = require('os');

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h — consider files modified within this window

// Read sessionId + cwd from the first line of a JSONL transcript file
function readSessionMeta(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const firstLine = buf.toString('utf8', 0, bytesRead).split('\n')[0];
    const d = JSON.parse(firstLine);
    if (d.sessionId && d.cwd) return { sessionId: d.sessionId, cwd: d.cwd };
  } catch {}
  return null;
}

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Register a discovered session and start transcript watching
function registerSession(filePath, { upsertSession, getSession, startWatching, io }) {
  const meta = readSessionMeta(filePath);
  if (!meta) return;
  const { sessionId, cwd } = meta;
  if (!isUUID(sessionId)) return;

  const existing = getSession.get(sessionId);
  if (!existing) {
    upsertSession.run({ id: sessionId, cwd, status: 'active', agent_type: 'main', parent_session_id: null });
    console.log(`[scanner] discovered session ${sessionId} cwd=${cwd}`);
    io.emit('session:new', getSession.get(sessionId));
  }

  startWatching(sessionId, filePath, io);
}

// Scan ~/.claude/projects/ for recently modified JSONL files
function scanExisting(deps) {
  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return;

  const now = Date.now();
  let projectDirs;
  try { projectDirs = fs.readdirSync(CLAUDE_PROJECTS_DIR); } catch { return; }

  for (const dir of projectDirs) {
    const dirPath = path.join(CLAUDE_PROJECTS_DIR, dir);
    let files;
    try {
      if (!fs.statSync(dirPath).isDirectory()) continue;
      files = fs.readdirSync(dirPath);
    } catch { continue; }

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const sessionId = file.slice(0, -6);
      if (!isUUID(sessionId)) continue;

      const filePath = path.join(dirPath, file);
      try {
        const mtime = fs.statSync(filePath).mtimeMs;
        if (now - mtime > ACTIVE_WINDOW_MS) continue;
      } catch { continue; }

      registerSession(filePath, deps);
    }
  }
}

// Watch for new JSONL files being created
function watchForNew(deps) {
  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return;

  // Watch each existing project dir for new files
  function watchDir(dirPath) {
    try {
      fs.watch(dirPath, (event, filename) => {
        if (!filename || !filename.endsWith('.jsonl')) return;
        const sessionId = filename.slice(0, -6);
        if (!isUUID(sessionId)) return;
        const filePath = path.join(dirPath, filename);
        // Small delay to let Claude write the first line
        setTimeout(() => {
          if (fs.existsSync(filePath)) registerSession(filePath, deps);
        }, 500);
      });
    } catch {}
  }

  // Watch the projects dir itself for new project subdirectories
  fs.watch(CLAUDE_PROJECTS_DIR, (event, dirname) => {
    if (!dirname) return;
    const dirPath = path.join(CLAUDE_PROJECTS_DIR, dirname);
    try {
      if (fs.statSync(dirPath).isDirectory()) watchDir(dirPath);
    } catch {}
  });

  // Watch all existing project dirs
  try {
    for (const dir of fs.readdirSync(CLAUDE_PROJECTS_DIR)) {
      const dirPath = path.join(CLAUDE_PROJECTS_DIR, dir);
      try {
        if (fs.statSync(dirPath).isDirectory()) watchDir(dirPath);
      } catch {}
    }
  } catch {}
}

function start(deps) {
  scanExisting(deps);
  watchForNew(deps);
  console.log(`[scanner] watching ${CLAUDE_PROJECTS_DIR}`);
}

module.exports = { start, scanExisting };
