const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const KEYS_FILE = path.join(__dirname, '.vapid-keys.json');

let vapidKeys;
if (fs.existsSync(KEYS_FILE)) {
  vapidKeys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(vapidKeys, null, 2));
  console.log('[push] Generated new VAPID keys');
}

webpush.setVapidDetails(
  'mailto:dashboard@localhost',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

async function sendToAll(getAllSubscriptions, removeSubscription, payload) {
  const subs = getAllSubscriptions();
  if (!subs.length) return;
  await Promise.allSettled(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(JSON.parse(sub.subscription), JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        removeSubscription(sub.endpoint);
        console.log('[push] removed expired subscription');
      } else {
        console.error(`[push] send failed (${err.statusCode}): ${err.message}`);
      }
    }
  }));
}

// Fire-and-forget helper for use in route handlers
function push(getAllSubs, deleteSub, payload) {
  sendToAll(getAllSubs, deleteSub, payload)
    .catch(err => console.error('[push] error:', err));
}

module.exports = { vapidPublicKey: vapidKeys.publicKey, push };
