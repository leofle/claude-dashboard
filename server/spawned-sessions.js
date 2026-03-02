// Shared state for dashboard-spawned Claude sessions
// pendingSpawns: cwd → pid (before session-start hook fires)
// spawnedChildren: pid → child process reference
const pendingSpawns = new Map();
const spawnedChildren = new Map();

module.exports = { pendingSpawns, spawnedChildren };
