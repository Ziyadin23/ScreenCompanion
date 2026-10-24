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
});
