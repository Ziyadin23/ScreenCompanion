import { createRoot } from 'react-dom/client';
import { Theme } from '@astryxdesign/core/theme';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import { themes, defaultThemeSlug } from '../src/astryx-themes';
import { App } from '../src/renderer/App';
import '../src/renderer/styles.css';
import './preview.css';
import { previewBridge } from './bridge';

const params = new URLSearchParams(location.search);
const bridge = previewBridge(params.get('surface') === 'setup' ? 'setup' : 'settings', params.get('platform') === 'linux' ? 'linux' : 'windows');
window.sc = bridge.api;

createRoot(document.getElementById('root')!).render(
  <Theme theme={themes[defaultThemeSlug]} mode="dark">
    <VStack className="preview-shell">
      <HStack as="header" className="preview-toolbar" gap={2} wrap="wrap" hAlign="between">
        <Text type="supporting">Synthetic preview · changes stay in memory</Text>
        <HStack gap={1}>
          <Button label="Settings preview" size="sm" variant="ghost" onClick={() => bridge.open('settings')}>Settings</Button>
          <Button label="Setup preview" size="sm" variant="ghost" onClick={() => bridge.open('setup')}>Setup</Button>
        </HStack>
      </HStack>
      <VStack className="preview-frame"><App /></VStack>
    </VStack>
  </Theme>
);
