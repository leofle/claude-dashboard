require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { getFullState } = require('./db');

const PORT = parseInt(process.env.PORT || '4321', 10);

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});

// Make io available to routes
app.set('io', io);

app.use(express.json({ limit: '10mb' }));

// Log every incoming request so we can see if hooks are firing
app.use((req, res, next) => {
  if (req.path.startsWith('/hooks') || req.path.startsWith('/api')) {
    console.log(`[req] ${req.method} ${req.path}`, JSON.stringify(req.body).slice(0, 200));
  }
  next();
});

// ─── Routes ────────────────────────────────────────────────────────────────

const hooksRouter = require('./routes/hooks');
const apiRouter = require('./routes/api');

app.use('/hooks', hooksRouter);
app.use('/api', apiRouter);

// ─── Serve built client in production ─────────────────────────────────────

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ─── WebSocket ─────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[ws] client connected: ${socket.id}`);

  // Send full state on connect so the UI can hydrate immediately
  try {
    const state = getFullState();
    socket.emit('initial:state', state);
  } catch (err) {
    console.error('[ws] failed to send initial state:', err);
  }

  socket.on('disconnect', () => {
    console.log(`[ws] client disconnected: ${socket.id}`);
  });
});

// ─── Start ─────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`Claude Dashboard server running on http://localhost:${PORT}`);
});

module.exports = { app, io };
