import net from 'node:net';
import fs from 'node:fs/promises';
import { createHmac, randomUUID } from 'node:crypto';

export function signedRequest(secret, operation, args, id = randomUUID()) {
  const payload = { id, operation, args };
  return { ...payload, mac: createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex') };
}

export async function callAgent(operation, args, options = {}) {
  const socketPath = options.socketPath || process.env.LINTECH_AGENT_SOCKET || '/run/lintech-panel/agent.sock';
  const secret = options.secret || (await fs.readFile(options.secretFile || '/etc/lintech-panel/agent.secret', 'utf8')).trim();
  if (secret.length < 32) throw new Error('agent secret is invalid');
  const request = signedRequest(secret, operation, args);
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let buffer = '';
    const timer = setTimeout(() => socket.destroy(new Error('agent request timed out')), options.timeoutMs || 30_000);
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(`${JSON.stringify(request)}\n`));
    socket.on('data', chunk => { buffer += chunk; if (buffer.length > 65_536) socket.destroy(new Error('agent response too large')); });
    socket.on('end', () => {
      clearTimeout(timer);
      try { const response = JSON.parse(buffer.trim()); response.ok ? resolve(response.result) : reject(new Error(response.error || 'agent operation failed')); }
      catch (error) { reject(error); }
    });
    socket.on('error', error => { clearTimeout(timer); reject(error); });
  });
}
