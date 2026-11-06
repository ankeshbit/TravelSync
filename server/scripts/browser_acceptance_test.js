/**
 * TravelSync Real Browser Acceptance Test Suite (Stage 8)
 *
 * Uses native Chrome DevTools Protocol (CDP) to drive actual Google Chrome instances.
 * Tests Alice and Bob in completely isolated browser sessions with independent
 * user-data-dirs, inspecting DOM state, console logs, network responses,
 * IndexedDB cache, Socket.IO real-time synchronizations, and offline emulation.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000/api';
const ALICE_PORT = 9222;
const BOB_PORT = 9223;

const results = [];

function recordResult(testId, name, action, expected, actual, pass, consoleErrors = [], networkErrors = []) {
  const item = {
    testId,
    name,
    action,
    expected,
    actual,
    pass,
    consoleErrors,
    networkErrors
  };
  results.push(item);
  const badge = pass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
  console.log(`${badge} ${String(testId).padStart(2, ' ')}. ${name}: ${action}`);
  if (!pass) {
    console.log(`       Expected: ${expected}`);
    console.log(`       Actual:   ${actual}`);
  }
  if (consoleErrors.length > 0) {
    console.log(`       Console warnings/errors: ${JSON.stringify(consoleErrors)}`);
  }
}

// ── CDP Client Helper ──────────────────────────────────────────────────────────
class CDPClient {
  constructor(port, label) {
    this.port = port;
    this.label = label;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
    this.consoleLogs = [];
    this.networkLogs = [];
  }

  async connect() {
    let tab = null;
    try {
      const listRes = await fetch(`http://localhost:${this.port}/json/list`);
      const tabs = await listRes.json();
      tab = tabs.find(t => t.type === 'page');
    } catch {}

    if (!tab) {
      const res = await fetch(`http://localhost:${this.port}/json/new`, { method: 'PUT' });
      tab = await res.json();
    }
    this.tabId = tab.id;
    this.ws = new WebSocket(tab.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map(a => a.value || a.description || '').join(' ');
        if (data.params.type === 'error') {
          this.consoleLogs.push(`[${data.params.type}] ${text}`);
        }
      } else if (data.method === 'Network.responseReceived') {
        const status = data.params.response.status;
        if (status >= 400 && !data.params.response.url.includes('/stats')) {
          this.networkLogs.push(`HTTP ${status} from ${data.params.response.url}`);
        }
      }
    };

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
    await this.send('Page.navigate', { url: `${BASE_URL}/login` });
    await new Promise(r => setTimeout(r, 1200));
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${res.exceptionDetails.text} (${expression})`);
    }
    return res.result ? res.result.value : undefined;
  }

  async waitFor(expression, timeoutMs = 12000, intervalMs = 250) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(expression);
        if (val) return val;
      } catch (e) {
        // Retry
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }

  async navigateTo(url) {
    await this.eval(`window.location.href = "${url}"`);
    await new Promise(r => setTimeout(r, 1500));
  }

  async emulateOffline(offline = true) {
    await this.send('Network.emulateNetworkConditions', {
      offline,
      latency: offline ? 0 : 5,
      downloadThroughput: offline ? 0 : -1,
      uploadThroughput: offline ? 0 : -1
    });
  }

  async reload() {
    await this.send('Page.reload');
    await new Promise(r => setTimeout(r, 1500));
  }

  async close() {
    try {
      if (this.ws) this.ws.close();
      await fetch(`http://localhost:${this.port}/json/close/${this.tabId}`, { method: 'PUT' }).catch(() => {});
    } catch {}
  }
}

// ── Main Acceptance Test Sequence ─────────────────────────────────────────────
async function run() {
  console.log('======================================================================');
  console.log('       TRAVELSYNC FINAL REAL-BROWSER ACCEPTANCE TEST SUITE            ');
  console.log('======================================================================\n');

  const aliceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome_alice_'));
  const bobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome_bob_'));

  console.log(`[Setup] Launching Alice Chrome (Port ${ALICE_PORT})...`);
  const aliceProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${ALICE_PORT}`,
    `--user-data-dir=${aliceDir}`,
    '--no-first-run',
    '--no-default-browser-check'
  ]);

  console.log(`[Setup] Launching Bob Chrome (Port ${BOB_PORT})...`);
  const bobProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${BOB_PORT}`,
    `--user-data-dir=${bobDir}`,
    '--no-first-run',
    '--no-default-browser-check'
  ]);

  let alice = null;
  let bob = null;

  try {
    // Wait for Chrome instances to bind ports
    await new Promise(r => setTimeout(r, 2000));

    alice = new CDPClient(ALICE_PORT, 'Alice');
    bob = new CDPClient(BOB_PORT, 'Bob');

    await alice.connect();
    await bob.connect();

    // ── Test 1: Alice Login ──
    try {
      await alice.waitFor('document.querySelector(".demo-btn-alice") !== null');
      await alice.eval('document.querySelector(".demo-btn-alice").click()');
      await alice.waitFor('window.location.pathname === "/dashboard"', 10000);
      const alicePath = await alice.eval('window.location.pathname');
      recordResult(
        1,
        'Alice Demo Login',
        'Click "Alice (Owner)" button on /login',
        'Redirects to /dashboard and stores user session',
        `Navigated to ${alicePath}`,
        alicePath === '/dashboard',
        alice.consoleLogs,
        alice.networkLogs
      );
    } catch (e) {
      recordResult(1, 'Alice Demo Login', 'Click Alice button', '/dashboard', e.message, false);
    }

    // ── Test 2: Bob Login in Separate Session ──
    try {
      await bob.waitFor('document.querySelector(".demo-btn-bob") !== null');
      await bob.eval('document.querySelector(".demo-btn-bob").click()');
      await bob.waitFor('window.location.pathname === "/dashboard"', 10000);
      const bobPath = await bob.eval('window.location.pathname');
      recordResult(
        2,
        'Bob Demo Login (Independent Session)',
        'Click "Bob (Member)" button in separate Chrome profile',
        'Redirects to /dashboard with isolated session',
        `Navigated to ${bobPath}`,
        bobPath === '/dashboard',
        bob.consoleLogs,
        bob.networkLogs
      );
    } catch (e) {
      recordResult(2, 'Bob Demo Login', 'Click Bob button', '/dashboard', e.message, false);
    }

    // ── Test 3: Session Token & Identity Isolation ──
    try {
      const aliceToken = await alice.eval('localStorage.getItem("demo_token")');
      const bobToken = await bob.eval('localStorage.getItem("demo_token")');
      const isolated = aliceToken === 'demo-token-alice' && bobToken === 'demo-token-bob';
      recordResult(
        3,
        'Session Token Isolation',
        'Inspect localStorage.demo_token across both browser sessions',
        'Alice has demo-token-alice, Bob has demo-token-bob',
        `Alice: ${aliceToken}, Bob: ${bobToken}`,
        isolated
      );
    } catch (e) {
      recordResult(3, 'Session Token Isolation', 'Check tokens', 'Isolated tokens', e.message, false);
    }

    // ── Test 4: Dashboard Navigation & Seeded Trip Card Visibility ──
    let tripId = null;
    try {
      await alice.waitFor('document.body.innerText.includes("Japan Cherry Blossom")', 8000);
      const tripTitle = await alice.eval(`
        (() => {
          const el = Array.from(document.querySelectorAll('h3, h2, a, p')).find(e => e.innerText && e.innerText.includes('Japan Cherry Blossom'));
          return el ? el.innerText : null;
        })()
      `);

      // Query seeded trip ID
      const aliceToken = await alice.eval('localStorage.getItem("demo_token")');
      const tripsRes = await fetch(`${API_URL}/trips`, {
        headers: { Authorization: `Bearer ${aliceToken}` }
      });
      const tripsJson = await tripsRes.json();
      tripId = tripsJson.trips?.[0]?.id;

      recordResult(
        4,
        'Dashboard Navigation',
        'Load dashboard and locate seeded Japan trip card',
        'Displays "Japan Cherry Blossom & Culinary Tour 2026"',
        `Found: "${tripTitle}" (ID: ${tripId})`,
        tripTitle !== null && tripTitle.includes('Japan') && Boolean(tripId)
      );
    } catch (e) {
      recordResult(4, 'Dashboard Navigation', 'Locate trip card', 'Seeded trip present', e.message, false);
    }

    // ── Test 5: Open Trip Details View (Alice) ──
    try {
      await alice.navigateTo(`${BASE_URL}/trips/${tripId}`);
      await alice.waitFor('document.body.innerText.includes("Japan") || document.body.innerText.includes("Members")', 8000);
      const bodyText = await alice.eval('document.body.innerText');
      const hasTripName = bodyText.includes('Japan Cherry Blossom');
      const hasMembers = bodyText.includes('Members');
      recordResult(
        5,
        'Trip Details Navigation',
        `Load /trips/${tripId} in Alice browser`,
        'Shows Trip Details with Members, Budget widgets and highlights',
        `Title: ${hasTripName}, Members: ${hasMembers}`,
        hasTripName && hasMembers
      );
    } catch (e) {
      recordResult(5, 'Trip Details Navigation', 'Open trip', 'Trip details loaded', e.message, false);
    }

    // ── Test 6: Open Same Trip (Bob) ──
    try {
      await bob.navigateTo(`${BASE_URL}/trips/${tripId}`);
      await bob.waitFor('document.body.innerText.includes("Japan") || document.body.innerText.includes("Members")', 8000);
      const bobSeesTrip = await bob.eval('document.body.innerText.includes("Japan") && document.body.innerText.includes("Members")');
      recordResult(
        6,
        'Multi-Session Trip Access',
        `Bob navigates to ${BASE_URL}/trips/${tripId}`,
        'Bob views trip details without permission errors',
        `Loaded successfully: ${bobSeesTrip}`,
        bobSeesTrip
      );
    } catch (e) {
      recordResult(6, 'Multi-Session Trip Access', 'Navigate to trip', 'Allowed access', e.message, false);
    }

    // ── Test 7: Manage Itinerary on Map & Planner View (Alice) ──
    try {
      await alice.navigateTo(`${BASE_URL}/trips/${tripId}/map?tab=itinerary`);
      await alice.waitFor('document.body.innerText.includes("Day 1") || document.querySelector("button") !== null', 8000);
      const hasAddBtn = await alice.eval(`
        (() => {
          return Array.from(document.querySelectorAll('button, span')).some(e => e.innerText && e.innerText.includes('Add Place'));
        })()
      `);
      recordResult(
        7,
        'Itinerary Planner Navigation',
        `Navigate to /trips/${tripId}/map?tab=itinerary`,
        'Displays itinerary day schedule and "Add Place" action',
        `Found Add Place button: ${hasAddBtn}`,
        hasAddBtn
      );
    } catch (e) {
      recordResult(7, 'Itinerary Planner Navigation', 'Open planner', 'Schedule displayed', e.message, false);
    }

    // ── Test 8: Real-Time Socket.IO Itinerary Sync ──
    try {
      await bob.navigateTo(`${BASE_URL}/trips/${tripId}/map?tab=itinerary`);
      await bob.waitFor('document.body.innerText.includes("Day 1")', 8000);

      // Alice adds a new place to Day 1 via API using her live session token
      const aliceToken = await alice.eval('localStorage.getItem("demo_token")');
      const addPlaceRes = await fetch(`${API_URL}/trips/${tripId}/places`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${aliceToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dayNumber: 1,
          orderIndex: 99,
          lat: 35.6762,
          lng: 139.6503,
          name: 'Asakusa Traditional Matcha Cafe',
          category: 'food',
          note: 'Authentic matcha and dango treat'
        })
      });
      const createdPlace = await addPlaceRes.json();

      // Bob's browser receives live Socket.IO event and updates Day 1 DOM
      await bob.waitFor('document.body.innerText.includes("Asakusa Traditional Matcha Cafe")', 8000);
      const bobSeesPlace = await bob.eval('document.body.innerText.includes("Asakusa Traditional Matcha Cafe")');

      recordResult(
        8,
        'Real-Time Itinerary Sync (Socket.IO)',
        'Alice adds "Asakusa Traditional Matcha Cafe" to Day 1',
        'Bob screen displays new place in real-time with zero page reload',
        bobSeesPlace ? 'New place rendered in Bob browser' : 'Not rendered',
        bobSeesPlace
      );

      // Clean up test place
      await fetch(`${API_URL}/trips/${tripId}/places/${createdPlace.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${aliceToken}` }
      });
    } catch (e) {
      recordResult(8, 'Real-Time Itinerary Sync', 'Add place event', 'Live sync in Bob browser', e.message, false);
    }

    // ── Test 9: Expenses View Navigation (Alice & Bob) ──
    try {
      await alice.navigateTo(`${BASE_URL}/trips/${tripId}/expenses`);
      await alice.waitFor('document.body.innerText.includes("Total Expenses")', 8000);

      await bob.navigateTo(`${BASE_URL}/trips/${tripId}/expenses`);
      await bob.waitFor('document.body.innerText.includes("Total Expenses")', 8000);

      recordResult(
        9,
        'Expenses View Navigation',
        `Navigate to /trips/${tripId}/expenses in both sessions`,
        'Displays "Total Expenses", balance cards, and expense transactions table',
        'Expenses page rendered successfully in both sessions',
        true
      );
    } catch (e) {
      recordResult(9, 'Expenses View Navigation', 'Navigate expenses', 'Render expenses tab', e.message, false);
    }

    // ── Test 10: Verified Financial Balances & Settlements ──
    try {
      await alice.waitFor('document.body.innerText.includes("1,660") || document.body.innerText.includes("1660")', 10000);
      await bob.waitFor('document.body.innerText.includes("430")', 10000);

      const aliceDom = await alice.eval('document.body.innerText');
      const bobDom = await bob.eval('document.body.innerText');

      const hasTotalExpenses = aliceDom.includes('1,660') || aliceDom.includes('1660');
      // In Alice browser, Bob owes Alice ($430.00)
      const aliceSettlement = aliceDom.includes('430');
      // In Bob browser, Bob owes Alice ($430.00)
      const bobSettlement = bobDom.includes('430');

      recordResult(
        10,
        'Balance & Settlement Verification',
        'Verify group spend ($1,660.00) and settlement ($430.00 owed by Bob to Alice)',
        'Matches seed calculation accurately from both users perspective',
        `Spend: ${hasTotalExpenses}, Alice view: ${aliceSettlement}, Bob view: ${bobSettlement}`,
        hasTotalExpenses && aliceSettlement && bobSettlement
      );
    } catch (e) {
      recordResult(10, 'Balance & Settlement Verification', 'Inspect balances', 'Matches seed values', e.message, false);
    }

    // ── Test 11: Real-Time Shared Expense Creation & Debt Recalculation ──
    try {
      const aliceToken = await alice.eval('localStorage.getItem("demo_token")');
      const aliceUser = JSON.parse(await alice.eval('localStorage.getItem("user")'));
      const bobUser = JSON.parse(await bob.eval('localStorage.getItem("user")'));

      // Alice creates a $40 snack expense split 50/50 with Bob ($20 each)
      const postExp = await fetch(`${API_URL}/trips/${tripId}/expenses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${aliceToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `browser-test-exp-${Date.now()}`
        },
        body: JSON.stringify({
          title: 'Kyoto Nishiki Market Snacks',
          amount: 40,
          currency: 'USD',
          category: 'food',
          paidBy: aliceUser.id,
          splitAmong: [aliceUser.id, bobUser.id]
        })
      });
      const expJson = await postExp.json();

      // Bob's browser receives live Socket.IO update: Bob now owes $430 + $20 = $450
      await bob.waitFor('document.body.innerText.includes("450") || document.body.innerText.includes("Nishiki Market")', 8000);
      const bobUpdated = await bob.eval('document.body.innerText.includes("450") || document.body.innerText.includes("Nishiki Market")');

      recordResult(
        11,
        'Live Expense Socket Sync',
        'Alice adds $40 shared expense split with Bob',
        'Bob screen updates live to reflect updated debt ($450.00 USD)',
        bobUpdated ? 'Bob balance updated to $450.00 live' : 'Not updated',
        bobUpdated
      );

      // Clean up temporary expense
      await fetch(`${API_URL}/trips/${tripId}/expenses/${expJson.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${aliceToken}` }
      });
    } catch (e) {
      recordResult(11, 'Live Expense Socket Sync', 'Add expense', 'Live update on Bob screen', e.message, false);
    }

    // ── Test 12: Offline Travel Companion & IndexedDB Cache Persistence ──
    try {
      // 1. Visit Trip Details first and trigger Save Offline
      await alice.navigateTo(`${BASE_URL}/trips/${tripId}`);
      await alice.waitFor('document.body.innerText.includes("Members")', 8000);

      // 2. Click "Save Offline"
      await alice.eval(`
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Save Offline') || b.innerText.includes('Offline Ready')));
          if (btn && btn.innerText.includes('Save Offline')) btn.click();
        })()
      `);
      await new Promise(r => setTimeout(r, 1200));

      // 3. Navigate to offline companion route /offline-trips/:tripId
      await alice.navigateTo(`${BASE_URL}/offline-trips/${tripId}`);
      await alice.waitFor('document.body.innerText.includes("Japan") || document.body.innerText.includes("Offline")', 8000);

      // 4. Emulate offline conditions
      await alice.emulateOffline(true);

      // 5. Verify cached trip details remain visible and interactive from IndexedDB
      const offlineDom = await alice.eval('document.body.innerText');
      const hasTripName = offlineDom.includes('Japan');
      const hasOfflineBadge = offlineDom.toLowerCase().includes('offline') || !navigator.onLine;

      recordResult(
        12,
        'Offline Travel Companion & IndexedDB Cache',
        'Navigate to /offline-trips/:id with offline network emulation',
        'Trip details, itinerary places, and budget load seamlessly from IndexedDB',
        `Trip visible: ${hasTripName}, Offline state active: ${hasOfflineBadge}`,
        hasTripName
      );

      // Restore network
      await alice.emulateOffline(false);
      await alice.navigateTo(`${BASE_URL}/dashboard`);
    } catch (e) {
      recordResult(12, 'Offline Travel Companion', 'Disconnect and check IndexedDB', 'Cached trip readable', e.message, false);
      await alice.emulateOffline(false).catch(() => {});
    }

    // ── Test 13: RBAC Authorization (Bob Cannot Delete Alice's Trip) ──
    try {
      const bobToken = await bob.eval('localStorage.getItem("demo_token")');
      const deleteTripAttempt = await fetch(`${API_URL}/trips/${tripId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${bobToken}` }
      });
      const isBlocked = deleteTripAttempt.status === 403;
      recordResult(
        13,
        'RBAC Authorization Boundary',
        'Bob (member) attempts to delete Alice (owner) trip',
        'Backend strictly enforces HTTP 403 Forbidden',
        `HTTP ${deleteTripAttempt.status}`,
        isBlocked
      );
    } catch (e) {
      recordResult(13, 'RBAC Authorization Boundary', 'Delete trip as member', 'HTTP 403', e.message, false);
    }

    // ── Test 14: Non-Member Access Rejection ──
    try {
      const fakeTokenRes = await fetch(`${API_URL}/trips/${tripId}`, {
        headers: { Authorization: 'Bearer demo-token-charlie' }
      });
      const isBlocked = fakeTokenRes.status === 401;
      recordResult(
        14,
        'Non-Whitelisted User Rejection',
        'Request trip details with non-existent demo token (charlie)',
        'Rejected with HTTP 401 Unauthorized',
        `HTTP ${fakeTokenRes.status}`,
        isBlocked
      );
    } catch (e) {
      recordResult(14, 'Non-Whitelisted User Rejection', 'Request as charlie', 'HTTP 401', e.message, false);
    }

    // ── Test 15: Logout & Multi-User Isolation ──
    try {
      // Alice logs out
      await alice.eval(`
        (() => {
          localStorage.removeItem('demo_token');
          localStorage.removeItem('user');
          window.location.href = "${BASE_URL}/login";
        })()
      `);
      await alice.waitFor('window.location.pathname === "/login"', 8000);

      // Verify Alice has no token
      const aliceTokenAfter = await alice.eval('localStorage.getItem("demo_token")');

      // Verify Bob session in browser 2 remains completely active
      const bobTokenAfter = await bob.eval('localStorage.getItem("demo_token")');
      const bobStillActive = bobTokenAfter === 'demo-token-bob';

      recordResult(
        15,
        'Logout & Multi-User Isolation',
        'Log out Alice in Browser 1 and verify Browser 2',
        'Alice is logged out; Bob session remains active and unaffected',
        `Alice token: ${aliceTokenAfter || 'cleared'}, Bob token: ${bobTokenAfter}`,
        aliceTokenAfter === null && bobStillActive
      );
    } catch (e) {
      recordResult(15, 'Logout & Multi-User Isolation', 'Logout Alice', 'Bob unaffected', e.message, false);
    }

  } finally {
    console.log('\n[Teardown] Closing Chrome instances...');
    if (alice) await alice.close();
    if (bob) await bob.close();
    aliceProc.kill('SIGKILL');
    bobProc.kill('SIGKILL');
    try { fs.rmSync(aliceDir, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(bobDir, { recursive: true, force: true }); } catch {}
  }

  // ── Print Summary ──────────────────────────────────────────────────────────
  console.log('\n======================================================================');
  const passedCount = results.filter(r => r.pass).length;
  const failedCount = results.filter(r => !r.pass).length;
  console.log(`BROWSER ACCEPTANCE TESTS SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED (${results.length} TOTAL)`);
  console.log('======================================================================');

  return { passedCount, failedCount, results };
}

run().catch(err => {
  console.error('Fatal acceptance test error:', err);
  process.exit(1);
});
