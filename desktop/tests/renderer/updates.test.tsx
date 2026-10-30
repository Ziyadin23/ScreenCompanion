// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/renderer/App';
import { fixture } from './fixture';

afterEach(cleanup);
async function openUpdates() {
  await act(async () => window.sc.command({ type: 'settings' }));
  fireEvent.click(await screen.findByRole('tab', { name: 'Updates' }));
  await screen.findByLabelText('SC updates');
}
describe('update controls in Settings', () => {
  it('checks and downloads explicitly, displays progress, then offers a restart', async () => {
    const f = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openUpdates();
    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
    await waitFor(() => expect(f.api.update).toHaveBeenCalledExactlyOnceWith('check'));
    expect(f.api.saveSettings).not.toHaveBeenCalled();
    await act(async () => f.emit({ updates: { status: 'available', version: '0.5.0-beta.4', progress: null, message: 'SC 0.5.0-beta.4 is available.' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Download update' }));
    await waitFor(() => expect(f.api.update).toHaveBeenLastCalledWith('download'));
    await act(async () => f.emit({ updates: { status: 'downloading', version: '0.5.0-beta.4', progress: 42, message: 'Downloading update… 42%' } }));
    expect((screen.getByRole('progressbar', { name: 'Update download' }) as HTMLProgressElement).value).toBe(42);
    expect((screen.getByRole('button', { name: 'Check for updates' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => f.emit({ updates: { status: 'downloaded', version: '0.5.0-beta.4', progress: 100, message: 'Ready to install.' }, busy: true }));
    expect((screen.getByRole('button', { name: 'Restart and install' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => f.emit({ busy: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Restart and install' }));
    await waitFor(() => expect(f.api.update).toHaveBeenLastCalledWith('install'));
    expect(f.getState().answer).toBe('Synthetic SC answer');
  });
  it('explains the installer requirement for portable and preview builds', async () => {
    fixture({ updates: { status: 'disabled', version: null, progress: null, message: 'In-app updates are available in the installed Windows version of SC.' } });
    render(<App />); await screen.findByTestId('answer-text'); await openUpdates();
    expect(screen.getByText('In-app updates are available in the installed Windows version of SC.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check for updates' })).toBeNull();
    expect(screen.getByText(/close SC before replacing its EXE/)).toBeTruthy();
    expect(screen.queryByText(/Installed version:/)).toBeNull();
  });
  it('retains Settings drafts and the answer across update status changes and failures', async () => {
    const f = fixture(); render(<App />); await screen.findByTestId('answer-text');
    await act(async () => window.sc.command({ type: 'settings' }));
    const instruction = await screen.findByRole('textbox', { name: 'Custom instruction' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Answer mode' })); fireEvent.click(screen.getByRole('option', { name: 'Custom' }));
    fireEvent.change(instruction, { target: { value: 'Temporary draft' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Updates' }));
    await act(async () => f.emit({ updates: { status: 'error', version: null, progress: null, message: 'Try again later.' } }));
    fireEvent.click(screen.getByRole('tab', { name: 'Answer & shortcuts' }));
    expect((screen.getByRole('textbox', { name: 'Custom instruction' }) as HTMLTextAreaElement).value).toBe('Temporary draft');
    fireEvent.click(screen.getByTestId('settings-back'));
    await screen.findByTestId('answer-text');
    expect(f.api.saveSettings).not.toHaveBeenCalled(); expect(f.getState().answer).toBe('Synthetic SC answer');
  });
  it('blocks restart with Settings edits across page, visibility and update changes until Back discards', async () => {
    const f = fixture({ updates: { status: 'downloaded', version: '0.5.0-beta.4', progress: 100, message: 'Ready to install.' } });
    render(<App />); await screen.findByTestId('answer-text');
    await act(async () => window.sc.command({ type: 'settings' }));
    fireEvent.click(await screen.findByRole('combobox', { name: 'Answer mode' }));
    fireEvent.click(screen.getByRole('option', { name: 'Brief' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Updates' }));
    const restart = screen.getByRole('button', { name: 'Restart and install' }) as HTMLButtonElement;
    expect(restart.disabled).toBe(true); expect(restart.getAttribute('aria-describedby')).toBe('update-draft-notice');
    expect(screen.getByRole('note').textContent).toContain('Save your Settings changes or use Back');
    await act(async () => f.emit({ visible: false })); await act(async () => f.emit({ visible: true }));
    // A stale host snapshot cannot enable restart ahead of the local draft notification.
    await act(async () => f.emit({ settingsDirty: false }));
    expect(restart.disabled).toBe(true); fireEvent.click(restart); expect(f.api.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('settings-back')); await screen.findByTestId('answer-text');
    await openUpdates(); expect((screen.getByRole('button', { name: 'Restart and install' }) as HTMLButtonElement).disabled).toBe(false);
    expect(f.api.command).toHaveBeenCalledWith({ type: 'settingsDraftChanged', dirty: false });
  });
  it('keeps restart blocked after a failed Save and allows it after a successful Save', async () => {
    const f = fixture({ updates: { status: 'downloaded', version: '0.5.0-beta.4', progress: 100, message: 'Ready to install.' } });
    f.api.saveSettings.mockRejectedValueOnce(new Error('private save detail'));
    render(<App />); await screen.findByTestId('answer-text');
    await act(async () => window.sc.command({ type: 'settings' }));
    fireEvent.click(await screen.findByRole('combobox', { name: 'Answer mode' })); fireEvent.click(screen.getByRole('option', { name: 'Brief' }));
    fireEvent.click(screen.getByTestId('settings-save')); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('tab', { name: 'Updates' }));
    expect((screen.getByRole('button', { name: 'Restart and install' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('settings-save')); await screen.findByTestId('answer-text');
    await openUpdates(); fireEvent.click(screen.getByRole('button', { name: 'Restart and install' }));
    await waitFor(() => expect(f.api.update).toHaveBeenCalledExactlyOnceWith('install'));
  });
  it('offers an explicit retry for a failed download with a retained version', async () => {
    const f = fixture({ updates: { status: 'error', version: '0.5.0-beta.4', progress: null, message: 'The download failed. Try again.' } });
    render(<App />); await screen.findByTestId('answer-text'); await openUpdates();
    expect(f.api.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry download' }));
    await waitFor(() => expect(f.api.update).toHaveBeenCalledExactlyOnceWith('download'));
    expect(screen.queryByRole('button', { name: 'Restart and install' })).toBeNull();
  });
  it('keeps install failures safe and directs recovery through reopen or the installer', async () => {
    const f = fixture({ updates: { status: 'downloaded', version: '0.5.0-beta.4', progress: 100, message: 'Ready to install.' } });
    f.api.update.mockRejectedValueOnce(new Error('private updater path'));
    render(<App />); await screen.findByTestId('answer-text'); await openUpdates();
    fireEvent.click(screen.getByRole('button', { name: 'Restart and install' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Close and reopen SC');
    expect(document.body.textContent).not.toContain('private updater path');
  });
});
