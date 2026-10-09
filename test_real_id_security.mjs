import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from './server/config/database.ts';
import authRoutes from './server/routes/authRoutes.ts';
import { User, UserService } from './server/models/User.ts';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

let server;
let baseUrl;

async function setup() {
  await connectDB();
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`🚀 Real-ID Security Test Server running at: ${baseUrl}\n`);
      resolve();
    });
  });
}

async function teardown() {
  if (server) server.close();
  await mongoose.connection.close();
  console.log('🏁 Real-ID security tests completed.\n');
}

async function runTests() {
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

    console.log('--- TEST 1: Reject Non-Existent Domain ---');
    const fakeDomainRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fakeuser@randomnonexistent982374982374.com' }),
    });
    const fakeDomainData = await fakeDomainRes.json();
    assert(fakeDomainRes.status === 400, `Fake domain rejected with 400 (Got: ${fakeDomainRes.status})`);
    assert(fakeDomainData.success === false, 'Fake domain response has success: false');
    assert(
      fakeDomainData.message.toLowerCase().includes('domain') || fakeDomainData.message.toLowerCase().includes('exist'),
      `Informative error message given: "${fakeDomainData.message}"`
    );

    console.log('\n--- TEST 2: Reject Disposable / Temporary Email ---');
    const disposableRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'throwaway@mailinator.com' }),
    });
    const disposableData = await disposableRes.json();
    assert(disposableRes.status === 400, `Disposable email rejected with 400 (Got: ${disposableRes.status})`);
    assert(disposableData.success === false, 'Disposable email response has success: false');
    assert(
      disposableData.message.toLowerCase().includes('disposable') || disposableData.message.toLowerCase().includes('temporary'),
      `Disposable error message given: "${disposableData.message}"`
    );

    console.log('\n--- TEST 3: Generate Real OTP for Valid Domain ---');
    const testEmail = `candidate_test_${Date.now()}@gmail.com`;
    const sendOtpRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const sendOtpData = await sendOtpRes.json();
    assert(sendOtpRes.status === 200, `OTP sent successfully with 200 (Got: ${sendOtpRes.status})`);
    assert(sendOtpData.success === true, 'Response has success: true');
    assert(Boolean(sendOtpData.devOtp), `Development OTP received: ${sendOtpData.devOtp}`);

    const generatedOtp = sendOtpData.devOtp;

    console.log('\n--- TEST 4: Reject Invalid OTP Code ---');
    const wrongOtpRes = await fetch(`${baseUrl}/api/auth/verify-otp-and-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: '000000',
        name: 'Test Candidate',
        password: 'ValidPassword@123',
        targetRole: 'Full Stack Developer',
      }),
    });
    const wrongOtpData = await wrongOtpRes.json();
    assert(wrongOtpRes.status === 400, `Incorrect OTP rejected with 400 (Got: ${wrongOtpRes.status})`);
    assert(wrongOtpData.success === false, 'Wrong OTP has success: false');

    console.log('\n--- TEST 5: Verify Correct OTP & Create Verified User ---');
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp-and-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: generatedOtp,
        name: 'Real Verified Candidate',
        password: 'ValidPassword@123',
        targetRole: 'Full Stack Developer',
      }),
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 201, `Account created with 201 (Got: ${verifyRes.status})`);
    assert(verifyData.success === true, 'Verification has success: true');
    assert(Boolean(verifyData.token), 'Valid JWT token returned upon verification');
    assert(verifyData.user.email === testEmail, `User email matches registered email: ${verifyData.user.email}`);
    assert(verifyData.user.isVerified === true, 'User marked as isVerified: true');

    console.log('\n--- TEST 6: Prevent Duplicate Registration for Verified Account ---');
    const duplicateRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const duplicateData = await duplicateRes.json();
    assert(duplicateRes.status === 409, `Duplicate email rejected with 409 (Got: ${duplicateRes.status})`);
    assert(duplicateData.success === false, 'Duplicate registration has success: false');

    console.log('\n--- TEST 7: Log In with Newly Verified Account ---');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'ValidPassword@123' }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, `Login succeeded with 200 (Got: ${loginRes.status})`);
    assert(loginData.success === true, 'Login has success: true');
    assert(Boolean(loginData.token), 'Login token received');

    console.log('\n====================================================');
    console.log(`📊 REAL-ID SECURITY RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await teardown();
  }
}

runTests();
