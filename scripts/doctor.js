import fs from 'node:fs/promises';

const url = process.env.LINTECH_URL || 'http://127.0.0.1:8080';
const attempts = Number(process.env.LINTECH_DOCTOR_ATTEMPTS || 15);
const delayMs = Number(process.env.LINTECH_DOCTOR_DELAY_MS || 1000);
let failed = false;

function errorMessage(error) {
  const cause = error?.cause;
  return cause?.code ? `${error.message} (${cause.code}: ${cause.message})` : error.message;
}

async function checkApi() {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) });
      const body = await response.json();
      if (!response.ok || body.status !== 'ok') throw new Error(`unhealthy HTTP response (${response.status})`);
      console.log(`PASS API ${body.version} (attempt ${attempt}/${attempts})`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  console.error(`FAIL API after ${attempts} attempts: ${errorMessage(lastError)}`);
  failed = true;
}

await checkApi();
if (process.platform === 'linux') {
  for (const item of ['/etc/lintech-panel/panel.env', '/var/lib/lintech-panel']) {
    try { await fs.access(item); console.log(`PASS ${item}`); }
    catch { console.error(`FAIL missing ${item}`); failed = true; }
  }
} else {
  console.log('SKIP Linux service and permission checks on non-Linux host');
}
process.exitCode = failed ? 1 : 0;
