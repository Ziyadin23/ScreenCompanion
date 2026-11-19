import { describe, expect, it } from 'vitest';
import { previewBridge } from '../../preview/bridge';

describe('synthetic preview bridge', () => {
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
    await api.discardSettings();
    expect((await api.getSettingsDraft()).values.Appearance.TransparencyPercent).toBe(55);
  });
});
