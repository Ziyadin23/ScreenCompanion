import { readFileSync } from 'node:fs';
import { WorkflowError } from './manifest.js';

export function processIdentity(pid = process.pid): string | null {
  if (process.platform !== 'linux') throw new WorkflowError('unsupported_host', 'Live execution requires Linux process identity.');
  try {
    const value = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const start = value.slice(value.lastIndexOf(')') + 2).split(' ')[19];
    if (!start) throw new Error('Missing start identity');
    return `${readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim()}:${start}`;
  } catch (error) {
    if (['ENOENT', 'ESRCH'].includes((error as NodeJS.ErrnoException).code ?? '')) return null;
    throw new WorkflowError('owner_unverifiable', 'Execution ownership cannot be verified.');
  }
}
