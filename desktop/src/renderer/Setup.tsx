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
  const [error, setError] = useState<{ type: 'key' | 'save'; message: string } | null>(null);
  const keyError = error?.type === 'key' ? error.message : '';
  const saveError = error?.type === 'save' ? error.message : '';
  const pending = useRef(false);
  const alive = useRef(true);
  const keyInput = useRef<HTMLInputElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const service = provider === 'Gemini' ? 'Google Gemini' : provider;
  async function save() {
    if (pending.current) return;
    if (!key.trim() || /[\u0000-\u001f\u007f]/.test(key)) {
      setError({ type: 'key', message: `Enter your ${service} API key without line breaks or control characters.` });
      keyInput.current?.focus();
      return;
    }
    pending.current = true; setSaving(true); setError(null);
    try { await window.sc.setup({ provider, apiKey: key.trim() }); if (alive.current) { setKey(''); setShowKey(false); } }
    catch {
      if (alive.current) setError({ type: 'save', message: platform === 'linux'
        ? 'The key could not be saved. Unlock your secure Linux keyring and try again.'
        : 'The key could not be saved. Try again.' });
    }
    finally { pending.current = false; if (alive.current) setSaving(false); }
  }
  return <VStack as="section" className="setup astryx-dialog" aria-label="Set up SC">
    <HStack as="header" className="dialog-header">
      <HStack gap={3}><Text className="app-mark" aria-hidden="true">SC</Text><Heading level={1}>Set up SC</Heading></HStack>
    </HStack>
    <form noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <VStack className="setup-content" gap={6} aria-busy={saving}>
        <VStack gap={2}>
          <Heading level={2}>Connect your service</Heading>
          <Text as="p" type="supporting">Choose your service and enter its API key to get started.</Text>
        </VStack>
        <VStack gap={4}>
          <Choice id="setup-service" label="API service" value={provider} options={PROVIDERS} disabled={saving} autoFocus
            display={(value) => value === 'Gemini' ? 'Google Gemini' : value} onChange={(value) => {
              setProvider(value as ApiProvider); setError(null); setShowKey(false); keyInput.current?.focus();
            }} />
          <VStack gap={2}>
            <TextInput ref={(input) => { keyInput.current = input; if (input) input.maxLength = 8192; }} id="setup-key" data-testid="setup-key" label={`${service} API key`}
              type={showKey ? 'text' : 'password'} autoComplete="off" hasSpellCheck={false}
              aria-invalid={!!keyError} aria-describedby={`setup-privacy${keyError ? ' setup-error' : ''}`}
              status={keyError ? { type: 'error' } : undefined} value={key} isReadOnly={saving}
              onChange={(value) => { setKey(value.slice(0, 8192)); setError(null); }} />
            {keyError && <Text as="p" className="dialog-error" id="setup-error" role="alert">{keyError}</Text>}
          </VStack>
          <CheckboxInput label="Show API key" size="sm" value={showKey} isDisabled={saving} onChange={setShowKey} />
        </VStack>
        <VStack className="privacy-notice" gap={2} padding={4}>
          <Text as="p" type="supporting" id="setup-privacy">{platform === 'linux' ? 'Your key is encrypted using your unlocked Linux keyring.' : 'Your key is encrypted for your Windows account.'} Setup saves your service and key without contacting the service or checking access. You can change them in Settings → Models &amp; API.</Text>
          {platform === 'linux' && <Text as="p" type="supporting">Unlock your desktop keyring before saving. SC windows can appear in recordings and screen shares.</Text>}
          {legacyNotice && <Text as="p" type="supporting" role="note">An older key file was found. Enter your API key once more. The old file will be left unchanged.</Text>}
        </VStack>
      </VStack>
      <Text as="p" className={saveError ? 'dialog-error' : 'sr-only'} id="setup-save-error" role="alert">{saveError}</Text>
      <HStack as="footer" className="dialog-footer">
        <Text type="supporting" className="footer-status" role="status">{saving ? 'Saving setup…' : ''}</Text>
        <Button label={saving ? 'Saving…' : 'Save'} variant="primary" type="submit" isDisabled={saving} />
        <Button label="Cancel" variant="ghost" isDisabled={saving} onClick={() => onCommand({ type: 'exit' })} />
      </HStack>
    </form>
  </VStack>;
}
