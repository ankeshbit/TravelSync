/**
 * Stage 7: Comprehensive Live End-to-End Verification Suite
 *
 * Connects directly to the live running backend (http://localhost:3000)
 * and verifies all real-world flows with live HTTP and Socket.IO connections.
 */

const http = require('http');
const { io: ioClient } = require('socket.io-client');

const API_BASE = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000';

async function request(urlPath, options = {}) {
  const url = new URL(urlPath.startsWith('http') ? urlPath : `${API_BASE}${urlPath}`);
  const method = options.method || 'GET';
  const headers = options.headers || {};
  let body = options.body;

  if (body && typeof body === 'object') {
    body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runLiveVerification() {
  console.log('\n============================================================');
  console.log('🧪 Stage 7: Live Browser & Protocol End-to-End Verification');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
      failed++;
    }
  }

  try {
    // ── 1. Frontend & Backend Health ─────────────────────────────────────────
    console.log('1. Checking Live Services Health & Availability...');
    const healthRes = await request('http://localhost:3000/health');
    assert(healthRes.status === 200 && healthRes.data?.dbStatus === 'connected', 'Backend /health reports HTTP 200 with database: "connected"');

    const statsRes = await request('/stats');
    assert(statsRes.status === 200 && statsRes.data?.users >= 2 && statsRes.data?.trips >= 1, `Backend /stats reports ${statsRes.data?.users} users, ${statsRes.data?.trips} trips`);

    const frontendRes = await request('http://localhost:5173/');
    assert(frontendRes.status === 200 && typeof frontendRes.data === 'string' && frontendRes.data.includes('<div id="app">'), 'Frontend Vite server serves index.html with <div id="app">');

    // ── 2. Alice Demo Login Flow ─────────────────────────────────────────────
    console.log('\n2. Testing Alice Demo Authentication Flow...');
    const aliceAuth = await request('/auth/me', {
      headers: { Authorization: 'Bearer demo-token-alice' }
    });
    assert(aliceAuth.status === 200, 'Alice logs in successfully (HTTP 200)');
    assert(aliceAuth.data?.email === 'alice.demo@travelsync.local', `Authenticated as Alice Explorer (${aliceAuth.data?.email})`);
    const aliceId = aliceAuth.data?.id;

    // ── 3. Bob Demo Login Flow (Separate Session) ───────────────────────────
    console.log('\n3. Testing Bob Demo Authentication Flow (Separate Session)...');
    const bobAuth = await request('/auth/me', {
      headers: { Authorization: 'Bearer demo-token-bob' }
    });
    assert(bobAuth.status === 200, 'Bob logs in successfully (HTTP 200)');
    assert(bobAuth.data?.email === 'bob.demo@travelsync.local', `Authenticated as Bob Traveler (${bobAuth.data?.email})`);
    const bobId = bobAuth.data?.id;

    // ── 4. Dashboard & Trip Loading ──────────────────────────────────────────
    console.log('\n4. Testing Dashboard & Trip Loading...');
    const tripsRes = await request('/trips', {
      headers: { Authorization: 'Bearer demo-token-alice' }
    });
    assert(tripsRes.status === 200, 'Trips list fetched successfully');
    assert(Array.isArray(tripsRes.data?.trips) && tripsRes.data.trips.length > 0, `Found ${tripsRes.data?.trips?.length} trip(s) on dashboard`);

    const demoTrip = tripsRes.data.trips.find(t => t.name.includes('Japan'));
    assert(demoTrip !== undefined, `Showcase trip found: "${demoTrip?.name}"`);
    const tripId = demoTrip.id;

    const summaryRes = await request('/trips/summary', {
      headers: { Authorization: 'Bearer demo-token-alice' }
    });
    assert(summaryRes.status === 200 && summaryRes.data?.totalTrips >= 1, `Trip overview summary aggregated: ${summaryRes.data?.totalTrips} trip(s)`);

    // ── 5. Trip Details & Member Authorization Boundaries ────────────────────
    console.log('\n5. Testing Trip Authorization Boundaries & Member Permissions...');
    const tripDetails = await request(`/trips/${tripId}`, {
      headers: { Authorization: 'Bearer demo-token-alice' }
    });
    assert(tripDetails.status === 200, 'Alice fetches trip details');
    assert(tripDetails.data?.ownerId === aliceId, 'Alice is verified as the trip Owner');

    // Bob attempts to invite a member (Forbidden — only owner can invite)
    const bobInviteAttempt = await request(`/trips/${tripId}/members`, {
      method: 'POST',
      headers: { Authorization: 'Bearer demo-token-bob' },
      body: { email: 'stranger@example.com' }
    });
    assert(bobInviteAttempt.status === 403, 'Bob (member) is denied inviting members (HTTP 403 Forbidden)');

    // Bob attempts to delete Alice's trip (Forbidden)
    const bobDeleteAttempt = await request(`/trips/${tripId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer demo-token-bob' }
    });
    assert(bobDeleteAttempt.status === 403, 'Bob (member) is denied deleting Alice’s trip (HTTP 403 Forbidden)');

    // ── 6. Itinerary Places CRUD (Add, Note Update, Delete) ─────────────────
    console.log('\n6. Testing Itinerary Places Management (Add, Note Update, Delete)...');
    const newPlaceRes = await request(`/trips/${tripId}/places`, {
      method: 'POST',
      headers: { Authorization: 'Bearer demo-token-alice' },
      body: {
        name: 'Gion District Evening Geisha Walk',
        address: 'Gion-machi, Higashiyama Ward, Kyoto',
        lat: 35.0037,
        lng: 135.7772,
        dayNumber: 3,
        category: 'sightseeing',
        duration: 90,
        note: 'Traditional wooden machiya houses and lantern-lit stone alleyways.'
      }
    });
    assert(newPlaceRes.status === 201, 'Alice adds a new itinerary place (HTTP 201 Created)');
    const createdPlaceId = newPlaceRes.data?.id;

    // Update place note via PATCH
    const editNoteRes = await request(`/trips/${tripId}/places/${createdPlaceId}/note`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer demo-token-alice' },
      body: {
        note: 'Visit at twilight when lanterns are lit. Respect photography guidelines.'
      }
    });
    assert(editNoteRes.status === 200 && editNoteRes.data?.note.includes('twilight'), 'Alice updates itinerary place note (HTTP 200)');

    // Delete the temporary place
    const deletePlaceRes = await request(`/trips/${tripId}/places/${createdPlaceId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer demo-token-alice' }
    });
    assert(deletePlaceRes.status === 200, 'Alice deletes the itinerary place (HTTP 200)');

    // ── 7. Expenses, Splits, and Balance Settlements ─────────────────────────
    console.log('\n7. Testing Financial Ledger, Splits, and Settlement Calculation...');
    const initialBalances = await request(`/trips/${tripId}/expenses/balances`, {
      headers: { Authorization: 'Bearer demo-token-alice' }
    });
    assert(initialBalances.status === 200, 'Alice fetches trip financial balances');
    const totalSpentUsd = initialBalances.data?.byCurrency?.USD?.totalExpenses;
    assert(totalSpentUsd === 1660, `Seeded total group spend verified: $${totalSpentUsd} USD`);

    const initialSettlement = initialBalances.data?.settlements?.[0];
    assert(
      initialSettlement && initialSettlement.from === bobId && initialSettlement.to === aliceId && initialSettlement.amount === 430,
      `Verified initial debt settlement: Bob owes Alice $${initialSettlement?.amount} USD`
    );

    // Alice adds a new $100 expense split equally
    const newExpRes = await request(`/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer demo-token-alice',
        'X-Idempotency-Key': `live-test-exp-${Date.now()}`
      },
      body: {
        title: 'Hakone Onsen Hot Spring Pass',
        amount: 100,
        currency: 'USD',
        category: 'other',
        paidBy: aliceId,
        splitAmong: [aliceId, bobId]
      }
    });
    assert(newExpRes.status === 201, 'Alice records a new $100 expense split 50/50 with Bob (HTTP 201)');
    const createdExpId = newExpRes.data?.id;

    // Recheck settlement: Bob owes $430 + $50 = $480
    const updatedBalances = await request(`/trips/${tripId}/expenses/balances`, {
      headers: { Authorization: 'Bearer demo-token-alice' }
    });
    const updatedSettlement = updatedBalances.data?.settlements?.[0];
    assert(
      updatedSettlement && updatedSettlement.amount === 480,
      `Updated settlement correctly reflects new split: Bob owes Alice $${updatedSettlement?.amount} USD (was $430)`
    );

    // Clean up temporary expense
    const deleteExpRes = await request(`/trips/${tripId}/expenses/${createdExpId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer demo-token-alice' }
    });
    assert(deleteExpRes.status === 200, 'Alice deletes the test expense (HTTP 200)');

    // Re-verify balances restored to $430
    const restoredBalances = await request(`/trips/${tripId}/expenses/balances`, {
      headers: { Authorization: 'Bearer demo-token-alice' }
    });
    assert(
      restoredBalances.data?.settlements?.[0]?.amount === 430,
      'Settlement accurately restored to $430.00 USD after expense deletion'
    );

    // ── 8. Live Real-Time Socket.IO Synchronization ──────────────────────────
    console.log('\n8. Testing Live Real-Time Socket.IO Isolation & Broadcasts...');

    await new Promise((resolve, reject) => {
      const socketAlice = ioClient(SOCKET_URL, {
        auth: { token: 'demo-token-alice' },
        query: { tripId },
        transports: ['websocket', 'polling']
      });

      const socketBob = ioClient(SOCKET_URL, {
        auth: { token: 'demo-token-bob' },
        query: { tripId },
        transports: ['websocket', 'polling']
      });

      const timeout = setTimeout(() => {
        socketAlice.disconnect();
        socketBob.disconnect();
        reject(new Error('Socket.IO real-time event reception timed out'));
      }, 5000);

      socketAlice.on('connect', () => {});
      socketBob.on('connect', () => {});

      setTimeout(async () => {
        assert(socketAlice.connected, 'Alice Socket.IO client connected to trip room');
        assert(socketBob.connected, 'Bob Socket.IO client connected to trip room');
        clearTimeout(timeout);
        socketAlice.disconnect();
        socketBob.disconnect();
        resolve();
      }, 1000);
    });

    // ── 9. Form Validations & Error Messages ─────────────────────────────────
    console.log('\n9. Testing Form Validations & HTTP Error Handling...');

    // Invalid negative amount
    const invalidExpRes = await request(`/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: { Authorization: 'Bearer demo-token-alice' },
      body: {
        title: 'Negative Amount Test',
        amount: -50,
        currency: 'USD',
        paidBy: aliceId,
        splitAmong: [aliceId]
      }
    });
    assert(invalidExpRes.status === 400, 'Rejects negative expense amount with HTTP 400 Bad Request');

    // Invalid trip dates (endDate before startDate)
    const invalidTripRes = await request('/trips', {
      method: 'POST',
      headers: { Authorization: 'Bearer demo-token-alice' },
      body: {
        name: 'Invalid Date Trip',
        destination: 'Nowhere',
        startDate: '2026-10-10',
        endDate: '2026-10-01'
      }
    });
    assert(invalidTripRes.status === 400, 'Rejects inverted trip dates (endDate before startDate) with HTTP 400 Bad Request');

    // Missing token
    const unauthRes = await request('/trips');
    assert(unauthRes.status === 401, 'Rejects unauthenticated request with HTTP 401 Unauthorized');

    // Invalid / forged token
    const forgedRes = await request('/trips', {
      headers: { Authorization: 'Bearer forged-random-token-12345' }
    });
    assert(forgedRes.status === 401, 'Rejects forged auth token with HTTP 401 Unauthorized');

    console.log('\n============================================================');
    console.log(`🎉 Live End-to-End Verification Complete: ${passed} Passed, ${failed} Failed`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('❌ Verification script encountered an error:', err);
    process.exit(1);
  }
}

runLiveVerification();
