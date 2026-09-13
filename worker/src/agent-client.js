import net from 'node:net';
import fs from 'node:fs/promises';
import { createHmac, randomUUID } from 'node:crypto';

export function signedRequest(secret, operation, args, id = randomUUID()) {
  const payload = { id, operation, args };
  return { ...payload, mac: createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex') };
}

export function retryableConnectionError(error, connected = false) {
  return !connected && ['EACCES', 'ENOENT', 'ECONNREFUSED'].includes(error?.code);
}

function sendRequest(socketPath, request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath); let buffer = ''; let connected = false;
    const timer = setTimeout(() => socket.destroy(new Error('agent request timed out')), timeoutMs);
    socket.setEncoding('utf8');
    socket.on('connect', () => { connected = true; socket.write(`${JSON.stringify(request)}\n`); });
    socket.on('data', chunk => { buffer += chunk; if (buffer.length > 65_536) socket.destroy(new Error('agent response too large')); });
    socket.on('end', () => { clearTimeout(timer); try { const response = JSON.parse(buffer.trim()); response.ok ? resolve(response.result) : reject(new Error(response.error || 'agent operation failed')); } catch (error) { reject(error); } });
    socket.on('error', error => { clearTimeout(timer); error.connected = connected; reject(error); });
  });
}

export async function callAgent(operation, args, options = {}) {
  const socketPath = options.socketPath || process.env.LINTECH_AGENT_SOCKET || '/run/lintech-panel/agent.sock';
  const secret = options.secret || (await fs.readFile(options.secretFile || '/etc/lintech-panel/agent.secret', 'utf8')).trim();
  if (secret.length < 32) throw new Error('agent secret is invalid');
  const request = signedRequest(secret, operation, args);
  const attempts = options.connectionAttempts || 8;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await sendRequest(socketPath, request, options.timeoutMs || 30_000); }
    catch (error) {
      if (attempt === attempts || !retryableConnectionError(error, error.connected)) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 100));
    }
  }
  throw new Error('agent connection attempts exhausted');
}
