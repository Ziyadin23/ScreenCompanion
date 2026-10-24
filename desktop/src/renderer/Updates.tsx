import { useRef, useState } from 'react';
import type { AppState, UpdateAction } from '../contracts';

export function Updates({ state }: { state: AppState }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const update = state.updates;
  async function act(action: UpdateAction) {
    if (running.current) return;
    running.current = true; setPending(true); setError('');
    try { await window.sc.update(action); }
    catch { setError('This action could not be completed. Finish the current request or settings action, then try again.'); }
    finally { running.current = false; setPending(false); }
  }
  const working = pending || ['checking', 'downloading', 'installing'].includes(update.status);
  return <div aria-label="SC updates">
    <h2>Updates</h2>
    <p>Installed version: <strong>{state.version}</strong></p>
    <p className="hint">{state.version.includes('-') ? 'This beta receives beta and stable updates.' : 'This version receives stable updates.'}</p>
    <p role="status" aria-live="polite">{update.message}</p>
    {update.status === 'downloading' && <progress aria-label="Update download" max={100} value={update.progress ?? 0} />}
    {update.status !== 'disabled' && <><div className="update-actions">
      <button type="button" disabled={working || update.status === 'downloaded'} onClick={() => { void act('check'); }}>Check for updates</button>
      {update.status === 'available' && <button type="button" disabled={working} onClick={() => { void act('download'); }}>Download update</button>}
      {update.status === 'downloaded' && <button type="button" disabled={working || state.busy} onClick={() => { void act('install'); }}>Restart and install</button>}
      </div>
      {state.busy && update.status === 'downloaded' && <p className="hint">Wait for the current answer before restarting.</p>}
      <p className="hint">SC checks on startup. Downloads and installation start only when you choose them. Saved API keys and settings are retained. Save any Settings edits before restarting.</p>
    </>}
    {error && <p className="dialog-error" role="alert">{error}</p>}
  </div>;
}
