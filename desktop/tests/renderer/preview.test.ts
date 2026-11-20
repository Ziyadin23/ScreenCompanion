import { describe, expect, it } from 'vitest';
import { previewBridge } from '../../preview/bridge';

describe('synthetic preview bridge', () => {
  it('rejects a stale Save and preserves the current preview draft', async () => {
    const { api } = previewBridge();
    const stale = await api.getSettingsDraft();
    stale.values.Appearance.TextSizePoints = 21;
    await api.command({ type: 'showInput' });
    await api.command({ type: 'settings' });
    const current = await api.getSettingsDraft();
    await api.command({ type: 'settingsDraftChanged', session: current.session, dirty: true });
    const before = await api.getState();

    await expect(api.saveSettings(stale)).rejects.toThrow();
    expect(await api.getState()).toEqual(before);
    expect(await api.getSettingsDraft()).toEqual(current);
    await expect(api.saveSettings(current)).resolves.toBe('saved');
  });

  it('retains only key-presence flags, previews appearance, and discards replacement values', async () => {
    const { api } = previewBridge();
    const draft = await api.getSettingsDraft();
    draft.keyUpdates.DeepSeek = 'synthetic-only-key';
    draft.values.Appearance.TransparencyPercent = 55;
    await api.saveSettings(draft);
    const saved = await api.getSettingsDraft();
    expect(saved.keyPresence.DeepSeek).toBe(true);
    expect(saved.keyUpdates).toEqual({});
    expect(JSON.stringify(saved)).not.toContain('synthetic-only-key');
    expect((await api.getState()).appearance.TransparencyPercent).toBe(55);
    saved.values.Appearance.TransparencyPercent = 99;
    await api.discardSettings(saved.session);
    expect((await api.getSettingsDraft()).values.Appearance.TransparencyPercent).toBe(55);
  });
});
