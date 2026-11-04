import { WorkflowError } from './manifest.js';
import { cancelOwnedProcess, inspectOwnedProcess } from './process.js';
import { type RunRecord, type RunStore } from './store.js';

export async function cancelRun(store: RunStore, id: string): Promise<RunRecord> {
  if (store.get(id).status === 'completed') return store.get(id);
  store.requestCancel(id);
  if (store.hasLiveCoordinator(id)) return store.get(id);
  try {
    const processes = store.ownedProcesses(id);
    for (const owned of processes) {
      const observed = inspectOwnedProcess(owned.stateDirectory, owned.key);
      if (observed.state === 'exited') continue;
      if (observed.state !== 'running' && observed.state !== 'pending')
        throw new WorkflowError('owner_unverifiable', 'Owned execution termination cannot be verified.');
      await cancelOwnedProcess(owned.stateDirectory, owned.key);
    }
    await store.reconcileOwnedExecutions(id);
    if (store.hasLiveCoordinator(id)) return store.get(id);
    store.update(id, { status: 'cancelled', error: 'cancelled' });
  } catch {
    store.update(id, { status: 'quarantined', error: 'owner_unverifiable' });
  }
  return store.get(id);
}
