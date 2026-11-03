import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';

// Run after building the API. Each run owns a temporary database and API process.
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const apiRoot = path.join(projectRoot, 'backend', 'SunCareApi');
const apiConfiguration = process.env.API_BUILD_CONFIGURATION || 'Release';
const apiDll = path.join(apiRoot, 'bin', apiConfiguration, 'net10.0', 'SunCareApi.dll');
const temporaryRoot = path.resolve(tmpdir());
const temporaryPrefix = path.join(temporaryRoot, 'suncare-api-smoke-');
let temporaryDirectory;
let apiProcess;
let apiOutput = '';
let baseUrl;
let passed = 0;
let sessionToken;

function withDatabase(action) {
  const database = new DatabaseSync(path.join(temporaryDirectory, 'smoke.db'));
  try { return action(database); }
  finally { database.close(); }
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startApi() {
  apiOutput = '';
  const port = await availablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const databasePath = path.join(temporaryDirectory, 'smoke.db');
  apiProcess = spawn('dotnet', [apiDll, '--urls', baseUrl], {
    cwd: apiRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__SunCare: `Data Source=${databasePath}`,
      Logging__LogLevel__Default: 'Warning',
      Logging__LogLevel__Microsoft: 'Warning',
    },
  });
  let startupError;
  apiProcess.once('error', (error) => { startupError = error; });
  const capture = (chunk) => { apiOutput = `${apiOutput}${chunk}`.slice(-16000); };
  apiProcess.stdout.on('data', capture);
  apiProcess.stderr.on('data', capture);

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (startupError) throw startupError;
    if (apiProcess.exitCode !== null) {
      throw new Error(`API exited during startup (${apiProcess.exitCode}).\n${apiOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/doctors`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // The process may still be creating the temporary database.
    }
    await delay(150);
  }
  throw new Error(`API did not become ready within 30 seconds.\n${apiOutput}`);
}

async function stopApi() {
  const processToStop = apiProcess;
  apiProcess = undefined;
  if (!processToStop?.pid || processToStop.exitCode !== null || processToStop.signalCode !== null) return;
  const exited = once(processToStop, 'exit');
  processToStop.kill('SIGTERM');
  const terminated = await Promise.race([exited.then(() => true), delay(5000, false, { ref: false })]);
  if (!terminated) {
    processToStop.kill('SIGKILL');
    await exited;
  }
}

async function request(method, route, body, extraHeaders = {}) {
  return fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
}

async function expectProblem(response, status) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('content-type') ?? '', /application\/problem\+json/);
  const problem = await response.json();
  assert.equal(problem.status, status);
  assert.ok(problem.title);
  return problem;
}

function check(message) {
  passed += 1;
  console.log(`PASS ${message}`);
}

try {
  await access(apiDll).catch(() => {
    throw new Error(`Build the backend first: dotnet build backend/SunCareApi/SunCareApi.csproj --configuration ${apiConfiguration}`);
  });
  temporaryDirectory = await mkdtemp(temporaryPrefix);
  // Start from the previous exercise's exact schema, rather than only testing a fresh DB.
  withDatabase((database) => {
    database.exec(`CREATE TABLE "Doctors" (
      "Id" INTEGER NOT NULL CONSTRAINT "PK_Doctors" PRIMARY KEY AUTOINCREMENT,
      "Name" TEXT NOT NULL, "Specialty" TEXT NOT NULL);`);
    database.prepare('INSERT INTO Doctors (Id, Name, Specialty) VALUES (?, ?, ?)')
      .run(42, 'Bác sĩ từ bài tập 2', 'Nội khoa');
  });
  await startApi();

  const initialResponse = await request('GET', '/api/doctors');
  assert.equal(initialResponse.status, 200);
  const initialDoctors = await initialResponse.json();
  assert.ok(Array.isArray(initialDoctors));
  assert.deepEqual(initialDoctors, [{ id: 42, name: 'Bác sĩ từ bài tập 2', specialty: 'Nội khoa' }]);
  check('Database migration preserves the previous exercise doctors and IDs');

  await expectProblem(await request('GET', '/api/auth/me'), 401);
  for (const [method, route, body] of [
    ['POST', '/api/doctors', { name: 'Guest', specialty: 'Test' }],
    ['PUT', '/api/doctors/42', { name: 'Guest', specialty: 'Test' }],
    ['DELETE', '/api/doctors/42'],
  ]) await expectProblem(await request(method, route, body), 401);
  check('Anonymous users can read doctors but cannot modify data or read /auth/me');

  for (const body of [
    {}, { email: 'invalid-email', password: 'Password123!' },
    { email: 'test@example.com', password: 'short' },
    { email: 'test@example.com', password: '         ' },
    { email: 'test@example.com', password: 'a'.repeat(129) },
    { email: null, password: 'Password123!' },
    { email: 'test@example.com', password: null },
    { email: `${'a'.repeat(250)}@example.com`, password: 'Password123!' },
  ]) await expectProblem(await request('POST', '/api/auth/register', body), 400);
  check('Registration validates required fields, email format and password limits');

  const credentials = { email: '  Member@Example.com  ', password: 'Password123!' };
  const registration = await request('POST', '/api/auth/register', credentials);
  assert.equal(registration.status, 201);
  const registeredUser = await registration.json();
  assert.equal(registeredUser.email, 'Member@Example.com');
  assert.ok(Number.isInteger(registeredUser.id));
  assert.deepEqual(Object.keys(registeredUser).sort(), ['createdAt', 'email', 'id']);
  withDatabase((database) => {
    const storedUser = database.prepare('SELECT * FROM Users WHERE Id = ?').get(registeredUser.id);
    assert.notEqual(storedUser.PasswordHash, credentials.password);
    assert.ok(storedUser.PasswordHash.length > 60);
    assert.equal(storedUser.NormalizedEmail, 'MEMBER@EXAMPLE.COM');
  });
  await expectProblem(await request('POST', '/api/auth/register', {
    email: 'member@example.com', password: 'OtherPassword123!',
  }), 409);
  const concurrent = await Promise.all([0, 1].map(() => request('POST', '/api/auth/register', {
    email: 'race@example.com', password: 'Password123!',
  })));
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
  check('Registration stores a password hash, never returns it and rejects duplicate emails');

  for (const email of ['member@example.com', 'unknown@example.com']) {
    await expectProblem(await request('POST', '/api/auth/login', { email, password: 'WrongPassword123!' }), 401);
  }
  const loginResponse = await request('POST', '/api/auth/login', {
    email: ' member@EXAMPLE.com ', password: credentials.password,
  });
  assert.equal(loginResponse.status, 200);
  const login = await loginResponse.json();
  assert.deepEqual(login.user, registeredUser);
  assert.match(login.token, /^[a-f\d]{64}$/i);
  assert.ok(Date.parse(login.expiresAt) > Date.now());
  sessionToken = login.token;
  const meResponse = await request('GET', '/api/auth/me');
  assert.equal(meResponse.status, 200);
  assert.deepEqual(await meResponse.json(), registeredUser);
  withDatabase((database) => {
    const storedSession = database.prepare('SELECT * FROM AuthSessions WHERE UserId = ?').get(registeredUser.id);
    assert.notEqual(storedSession.TokenHash, sessionToken);
    assert.equal(storedSession.TokenHash.length, 64);
  });
  await expectProblem(await request('GET', '/api/auth/me', undefined, { Authorization: `Bearer ${'a'.repeat(64)}` }), 401);
  check('Login queries saved users, verifies passwords and returns a verifiable opaque session');

  for (const body of [
    {},
    { name: '   ', specialty: 'Nội khoa' },
    { name: 'Bác sĩ thử nghiệm', specialty: ' \t ' },
    { name: 'a'.repeat(101), specialty: 'Nội khoa' },
    { name: 'Bác sĩ thử nghiệm', specialty: 'a'.repeat(101) },
    { name: null, specialty: 'Nội khoa' },
  ]) {
    await expectProblem(await request('POST', '/api/doctors', body), 400);
  }
  check('POST rejects missing, blank, null and overlong fields');

  const createdResponse = await request('POST', '/api/doctors', {
    name: '  Nguyễn Văn Kiểm Thử  ',
    specialty: '  Nội khoa  ',
  });
  assert.equal(createdResponse.status, 201);
  const createdDoctor = await createdResponse.json();
  assert.ok(Number.isInteger(createdDoctor.id) && createdDoctor.id > 0);
  assert.equal(createdDoctor.name, 'Nguyễn Văn Kiểm Thử');
  assert.equal(createdDoctor.specialty, 'Nội khoa');
  const doctorRoute = `/api/doctors/${createdDoctor.id}`;
  assert.equal(new URL(createdResponse.headers.get('location'), baseUrl).pathname, doctorRoute);
  check('POST creates a doctor, trims input and returns a Location');

  const detailResponse = await request('GET', doctorRoute);
  assert.equal(detailResponse.status, 200);
  assert.deepEqual(await detailResponse.json(), createdDoctor);
  const afterCreate = await (await request('GET', '/api/doctors')).json();
  assert.equal(afterCreate.length, initialDoctors.length + 1);
  assert.ok(afterCreate.some((doctor) => doctor.id === createdDoctor.id));
  check('GET retrieves the created doctor by ID and in the collection');

  await expectProblem(await request('PUT', doctorRoute, { name: ' ', specialty: 'Tim mạch' }), 400);
  assert.deepEqual(await (await request('GET', doctorRoute)).json(), createdDoctor);
  check('Invalid PUT leaves the existing doctor unchanged');

  const updateResponse = await request('PUT', doctorRoute, {
    name: '  Nguyễn Văn Đã Cập Nhật  ',
    specialty: '  Tim mạch  ',
  });
  assert.equal(updateResponse.status, 200);
  const updatedDoctor = await updateResponse.json();
  assert.deepEqual(updatedDoctor, {
    id: createdDoctor.id,
    name: 'Nguyễn Văn Đã Cập Nhật',
    specialty: 'Tim mạch',
  });
  check('PUT updates the doctor and preserves its ID');

  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173']) {
    const preflight = await request('OPTIONS', doctorRoute, undefined, {
      Origin: origin,
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'content-type',
    });
    assert.ok(preflight.ok);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.match(preflight.headers.get('access-control-allow-methods') ?? '', /PUT/i);
  }
  const deniedOrigin = await request('OPTIONS', doctorRoute, undefined, {
    Origin: 'https://untrusted.example',
    'Access-Control-Request-Method': 'DELETE',
  });
  assert.equal(deniedOrigin.headers.get('access-control-allow-origin'), null);
  check('CORS allows configured React origins and excludes other origins');

  await stopApi();
  await startApi();
  assert.deepEqual(await (await request('GET', '/api/auth/me')).json(), registeredUser);
  const persistedResponse = await request('GET', doctorRoute);
  assert.equal(persistedResponse.status, 200);
  assert.deepEqual(await persistedResponse.json(), updatedDoctor);
  check('SQLite retains changes after restarting the API');

  const deletedResponse = await request('DELETE', doctorRoute);
  assert.equal(deletedResponse.status, 204);
  assert.equal(await deletedResponse.text(), '');
  await expectProblem(await request('GET', doctorRoute), 404);
  await expectProblem(await request('DELETE', doctorRoute), 404);
  await expectProblem(await request('PUT', doctorRoute, { name: 'Không tồn tại', specialty: 'Nội khoa' }), 404);
  const afterDelete = await (await request('GET', '/api/doctors')).json();
  assert.equal(afterDelete.length, initialDoctors.length);
  check('DELETE removes the doctor; missing GET, PUT and DELETE return 404');

  await stopApi();
  await startApi();
  await expectProblem(await request('GET', doctorRoute), 404);
  assert.equal((await (await request('GET', '/api/doctors')).json()).length, initialDoctors.length);
  check('Deleted data stays deleted after another restart');

  assert.equal((await request('POST', '/api/auth/logout')).status, 204);
  await expectProblem(await request('GET', '/api/auth/me'), 401);
  await expectProblem(await request('POST', '/api/doctors', { name: 'Old session', specialty: 'Test' }), 401);
  check('Logout revokes the session in the database and rejects reuse of the token');

  const nextLogin = await request('POST', '/api/auth/login', {
    email: 'member@example.com', password: credentials.password,
  });
  assert.equal(nextLogin.status, 200);
  sessionToken = (await nextLogin.json()).token;
  withDatabase((database) => database.exec("UPDATE AuthSessions SET ExpiresAtUtc = '2000-01-01 00:00:00'"));
  await expectProblem(await request('GET', '/api/auth/me'), 401);
  check('Expired sessions are rejected by the API');

  // A new database must also work (including migration snapshot validation).
  await stopApi();
  withDatabase((database) => {
    for (const table of ['AuthSessions', 'Users', 'Doctors', '__EFMigrationsHistory', '__EFMigrationsLock'])
      database.exec(`DROP TABLE IF EXISTS "${table}"`);
  });
  sessionToken = undefined;
  await startApi();
  const seeded = await (await request('GET', '/api/doctors')).json();
  assert.equal(seeded.length, 2);
  assert.equal((await request('POST', '/api/auth/register', {
    email: 'fresh@example.com', password: 'Password123!',
  })).status, 201);
  check('A fresh database creates all tables, seeds doctors and accepts registration');

  console.log(`\nAPI smoke test: ${passed} checks passed.`);
} catch (error) {
  console.error(`\nAPI smoke test failed: ${error.stack ?? error}`);
  if (apiOutput.trim()) console.error(`\nAPI process output:\n${apiOutput}`);
  process.exitCode = 1;
} finally {
  await stopApi();
  if (temporaryDirectory) {
    const resolvedDirectory = path.resolve(temporaryDirectory);
    assert.equal(path.dirname(resolvedDirectory), temporaryRoot, 'Refusing to remove a directory outside the temp root');
    assert.ok(resolvedDirectory.startsWith(temporaryPrefix), 'Refusing to remove a directory not owned by this test');
    await rm(resolvedDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  }
}
