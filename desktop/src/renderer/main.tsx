import { createRoot } from 'react-dom/client';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);
