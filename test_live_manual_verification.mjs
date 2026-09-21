const BASE_URL = 'http://127.0.0.1:3000';

async function runLiveManualVerification() {
  console.log('===============================================================');
  console.log('🌐 LIVE ENDPOINT VERIFICATION AGAINST RUNNING SERVER (PORT 3000)');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Register test1@example.com / Test@123 -> Login with test1@example.com / Test@123
    // ----------------------------------------------------
    console.log('--- TEST 1: Register & Login (test1@example.com / Test@123) ---');
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Candidate One',
        email: 'test1@example.com',
        password: 'Test@123',
      }),
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, `Register status 201 Created (Got: ${regRes.status})`);
    assert(regData.success === true, 'Registration success is true');

    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test1@example.com',
        password: 'Test@123',
      }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, `Login status 200 OK (Got: ${loginRes.status})`);
    assert(loginData.success === true, 'Login success is true');
    assert(Boolean(loginData.token), 'Valid JWT token returned');
    assert(loginData.user.email === 'test1@example.com', 'User email is test1@example.com');
    const validToken = loginData.token;

    // ----------------------------------------------------
    // TEST 2: Same email test1@example.com with WrongPassword
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Same email with WrongPassword (LOGIN MUST FAIL) ---');
    const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test1@example.com',
        password: 'WrongPassword',
      }),
    });
    const wrongPassData = await wrongPassRes.json();
    assert(wrongPassRes.status === 401, `Status is 401 Unauthorized (Got: ${wrongPassRes.status})`);
    assert(wrongPassData.success === false, 'Success is false');
    assert(wrongPassData.message === 'Invalid email or password', 'Generic error message returned');

    // ----------------------------------------------------
    // TEST 3: Non-existing email doesnotexist@example.com / Anything123
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Non-existing doesnotexist@example.com (LOGIN MUST FAIL) ---');
    const nonExistRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'doesnotexist@example.com',
        password: 'Anything123',
      }),
    });
    const nonExistData = await nonExistRes.json();
    assert(nonExistRes.status === 401, `Status is 401 Unauthorized (Got: ${nonExistRes.status})`);
    assert(nonExistData.success === false, 'Success is false');
    assert(nonExistData.message === 'Invalid email or password', 'Generic error message prevents email disclosure');

    // ----------------------------------------------------
    // TEST 4: Try random credentials
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Random Arbitrary Credentials (LOGIN MUST FAIL) ---');
    const randomRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `arbitrary_${Date.now()}@fakeuniv.edu`,
        password: 'randomHackerPassword!999',
      }),
    });
    const randomData = await randomRes.json();
    assert(randomRes.status === 401, `Status is 401 Unauthorized for arbitrary input (Got: ${randomRes.status})`);
    assert(randomData.success === false, 'Arbitrary login completely blocked');

    // ----------------------------------------------------
    // TEST 5: Logout & Protected Access
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Logout & Protected Resource Verification ---');
    // First verify token works
    const authedCheck = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert(authedCheck.status === 200, `Authenticated token grants access to /api/auth/me (Got: ${authedCheck.status})`);

    // Call logout endpoint
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert(logoutRes.status === 200, 'Logout returns 200 OK');

    // Attempt protected API without token (as client would do after logout)
    const afterLogoutCheck = await fetch(`${BASE_URL}/api/auth/me`);
    assert(afterLogoutCheck.status === 401, `Unauthenticated request blocked after logout with 401 (Got: ${afterLogoutCheck.status})`);

    const sessionsCheck = await fetch(`${BASE_URL}/api/db/sessions`);
    assert(sessionsCheck.status === 401, `Protected /api/db/sessions blocked without token with 401 (Got: ${sessionsCheck.status})`);

    console.log('\n===============================================================');
    console.log(`📊 LIVE AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    if (failed > 0) process.exitCode = 1;
  } catch (err) {
    console.error('Error running live verification:', err);
    process.exitCode = 1;
  }
}

runLiveManualVerification();
