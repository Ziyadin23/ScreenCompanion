import { useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';

const LABEL = 'Copy diagnostic details';

export function CopyDiagnostic({ surface, reportId }: { surface: 'answer' | 'input' | 'settings'; reportId: string }) {
  const latest = useRef(0);
  const [notice, setNotice] = useState<{ attempt: number; copied: boolean } | null>(null);
  async function copy() {
    const attempt = ++latest.current;
    let copied = false;
    try { copied = await window.sc.command({ type: 'copyDiagnostic', surface, reportId }) === 'copied'; }
    catch { /* Announce the failure and leave the button available for retry. */ }
    if (attempt === latest.current) setNotice({ attempt, copied });
  }
  const message = notice?.copied ? 'Copied.' : 'Try again.';
  if (surface === 'settings') return <HStack className="inline-actions settings-diagnostic-copy" align="center">
    <Button type="button" variant="secondary" label={LABEL} onClick={() => { void copy(); }}>{LABEL}</Button>
    <Text type="supporting" role="status">{notice && <Text key={notice.attempt} type="inherit">{message}</Text>}</Text>
  </HStack>;
  return <p className="panel-diagnostic">
    <button type="button" onMouseDown={event => { if (event.button === 0) event.preventDefault(); }}
      onClick={() => { void copy(); }}>{LABEL}</button>
    <span role="status">{notice && <span key={notice.attempt}>{message}</span>}</span>
  </p>;
}
