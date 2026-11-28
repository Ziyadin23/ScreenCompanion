import type { DesktopApi, DisplayError } from '../contracts';

declare global {
  interface Window { sc: DesktopApi; scStartup: () => Promise<DisplayError> }
}
