import { describe, expect, it } from 'vitest';
import { previewBridge } from '../../preview/bridge';
import { PROVIDERS } from '../../src/contracts';
import { defaultModels } from '../../src/contracts/defaults';

describe('synthetic preview bridge', () => {
  it.each(PROVIDERS)('opens Settings with the service selected in %s setup', async (provider) => {
    const { api } = previewBridge('setup');
    const apiKey = 'synthetic-setup-only';
    await api.setup({ provider, apiKey });
    expect((await api.getState()).surface).toBe('answer');
    await api.command({ type: 'settings' });
    const draft = await api.getSettingsDraft();
    const models = defaultModels(provider);
    expect(draft.values.Models).toEqual(models);
    expect(draft.values.ModelPipelines).toEqual([{ Provider: provider, AnswerModel: models.AnswerModel, PipelineMode: 'Thorough' }]);
    expect(PROVIDERS.filter(service => draft.keyPresence[service])).toEqual([provider]);
    expect(JSON.stringify([draft, await api.getState()])).not.toContain(apiKey);
  });

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
