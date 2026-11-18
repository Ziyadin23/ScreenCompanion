import { useEffect, useRef, useState } from 'react';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Button } from '@astryxdesign/core/Button';
import type { ApiProvider, AppCommand, AppState } from '../contracts';
import { PROVIDERS } from '../contracts';
import { Choice } from './Choice';

export function Setup({ legacyNotice, platform, onCommand }: { legacyNotice: boolean; platform: AppState['platform']; onCommand: (command: AppCommand) => void }) {
  const [provider, setProvider] = useState<ApiProvider>('OpenAI');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const alive = useRef(true);
  const keyInput = useRef<HTMLInputElement>(null);
  const keyGroup = useRef<HTMLDivElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const service = provider === 'Gemini' ? 'Google Gemini' : provider;
  function revealKeyGroup() {
    keyGroup.current?.scrollIntoView?.({ block: 'nearest' });
  }
  async function save() {
    if (pending.current) return;
    if (!key.trim() || /[\u0000-\u001f\u007f]/.test(key)) {
      setError(`Enter your ${service} API key without line breaks or control characters.`);
      keyInput.current?.focus({ preventScroll: true });
      requestAnimationFrame(revealKeyGroup);
      return;
    }
    pending.current = true; setSaving(true); setError('');
    try { await window.sc.setup({ provider, apiKey: key.trim() }); if (alive.current) { setKey(''); setShowKey(false); } }
    catch { if (alive.current) setError(platform === 'linux' ? 'The key could not be saved. Unlock your secure Linux keyring and try again.' : 'The key could not be saved. Try again.'); }
    finally { pending.current = false; if (alive.current) setSaving(false); }
  }
  return <VStack as="section" className="setup astryx-dialog" aria-label="Set up SC" aria-busy={saving}>
    <HStack as="header" className="dialog-header">
      <HStack gap={3}><Text className="app-mark" aria-hidden="true">SC</Text><Heading level={1}>Set up SC</Heading></HStack>
    </HStack>
    <form noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <VStack className="setup-content" gap={4}>
        <VStack gap={2}>
          <Heading level={2}>Connect your service</Heading>
          <Text as="p" type="supporting">Choose your service and enter its API key to get started.</Text>
        </VStack>
        <VStack ref={keyGroup} gap={3}>
          <Choice id="setup-service" label="API service" value={provider} options={PROVIDERS} disabled={saving} autoFocus
            display={(value) => value === 'Gemini' ? 'Google Gemini' : value} onChange={(value) => {
              setProvider(value as ApiProvider); setError(''); setShowKey(false); keyInput.current?.focus();
            }} />
          <TextInput ref={(input) => { keyInput.current = input; if (input) input.maxLength = 8192; }} id="setup-key" data-testid="setup-key" label={`${service} API key`}
            description={platform === 'linux' ? 'Unlock your desktop keyring before saving.' : undefined}
            type={showKey ? 'text' : 'password'} autoComplete="off" hasSpellCheck={false}
            aria-invalid={!!error} aria-describedby={`setup-privacy${error ? ' setup-error' : ''}`}
            status={error ? { type: 'error' } : undefined} value={key} isDisabled={saving}
            onChange={(value) => { setKey(value.slice(0, 8192)); setError(''); }} />
          <CheckboxInput label="Show API key" size="sm" value={showKey} isDisabled={saving} onChange={setShowKey} />
        </VStack>
        <VStack className="privacy-notice" gap={2} padding={4}>
          <Text as="p" type="supporting" id="setup-privacy">{platform === 'linux' ? 'Your key is encrypted using your unlocked Linux keyring.' : 'Your key is encrypted for your Windows account.'} Setup saves your service and key without contacting the service or checking access. You can change them in Settings → Models &amp; API.</Text>
          {platform === 'linux' && <Text as="p" type="supporting">SC windows can appear in recordings and screen shares.</Text>}
          {legacyNotice && <Text as="p" type="supporting" role="note">An older key file was found. Enter your API key once more. The old file will be left unchanged.</Text>}
        </VStack>
        {error && <Text as="p" className="dialog-error" id="setup-error" role="alert">{error}</Text>}
      </VStack>
      <HStack as="footer" className="dialog-footer">
        <Text type="supporting" className="footer-status" role="status">{saving ? 'Saving setup…' : ''}</Text>
        <Button label={saving ? 'Saving…' : 'Save'} variant="primary" type="submit" isDisabled={saving} />
        <Button label="Cancel" variant="ghost" isDisabled={saving} onClick={() => onCommand({ type: 'exit' })} />
      </HStack>
    </form>
  </VStack>;
}
