import net from 'node:net';
import fs from 'node:fs';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { executeOperation } from './operations.js';

const socketPath = process.env.LINTECH_AGENT_SOCKET || '/run/lintech-panel/agent.sock';
const socketGroup = process.env.LINTECH_AGENT_GROUP || 'lintech';
const secret = process.env.LINTECH_AGENT_SECRET;
if (!secret || secret.length < 32) throw new Error('LINTECH_AGENT_SECRET (32+ characters) is required');
try { fs.unlinkSync(socketPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }

function validMac(payload, supplied = '') {
  const expected = createHmac('sha256', secret).update(JSON.stringify(payload)).digest();
  let actual; try { actual = Buffer.from(supplied, 'hex'); } catch { return false; }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const server = net.createServer(socket => {
  let buffer = ''; socket.setTimeout(300_000); socket.setEncoding('utf8');
  socket.on('data', async chunk => {
    buffer += chunk; if (buffer.length > 65_536) return socket.destroy();
    const newline = buffer.indexOf('\n'); if (newline < 0) return;
    const line = buffer.slice(0, newline); buffer = '';
    try {
      const request = JSON.parse(line);
      const payload = { id: request.id, operation: request.operation, args: request.args };
      if (!validMac(payload, request.mac)) throw new Error('authentication failed');
      const result = await executeOperation(request.operation, request.args);
      socket.end(`${JSON.stringify({ id: request.id, ok: true, result })}\n`);
    } catch (error) { socket.end(`${JSON.stringify({ ok: false, error: error.message.slice(0, 1000) })}\n`); }
  });
});
server.listen(socketPath, () => {
  const group = fs.readFileSync('/etc/group', 'utf8').split('\n').find(line => line.startsWith(`${socketGroup}:`));
  if (!group) throw new Error(`agent socket group ${socketGroup} does not exist`);
  fs.chownSync(socketPath, 0, Number(group.split(':')[2])); fs.chmodSync(socketPath, 0o660);
  console.log(`LinTech agent listening on ${socketPath}`);
});
