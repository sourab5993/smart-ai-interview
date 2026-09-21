import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDB } from './server/config/database.ts';
import authRoutes, { seedAuthUsers } from './server/routes/authRoutes.ts';
import databaseRoutes from './server/routes/databaseRoutes.ts';
import { User, UserService } from './server/models/User.ts';
import { InterviewSession } from './server/models/InterviewSession.ts';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/db', databaseRoutes);

let server;
let baseUrl;

async function setup() {
  console.log('🔄 Initializing database connection for test suite...');
  await connectDB();
  await seedAuthUsers();

  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`🚀 Test Server running at: ${baseUrl}\n`);
      resolve();
    });
  });
}

async function teardown() {
  if (server) {
    server.close();
  }
  await mongoose.connection.close();
  console.log('\n🏁 Test suite finished and connections closed cleanly.');
}

async function runTestSuite() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    await setup();

    console.log('====================================================');
    console.log('🧪 RUNNING COMPREHENSIVE AUTHENTICATION TEST SUITE');
    console.log('====================================================\n');

    const testUserA = {
      name: 'Test Candidate A',
      email: `test_user_a_${Date.now()}@example.com`,
      password: 'SecurePassword@123',
    };

    const testUserB = {
      name: 'Test Candidate B',
      email: `test_user_b_${Date.now()}@example.com`,
      password: 'SecurePassword@456',
    };

    let tokenA = null;
    let tokenB = null;
    let userAData = null;
    let userBData = null;

    // ----------------------------------------------------
    // TEST 1: Register New User
    // ----------------------------------------------------
    console.log('--- TEST 1: Register New User ---');
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUserA),
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, `Status is 201 Created (Got: ${regRes.status})`);
    assert(regData.success === true, 'Success flag is true');
    assert(Boolean(regData.token), 'JWT Token is issued upon registration');
    assert(regData.user.email === testUserA.email, 'User email matches registered email');
    assert(!regData.user.password && !regData.user.passwordHash, 'Password and passwordHash are NEVER returned');
    tokenA = regData.token;
    userAData = regData.user;

    // ----------------------------------------------------
    // TEST 2: Register Same Email Again (Duplicate Rejection)
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Register Same Email Again (Duplicate Rejection) ---');
    const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUserA),
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 409 || dupRes.status === 400, `Duplicate email rejected with 409/400 (Got: ${dupRes.status})`);
    assert(dupData.success === false, 'Success flag is false on duplicate registration');

    // ----------------------------------------------------
    // TEST 3: Password Stored in DB MUST Be Bcrypt Hashed
    // ----------------------------------------------------
    console.log('\n--- TEST 3: MongoDB Password Hashing Verification ---');
    const dbUser = await UserService.findByEmail(testUserA.email);
    assert(Boolean(dbUser), 'User found in MongoDB');
    assert(Boolean(dbUser.passwordHash), 'passwordHash field exists in MongoDB');
    assert(dbUser.passwordHash !== testUserA.password, 'Password in MongoDB is NOT plain text');
    assert(dbUser.passwordHash.startsWith('$2a$') || dbUser.passwordHash.startsWith('$2b$'), 'passwordHash is a valid bcrypt hash');
    const isHashValid = await bcrypt.compare(testUserA.password, dbUser.passwordHash);
    assert(isHashValid === true, 'bcrypt.compare() matches stored hash with original password');

    // ----------------------------------------------------
    // TEST 4: Login with Valid Email + Valid Password
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Login with Valid Credentials ---');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserA.email, password: testUserA.password }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, `Status is 200 OK (Got: ${loginRes.status})`);
    assert(loginData.success === true, 'Success flag is true');
    assert(Boolean(loginData.token), 'JWT Token returned');
    assert(!loginData.user.password && !loginData.user.passwordHash, 'Zero password exposure in login response');

    // ----------------------------------------------------
    // TEST 5: Login with Valid Email + Wrong Password (FAIL 401)
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Login with Wrong Password ---');
    const wrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserA.email, password: 'WrongPassword@999' }),
    });
    const wrongPassData = await wrongPassRes.json();
    assert(wrongPassRes.status === 401, `Status is 401 Unauthorized (Got: ${wrongPassRes.status})`);
    assert(wrongPassData.success === false, 'Success is false');
    assert(wrongPassData.message === 'Invalid email or password', 'Generic error message used');

    // ----------------------------------------------------
    // TEST 6: Login with Non-Existing Email (FAIL 401)
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Login with Non-Existing Email ---');
    const nonExistRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'does_not_exist_9999@example.com', password: 'AnyPassword@123' }),
    });
    const nonExistData = await nonExistRes.json();
    assert(nonExistRes.status === 401, `Status is 401 Unauthorized (Got: ${nonExistRes.status})`);
    assert(nonExistData.success === false, 'Success is false');
    assert(nonExistData.message === 'Invalid email or password', 'Does NOT reveal whether email exists');

    // ----------------------------------------------------
    // TEST 7: Login with Empty Email (FAIL 400 Validation)
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Login with Empty Email ---');
    const emptyEmailRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', password: 'SomePassword' }),
    });
    const emptyEmailData = await emptyEmailRes.json();
    assert(emptyEmailRes.status === 400, `Status is 400 Bad Request (Got: ${emptyEmailRes.status})`);
    assert(emptyEmailData.success === false, 'Empty email rejected');

    // ----------------------------------------------------
    // TEST 8: Login with Invalid Email Format (FAIL 400 Validation)
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Login with Invalid Email Format ---');
    const badEmailRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'SomePassword' }),
    });
    const badEmailData = await badEmailRes.json();
    assert(badEmailRes.status === 400, `Status is 400 Bad Request (Got: ${badEmailRes.status})`);
    assert(badEmailData.success === false, 'Invalid email format rejected');

    // ----------------------------------------------------
    // TEST 9: Login with Empty Password (FAIL 400 Validation)
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Login with Empty Password ---');
    const emptyPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserA.email, password: '' }),
    });
    const emptyPassData = await emptyPassRes.json();
    assert(emptyPassRes.status === 400, `Status is 400 Bad Request (Got: ${emptyPassRes.status})`);
    assert(emptyPassData.success === false, 'Empty password rejected');

    // ----------------------------------------------------
    // TEST 10: Protected API Without Authentication (FAIL 401)
    // ----------------------------------------------------
    console.log('\n--- TEST 10: Protected API Without Authentication ---');
    const unauthRes = await fetch(`${baseUrl}/api/auth/me`);
    const unauthData = await unauthRes.json();
    assert(unauthRes.status === 401, `Status is 401 Unauthorized without token (Got: ${unauthRes.status})`);
    assert(unauthData.success === false, 'Unauthenticated request rejected');

    const unauthSessionsRes = await fetch(`${baseUrl}/api/db/sessions`);
    assert(unauthSessionsRes.status === 401, `Protected /api/db/sessions rejected without token (Got: ${unauthSessionsRes.status})`);

    // ----------------------------------------------------
    // TEST 11: Protected API With Invalid Token (FAIL 401)
    // ----------------------------------------------------
    console.log('\n--- TEST 11: Protected API With Invalid Token ---');
    const badTokenRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer fake_invalid_tampered_token_xyz' },
    });
    assert(badTokenRes.status === 401, `Tampered token rejected with 401 (Got: ${badTokenRes.status})`);

    // ----------------------------------------------------
    // TEST 12: User A Attempting to Access User B's Data (FAIL 403)
    // ----------------------------------------------------
    console.log('\n--- TEST 12: Cross-User Isolation (User A vs User B) ---');
    // Register User B
    const regBRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUserB),
    });
    const regBData = await regBRes.json();
    tokenB = regBData.token;
    userBData = regBData.user;

    // User B creates a private interview session
    const createSessionBRes = await fetch(`${baseUrl}/api/db/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        candidateName: testUserB.name,
        course: 'B.Tech',
        targetRole: 'Cybersecurity Analyst',
        overallScore: 92,
      }),
    });
    const sessionBData = await createSessionBRes.json();
    const sessionBId = sessionBData.data._id;
    assert(Boolean(sessionBId), 'User B created interview session in MongoDB');

    // User A attempts to view User B's interview session by ID
    const hackSessionRes = await fetch(`${baseUrl}/api/db/sessions/${sessionBId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(hackSessionRes.status === 403, `User A blocked from viewing User B's session (Got: ${hackSessionRes.status} 403 Forbidden)`);

    // User A queries all sessions -> Must NOT see User B's session
    const querySessionsARes = await fetch(`${baseUrl}/api/db/sessions`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const sessionsAData = await querySessionsARes.json();
    const hasUserBSession = (sessionsAData.data || []).some((s) => s._id === sessionBId);
    assert(!hasUserBSession, 'User A session query excludes User B sessions');

    // ----------------------------------------------------
    // TEST 13: Seeded Accounts (candidate@evaluator.edu)
    // ----------------------------------------------------
    console.log('\n--- TEST 13: Seeded Default Account Verification ---');
    const seedLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'candidate@evaluator.edu',
        password: 'CandidatePassword@123',
      }),
    });
    const seedLoginData = await seedLoginRes.json();
    assert(seedLoginRes.status === 200, `Seeded candidate login succeeds with bcrypt (Got: ${seedLoginRes.status})`);
    assert(seedLoginData.user.email === 'candidate@evaluator.edu', 'Candidate email verified');

    console.log('\n====================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('💥 Test suite runner crashed with error:', err);
    process.exitCode = 1;
  } finally {
    await teardown();
  }
}

runTestSuite();
