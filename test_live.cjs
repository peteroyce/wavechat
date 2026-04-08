'use strict';
/**
 * Deep live test for wavechat — run from D:/Projects/wavechat
 * node test_live.cjs
 */
const { io } = require('socket.io-client');

const BASE = 'http://localhost:4000';

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function http(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text }; }
}

// ── Socket helper ─────────────────────────────────────────────────────────────
function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { auth: { token }, transports: ['websocket'], timeout: 5000 });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function waitFor(socket, event, ms = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for '${event}'`)), ms);
    socket.once(event, (d) => { clearTimeout(t); resolve(d); });
  });
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  OK   ${name}`); passed++; }
  else     { console.log(`  FAIL ${name}${detail ? ' → ' + detail : ''}`); failed++; }
}

async function run() {
  const id = Date.now();
  const ALICE = `alice_${id}`;
  const BOB   = `bob_${id}`;
  const ALICE_EMAIL = `alice_${id}@test.com`;
  const BOB_EMAIL   = `bob_${id}@test.com`;

  console.log('\n── Auth (HTTP) ──────────────────────────────────────────────');

  let r = await http('POST', '/api/auth/register', { username: ALICE, email: ALICE_EMAIL, password: 'Alice1234' });
  check('Register alice', r.status === 201, JSON.stringify(r.body).slice(0,80));
  const aliceToken = r.body.token;

  r = await http('POST', '/api/auth/register', { username: BOB, email: BOB_EMAIL, password: 'Bob12345' });
  check('Register bob', r.status === 201);
  const bobToken = r.body.token;

  r = await http('POST', '/api/auth/register', { username: ALICE, email: 'other@test.com', password: 'Pass1234' });
  check('Duplicate username → 409', r.status === 409, r.body.error);

  r = await http('POST', '/api/auth/register', { username: 'newuser', email: 'new@test.com', password: 'abc' });
  check('Weak password → 400', r.status === 400, r.body.error);

  r = await http('POST', '/api/auth/register', { username: 'newuser', email: 'notanemail', password: 'Pass1234' });
  check('Invalid email → 400', r.status === 400, r.body.error);

  r = await http('POST', '/api/auth/login', { email: ALICE_EMAIL, password: 'Alice1234' });
  check('Login valid → 200 + token', r.status === 200 && !!r.body.token);

  r = await http('POST', '/api/auth/login', { email: ALICE_EMAIL, password: 'wrongpass' });
  check('Login wrong password → 401', r.status === 401, r.body.error);

  r = await http('GET', '/api/nonexistent');
  check('Unknown route → JSON 404', r.status === 404 && typeof r.body === 'object', typeof r.body);

  r = await http('GET', '/health');
  check('Health endpoint → ok', r.status === 200 && r.body.status === 'ok');

  console.log('\n── Socket: auth enforcement ─────────────────────────────────');

  const badErr = await new Promise(resolve => {
    const s = io(BASE, { auth: { token: 'badtoken' }, transports: ['websocket'], timeout: 3000 });
    s.on('connect_error', e => { s.disconnect(); resolve(e.message); });
    s.on('connect', () => { s.disconnect(); resolve(null); });
    setTimeout(() => resolve('timeout'), 3500);
  });
  check('Bad token → connect_error', !!badErr, badErr);

  const noAuthErr = await new Promise(resolve => {
    const s = io(BASE, { transports: ['websocket'], timeout: 3000 });
    s.on('connect_error', e => { s.disconnect(); resolve(e.message); });
    s.on('connect', () => { s.disconnect(); resolve(null); });
    setTimeout(() => resolve('timeout'), 3500);
  });
  check('No token → connect_error', !!noAuthErr, noAuthErr);

  console.log('\n── Socket: rooms ────────────────────────────────────────────');

  const alice = await connect(aliceToken);
  check('Alice connects with valid token', alice.connected);
  const bob = await connect(bobToken);
  check('Bob connects with valid token', bob.connected);

  // Invalid room name
  const invalidRoomErr = await new Promise(resolve => {
    alice.once('error', resolve);
    alice.emit('join_room', { room: 'bad room!' });
    setTimeout(() => resolve(null), 600);
  });
  check('Invalid room name → error event', !!invalidRoomErr, JSON.stringify(invalidRoomErr));

  // Alice joins general
  const alicePresence = waitFor(alice, 'presence');
  alice.emit('join_room', { room: 'general' });
  const p1 = await alicePresence;
  check('Alice joins → presence_update with her username', p1.online?.includes(ALICE), JSON.stringify(p1));

  // Bob joins — both get updated presence
  const [aliceSeesP, bobSeesP] = await Promise.all([
    waitFor(alice, 'presence'),
    (async () => { bob.emit('join_room', { room: 'general' }); return waitFor(bob, 'presence'); })(),
  ]);
  check('Bob joins → presence has 2 users', (aliceSeesP.online?.length >= 2 || bobSeesP.online?.length >= 2),
    JSON.stringify(bobSeesP.online));

  console.log('\n── Socket: messaging ────────────────────────────────────────');

  // Alice sends, bob receives
  const [bobMsg] = await Promise.all([
    waitFor(bob, 'new_message'),
    (async () => { alice.emit('send_message', { room: 'general', text: 'Hello from Alice!' }); })(),
  ]);
  check('Alice sends → Bob receives new_message', bobMsg?.text === 'Hello from Alice!', bobMsg?.text);
  check('Message has sender.username', bobMsg?.sender?.username === ALICE, bobMsg?.sender?.username);
  check('Message has _id', !!bobMsg?._id);
  check('Message has createdAt', !!bobMsg?.createdAt);
  const msgId = bobMsg._id;

  // Empty message rejected
  const emptyErr = await new Promise(resolve => {
    alice.once('error', resolve);
    alice.emit('send_message', { room: 'general', text: '' });
    setTimeout(() => resolve(null), 600);
  });
  check('Empty message → error', !!emptyErr, JSON.stringify(emptyErr));

  // 2001-char message rejected
  const bigErr = await new Promise(resolve => {
    alice.once('error', resolve);
    alice.emit('send_message', { room: 'general', text: 'x'.repeat(2001) });
    setTimeout(() => resolve(null), 600);
  });
  check('2001-char message → error', !!bigErr, JSON.stringify(bigErr));

  // Message history on join
  const charlie_r = await http('POST', '/api/auth/register', { username: `charlie_${id}`, email: `charlie_${id}@test.com`, password: 'Charlie1234' });
  const charlie = await connect(charlie_r.body.token);
  const [history] = await Promise.all([
    waitFor(charlie, 'message_history'),
    (async () => { charlie.emit('join_room', { room: 'general' }); })(),
  ]);
  check('History sent on room join', Array.isArray(history) && history.length > 0, `${history?.length} msgs`);
  check('History order: oldest first', history?.[0]?.text === 'Hello from Alice!', history?.[0]?.text);

  console.log('\n── Socket: reactions ────────────────────────────────────────');

  const [reaction] = await Promise.all([
    waitFor(alice, 'reaction_update'),
    (async () => { bob.emit('add_reaction', { messageId: msgId, emoji: '👍' }); })(),
  ]);
  check('React → reaction_update broadcast', !!reaction, JSON.stringify(reaction));
  const thumbsUp = reaction.reactions?.find(r => r.emoji === '👍');
  check('Reaction emoji correct', thumbsUp?.emoji === '👍', JSON.stringify(thumbsUp));
  check('Reaction has userIds array', Array.isArray(thumbsUp?.userIds) && thumbsUp.userIds.length > 0);

  // Toggle off
  const [toggled] = await Promise.all([
    waitFor(alice, 'reaction_update'),
    (async () => { bob.emit('add_reaction', { messageId: msgId, emoji: '👍' }); })(),
  ]);
  const thumbsUpAfter = toggled.reactions?.find(r => r.emoji === '👍');
  check('Re-react toggles off', !thumbsUpAfter || thumbsUpAfter.userIds?.length === 0,
    JSON.stringify(toggled.reactions));

  console.log('\n── Socket: typing indicators ────────────────────────────────');

  const [typing] = await Promise.all([
    waitFor(bob, 'typing'),
    (async () => { alice.emit('typing_start', { room: 'general' }); })(),
  ]);
  check('typing_start → typing_update with username', typing?.users?.includes(ALICE),
    JSON.stringify(typing));

  const [stopped] = await Promise.all([
    waitFor(bob, 'typing'),
    (async () => { alice.emit('typing_stop', { room: 'general' }); })(),
  ]);
  check('typing_stop → username removed', !stopped?.users?.includes(ALICE),
    JSON.stringify(stopped));

  console.log('\n── Socket: disconnect presence ──────────────────────────────');

  const afterDC = await Promise.all([
    waitFor(alice, 'presence', 5000),
    new Promise(resolve => { charlie.disconnect(); resolve(); }),
  ]);
  check('Charlie disconnects → presence_update removes charlie_t',
    !afterDC[0]?.online?.includes(`charlie_${id}`), JSON.stringify(afterDC[0]?.online));

  console.log('\n── Edge cases ───────────────────────────────────────────────');

  // Send to unjoined room
  const notInRoomErr = await new Promise(resolve => {
    alice.once('error', resolve);
    alice.emit('send_message', { room: 'privateroom-xyz', text: 'sneak' });
    setTimeout(() => resolve(null), 600);
  });
  check('Message to unjoined room → error', !!notInRoomErr, JSON.stringify(notInRoomErr));

  // React to nonexistent message
  const badReactErr = await new Promise(resolve => {
    bob.once('error', resolve);
    bob.emit('add_reaction', { messageId: '000000000000000000000000', emoji: '❤️' });
    setTimeout(() => resolve(null), 1000);
  });
  check('React to nonexistent messageId → error', !!badReactErr, JSON.stringify(badReactErr));

  alice.disconnect();
  bob.disconnect();

  console.log(`\n── Results: ${passed} passed  ${failed} failed ────────────────────────`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('CRASH:', e); process.exit(1); });
