import { InputError } from './security.js';

export const LIMIT_SCHEMA = Object.freeze({
  diskMb: [100, 10_000_000], bandwidthGb: [1, 1_000_000], domains: [0, 10_000],
  subdomains: [0, 100_000], databases: [0, 10_000], pythonApps: [0, 10_000],
  nodeApps: [0, 10_000], phpSites: [0, 10_000], cpuPercent: [1, 10_000],
  memoryMb: [64, 1_000_000], processes: [1, 100_000], backups: [0, 10_000], cronJobs: [0, 10_000]
});

export const DEFAULT_LIMITS = Object.freeze({
  diskMb: 1024, bandwidthGb: 10, domains: 1, subdomains: 5, databases: 1,
  pythonApps: 0, nodeApps: 0, phpSites: 1, cpuPercent: 100, memoryMb: 512,
  processes: 50, backups: 1, cronJobs: 5, terminalAccess: false
});

export function normalizeLimits(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('limits must be an object');
  const limits = { ...DEFAULT_LIMITS };
  for (const [name, [minimum, maximum]] of Object.entries(LIMIT_SCHEMA)) {
    if (value[name] === undefined) continue;
    const number = Number(value[name]);
    if (!Number.isInteger(number) || number < minimum || number > maximum) throw new InputError(`${name} is outside the allowed range`);
    limits[name] = number;
  }
  if (value.terminalAccess !== undefined) {
    if (typeof value.terminalAccess !== 'boolean') throw new InputError('terminalAccess must be boolean');
    limits.terminalAccess = value.terminalAccess;
  }
  const unknown = Object.keys(value).filter(key => !Object.hasOwn(limits, key));
  if (unknown.length) throw new InputError(`unknown limit: ${unknown[0]}`);
  return limits;
}
