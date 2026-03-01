#!/usr/bin/env node
/**
 * Claude Dashboard — MCP Bridge
 *
 * This script runs as a stdio MCP server that Claude Code spawns per session.
 * It forwards tool calls to the dashboard Express server and returns results.
 *
 * Tools exposed:
 *   - request_user_input(message): pauses Claude, shows question in dashboard, returns user response
 *   - update_status(status): updates the current activity display in the dashboard
 *
 * Usage (Claude Code sets this up automatically via settings.json):
 *   node /path/to/scripts/mcp-bridge.js
 */

const http = require('http');
const https = require('https');
const readline = require('readline');

const SERVER_URL = process.env.CLAUDE_DASHBOARD_URL || 'http://localhost:4321';
const SESSION_ID = process.env.CLAUDE_SESSION_ID || 'unknown';

// ─── JSON-RPC helpers ───────────────────────────────────────────────────────

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function sendResult(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

// ─── HTTP helper (no external deps) ────────────────────────────────────────

function postJson(path, body, timeoutMs = 320000) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER_URL);
    const data = JSON.stringify(body);
    const lib = url.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({ result: body });
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.write(data);
    req.end();
  });
}

// ─── Tool definitions ───────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'request_user_input',
    description:
      'Pause execution and ask the user a question via the Claude Dashboard browser UI. ' +
      'Returns the user\'s typed response as a string. ' +
      'Use this when you need clarification, a decision, or user-provided information.',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The question or prompt to display to the user in the dashboard.',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'update_status',
    description:
      'Update the current activity status displayed in the Claude Dashboard. ' +
      'Use this to give the user visibility into what you are doing. ' +
      'This is informational only — it does not block execution.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Short description of the current activity (e.g. "Analyzing codebase", "Writing tests").',
        },
      },
      required: ['status'],
    },
  },
];

// ─── MCP message handler ────────────────────────────────────────────────────

async function handleMessage(msg) {
  const { id, method, params } = msg;

  switch (method) {
    // Initialization handshake
    case 'initialize':
      sendResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'claude-dashboard', version: '1.0.0' },
      });
      break;

    case 'notifications/initialized':
      // No response needed for notifications
      break;

    case 'tools/list':
      sendResult(id, { tools: TOOLS });
      break;

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      if (!TOOLS.find(t => t.name === toolName)) {
        sendError(id, -32601, `Unknown tool: ${toolName}`);
        break;
      }

      try {
        const response = await postJson('/api/mcp/tool', {
          tool: toolName,
          args: toolArgs,
          session_id: SESSION_ID,
        });

        if (response.error && response.error !== 'timed_out') {
          sendError(id, -32603, response.error);
        } else {
          sendResult(id, {
            content: [
              {
                type: 'text',
                text: response.result !== undefined ? String(response.result) : '',
              },
            ],
          });
        }
      } catch (err) {
        // If we can't reach the server, return a graceful error
        sendResult(id, {
          content: [
            {
              type: 'text',
              text: `[Dashboard unavailable: ${err.message}]`,
            },
          ],
          isError: true,
        });
      }
      break;
    }

    case 'ping':
      sendResult(id, {});
      break;

    default:
      if (id !== undefined) {
        sendError(id, -32601, `Method not found: ${method}`);
      }
  }
}

// ─── stdio line reader ──────────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: null,
  terminal: false,
});

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed);
    handleMessage(msg).catch(err => {
      process.stderr.write(`[mcp-bridge] error handling message: ${err.message}\n`);
    });
  } catch (err) {
    process.stderr.write(`[mcp-bridge] failed to parse message: ${line}\n`);
  }
});

rl.on('close', () => {
  process.exit(0);
});

process.stderr.write(`[mcp-bridge] started (session: ${SESSION_ID}, server: ${SERVER_URL})\n`);
