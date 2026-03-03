import { io } from 'socket.io-client';

// In dev, Vite proxies /socket.io → :4321
// In production, we're served from :4321 directly
const URL = typeof window !== 'undefined'
  ? window.location.origin
  : 'http://localhost:4321';

const socket = io(URL, {
  transports: ['websocket'],   // skip polling — avoids Vite proxy errors
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

export default socket;
