import { useEffect, useRef, useState } from 'react';
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
  return <div aria-label="SC updates">
    <p>Current version: <strong>{state.version}</strong></p>
    {update.status === 'disabled' ? <p className="hint">Portable and preview builds use manual updates. For the portable version, close SC before replacing its EXE. Install SC to use in-app updates.</p> :
      <p className="hint">This installed copy supports in-app updates. {state.version.includes('-') ? 'This beta receives beta and stable updates.' : 'This version receives stable updates.'}</p>}
    <p role="status" aria-live="polite">{update.message}</p>
    {update.status === 'downloading' && <progress aria-label="Update download" max={100} value={update.progress ?? 0} />}
    {update.status !== 'disabled' && <><div className="update-actions">
      <button type="button" disabled={working || update.status === 'downloaded'} onClick={() => { void act('check'); }}>Check for updates</button>
      {update.status === 'available' && <button type="button" disabled={working} onClick={() => { void act('download'); }}>Download update</button>}
      {update.status === 'error' && update.version && <button type="button" disabled={working} onClick={() => { void act('download'); }}>Retry download</button>}
      {update.status === 'downloaded' && <button type="button" aria-describedby={dirty || state.settingsDirty ? 'update-draft-notice' : undefined}
        disabled={working || state.busy || dirty || state.settingsDirty} onClick={() => { void act('install'); }}>Restart and install</button>}
      </div>
      {state.busy && update.status === 'downloaded' && <p className="hint">Wait for the current answer before restarting.</p>}
      {(dirty || state.settingsDirty) && <p className="hint" id="update-draft-notice" role="note">Save your Settings changes or use Back to discard them before restarting. Reopen Updates afterward to install.</p>}
      <p className="hint">SC checks on startup. Downloads and installation start only when you choose them. Saved API keys and settings are retained.</p>
    </>}
    {error && <p className="dialog-error" role="alert">{error}</p>}
  </div>;
}
