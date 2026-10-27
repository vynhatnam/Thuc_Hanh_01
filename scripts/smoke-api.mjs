import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

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
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extraHeaders },
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
  await startApi();

  const initialResponse = await request('GET', '/api/doctors');
  assert.equal(initialResponse.status, 200);
  const initialDoctors = await initialResponse.json();
  assert.ok(Array.isArray(initialDoctors));
  check('GET returns the doctors collection');

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
