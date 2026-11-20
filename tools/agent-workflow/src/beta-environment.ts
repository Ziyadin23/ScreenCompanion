import { lstatSync, realpathSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { WorkflowError } from './manifest.js';

/** Only trusted beta helpers receive this transport; model-worker environments remain separate. */
export function trustedBetaHelperEnvironment(): Record<string, string> {
  const user = userInfo();
  const env: Record<string, string> = { PATH: '/usr/bin:/bin', HOME: homedir(), USER: user.username, LOGNAME: user.username };
  const denied = () => new WorkflowError('beta_capability_unavailable', 'The current-user beta credential transport is unsafe or unavailable.', 2);
  if (!Number.isSafeInteger(user.uid) || user.uid < 0) throw denied();
  const directory = `/run/user/${user.uid}`, socket = `${directory}/bus`;
  const optionalStat = (path: string) => {
    try { return lstatSync(path); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw denied(); }
  };
  const parent = optionalStat(directory);
  if (!parent) return env;
  try {
    if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== user.uid || parent.mode & 0o077 ||
        realpathSync(directory) !== directory) throw denied();
    const bus = optionalStat(socket);
    if (!bus) return env;
    if (!bus.isSocket() || bus.isSymbolicLink() || bus.uid !== user.uid || realpathSync(socket) !== socket) throw denied();
    env.DBUS_SESSION_BUS_ADDRESS = `unix:path=${socket}`;
    return env;
  } catch { throw denied(); }
}
