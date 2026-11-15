import { useEffect, useRef, useState } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import type { AppState, UpdateAction } from '../contracts';

export function Updates({ state, dirty }: { state: AppState; dirty: boolean }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const update = state.updates;
  async function act(action: UpdateAction) {
    if (running.current || (action === 'install' && (dirty || state.settingsDirty || state.busy))) return;
    running.current = true; setPending(true); setError('');
    try { await window.sc.update(action); }
    catch { if (alive.current) setError(action === 'install' ? 'The update could not be installed. Close and reopen SC, then check Updates, or run the latest installer manually.' :
      action === 'download' ? 'The download could not be started. Check your connection, then try again.' : 'The update check could not be started. Try again later.'); }
    finally { running.current = false; if (alive.current) setPending(false); }
  }
  const working = pending || ['checking', 'downloading', 'installing'].includes(update.status);
  if (state.platform === 'linux') return <VStack gap={4} aria-label="SC updates">
    <Text as="p">Current version: <strong>{state.version}</strong></Text>
    <Text as="p" className="hint">Install a newer RPM manually to update SC. Close SC before updating.</Text>
  </VStack>;
  return <VStack gap={4} aria-label="SC updates">
    <Text as="p">Current version: <strong>{state.version}</strong></Text>
    {update.status === 'disabled' ? <Text as="p" className="hint">Portable and preview builds use manual updates. For the portable version, close SC before replacing its EXE. Install SC to use in-app updates.</Text> :
      <Text as="p" className="hint">This installed copy supports in-app updates. {state.version.includes('-') ? 'This beta receives beta and stable updates.' : 'This version receives stable updates.'}</Text>}
    <Text as="p" role="status" aria-live="polite">{update.message}</Text>
    {update.status === 'downloading' && <progress aria-label="Update download" max={100} value={update.progress ?? 0} />}
    {update.status !== 'disabled' && <><HStack className="update-actions">
      <Button label="Check for updates" type="button" isDisabled={working || update.status === 'downloaded'} onClick={() => { void act('check'); }}>Check for updates</Button>
      {update.status === 'available' && <Button label="Download update" type="button" isDisabled={working} onClick={() => { void act('download'); }}>Download update</Button>}
      {update.status === 'error' && update.version && <Button label="Retry download" type="button" isDisabled={working} onClick={() => { void act('download'); }}>Retry download</Button>}
      {update.status === 'downloaded' && <Button label="Restart and install" type="button" aria-describedby={dirty || state.settingsDirty ? 'update-draft-notice' : undefined}
        isDisabled={working || state.busy || dirty || state.settingsDirty} onClick={() => { void act('install'); }}>Restart and install</Button>}
      </HStack>
      {state.busy && update.status === 'downloaded' && <Text as="p" className="hint">Wait for the current answer before restarting.</Text>}
      {(dirty || state.settingsDirty) && <Text as="p" className="hint" id="update-draft-notice" role="note">Save your Settings changes or use Back to discard them before restarting. Reopen Updates afterward to install.</Text>}
      <Text as="p" className="hint">SC checks on startup. Downloads and installation start only when you choose them. Saved API keys and settings are retained.</Text>
    </>}
    {error && <Text as="p" className="dialog-error" role="alert">{error}</Text>}
  </VStack>;
}
