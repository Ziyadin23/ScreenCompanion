import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

/** Fixed dialog palette; the answer panel keeps the user's saved appearance. */
export const scCompactTheme = defineTheme({
  name: 'sc-compact',
  extends: neutralTheme,
  typography: {
    scale: { base: 13, ratio: 1.16 },
    body: { family: 'Segoe UI', fallbacks: '"Noto Sans", sans-serif' },
    heading: { family: 'Segoe UI', fallbacks: '"Noto Sans", sans-serif' }
  },
  radius: { base: 4, multiplier: 1 },
  tokens: {
    '--color-background-body': '#1c1d20',
    '--color-background-surface': '#25262b',
    '--color-background-card': '#25262b',
    '--color-background-muted': '#18191c',
    '--color-background-popover': '#25262b',
    '--color-text-primary': '#f2f3f5',
    '--color-text-secondary': '#a9acb5',
    '--color-icon-primary': '#f2f3f5',
    '--color-icon-secondary': '#a9acb5',
    '--color-border': '#36383f',
    '--color-border-emphasized': '#51545f',
    '--color-accent': '#385785',
    '--color-accent-muted': '#2b303b',
    '--color-on-accent': '#ffffff',
    '--color-text-accent': '#d9e6fb',
    '--color-icon-accent': '#9ab9ed',
    '--color-text-error': '#f6c1b4',
    '--color-border-error': '#efb5a7',
    '--color-error-muted': '#352725',
    '--color-on-error-muted': '#f6c1b4',
    '--text-heading-1-size': '15px',
    '--text-heading-2-size': '20px',
    '--text-heading-3-size': '13px',
    '--text-supporting-size': '12px',
    '--size-element-sm': '32px',
    '--size-element-md': '36px',
    '--radius-element': '8px',
    '--radius-container': '12px'
  },
  components: {
    button: { base: { fontWeight: '500' } }
  }
});
