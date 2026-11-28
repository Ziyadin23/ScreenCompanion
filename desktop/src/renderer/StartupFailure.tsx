import { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Theme } from '@astryxdesign/core/theme';
import type { DisplayError } from '../contracts';
import { themes, defaultThemeSlug } from '../astryx-themes';
import { CopyDiagnostic } from './CopyDiagnostic';

function close() { void window.sc.command({ type: 'exit' }); }

export function StartupFailure() {
  const [report, setReport] = useState<DisplayError | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    void window.scStartup().then(setReport).catch(() => setLoadFailed(true));
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) close();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return <Theme theme={themes[defaultThemeSlug]} mode="dark">
    <VStack as="main" className="startup-error" gap={3} align="start">
      <Heading level={1}>SC could not start</Heading>
      {loadFailed && <Text as="p" role="alert">Close and reopen SC.</Text>}
      {report && <>
        <Text as="p">{report.message}</Text>
        <Text as="p">Code: {report.code}<br />Report ID: {report.reportId}</Text>
        <CopyDiagnostic surface="startup" reportId={report.reportId} />
        <Text as="p" type="supporting">Paste the details before you close this window.</Text>
      </>}
      <Button type="button" variant="secondary" label="Close" onClick={close}>Close</Button>
    </VStack>
  </Theme>;
}
