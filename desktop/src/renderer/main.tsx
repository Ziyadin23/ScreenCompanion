import { createRoot } from 'react-dom/client';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import { App } from './App';
import { StartupFailure } from './StartupFailure';
import './styles.css';

const startup = new URLSearchParams(window.location.search).get('window-role') === 'startup';
createRoot(document.getElementById('root')!).render(startup ? <StartupFailure /> : <App />);
