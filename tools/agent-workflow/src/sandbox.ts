import { type OwnedProcessRequest } from './process.js';
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { WorkflowError } from './manifest.js';

export interface SandboxOptions {
  workspace: string; revision: string; writable: boolean; stateDirectory: string;
  authFile?: string; nativeBinary?: string; schemaFile?: string; scriptFile?: string; network?: boolean;
  nativeHelpers?: { codeModeHost: string; execServer: string };
  openspecBinary?: string;
  verificationOutputs?: 'application' | 'tool' | 'both';
}
export interface Sandbox {
  request(program: string, args: string[]): Pick<OwnedProcessRequest, 'command' | 'args' | 'cwd' | 'env'>;
  dispose(): void;
}
export function prepareSandbox(options: SandboxOptions): Sandbox {
  if (process.platform !== 'linux' || !existsSync('/usr/bin/bwrap'))
    throw new WorkflowError('sandbox_unavailable', 'The Linux bubblewrap execution profile is unavailable.', 2);
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(options.revision))
    throw new WorkflowError('invalid_source', 'Sandbox source revision is invalid.');
  const workspace = realpathSync(options.workspace);
  if (options.verificationOutputs && (options.writable || options.authFile))
    throw new WorkflowError('invalid_sandbox', 'Trusted verification output mounts require a credential-free read-only source.');
  const state = realpathSync(options.stateDirectory);
  const stateInfo = lstatSync(state);
  if (!stateInfo.isDirectory() || (stateInfo.mode & 0o077) || state === workspace || state.startsWith(`${workspace}/`))
    throw new WorkflowError('unsafe_state_path', 'Sandbox staging must be private and outside its workspace.');
  const staging = mkdtempSync(join(state, 'sandbox-'));
  const seed = join(staging, 'git');
  const cleanEnv = { PATH: '/usr/bin:/bin', HOME: staging, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  const git = (...args: string[]) => execFileSync('/usr/bin/git', args, {
    encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'pipe'], env: cleanEnv
  }).trim();
  try {
    const common = git('-C', workspace, 'rev-parse', '--path-format=absolute', '--git-common-dir');
    const objects = realpathSync(join(common, 'objects'));
    git('init', '--bare', '--quiet', '--template=', seed);
    execFileSync('/usr/bin/git', ['--git-dir', seed, '-c', 'core.bare=false', 'read-tree', options.revision], {
      cwd: workspace, stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000,
      env: { ...cleanEnv, GIT_WORK_TREE: workspace, GIT_ALTERNATE_OBJECT_DIRECTORIES: objects }
    });
    writeFileSync(join(seed, 'HEAD'), `${options.revision}\n`, { mode: 0o600 });
    writeFileSync(join(seed, 'config'), '[core]\nrepositoryformatversion=0\nbare=false\nworktree=/workspace\n', { mode: 0o600 });
    mkdirSync(join(seed, 'objects', 'info'), { recursive: true });
    writeFileSync(join(seed, 'objects', 'info', 'alternates'), '/run/sc-source-objects\n', { mode: 0o600 });
    const pointer = join(staging, 'git-pointer');
    writeFileSync(pointer, 'gitdir: /run/sc-git\n', { mode: 0o600 });
    const empty = join(staging, 'empty');
    writeFileSync(empty, '', { mode: 0o600 });
    const base = ['--unshare-user', '--unshare-pid', '--unshare-ipc', '--unshare-uts',
      '--die-with-parent', '--cap-drop', 'ALL', '--clearenv'];
    if (!(options.network ?? Boolean(options.authFile))) base.push('--unshare-net');
    for (const path of ['/usr', '/bin', '/lib', '/lib64'])
      if (existsSync(path)) base.push('--ro-bind', path, path);
    base.push('--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--tmpfs', '/run',
      '--dir', '/home', '--tmpfs', '/home/worker', '--dir', '/home/worker/.codex');
    for (const path of ['/etc/resolv.conf', '/etc/hosts', '/etc/nsswitch.conf', '/etc/ssl/certs',
      '/etc/ssl/cert.pem', '/etc/pki/ca-trust/extracted', '/etc/pki/tls/certs'])
      if (existsSync(path)) base.push('--ro-bind', path, path);
    base.push(options.writable ? '--bind' : '--ro-bind', workspace, '/workspace',
      '--ro-bind', seed, '/run/sc-git', '--ro-bind', objects, '/run/sc-source-objects');
    base.push('--ro-bind', lstatSync(join(workspace, '.git')).isDirectory() ? seed : pointer, '/workspace/.git');
    if (options.verificationOutputs) {
      if (options.verificationOutputs !== 'tool')
        base.push('--dir', '/opt', '--setenv', 'OPENSSL_CONF', '/dev/null');
      const outputs = [
        ...(options.verificationOutputs === 'tool' ? [] :
          ['desktop/out', 'desktop/node_modules/.vite', 'desktop/node_modules/.vite-temp', 'desktop/node_modules/.cache']),
        ...(options.verificationOutputs === 'application' ? [] :
          ['tools/agent-workflow/dist', 'tools/agent-workflow/.cache', 'tools/agent-workflow/node_modules/.cache'])
      ];
      for (const path of outputs) {
        const host = join(workspace, path);
        if (realpathSync(dirname(host)) !== dirname(host))
          throw new WorkflowError('unsafe_output_path', 'Generated verification output has an external parent.');
        if (!existsSync(host)) mkdirSync(host);
        if (existsSync(host)) {
          const info = lstatSync(host);
          if (!info.isDirectory() || info.isSymbolicLink() || realpathSync(host) !== host)
            throw new WorkflowError('unsafe_output_path', 'Generated verification output is not a local directory.');
        }
        base.push('--tmpfs', `/workspace/${path}`);
      }
    }
    if (options.authFile) {
      const ignored = execFileSync('/usr/bin/git', ['-C', workspace, 'ls-files', '--others', '--ignored',
        '--exclude-standard', '--directory', '-z'], { encoding: 'utf8', timeout: 10_000,
        maxBuffer: 1_000_000, env: cleanEnv }).split('\0').filter(Boolean);
      for (const path of ignored) {
        if (isAbsolute(path) || path.split('/').some(part => part === '..') || path.includes('\n'))
          throw new WorkflowError('invalid_source', 'Ignored source paths cannot be safely masked.');
        if (path.endsWith('/')) base.push('--tmpfs', `/workspace/${path.slice(0, -1)}`);
        else base.push('--ro-bind', empty, `/workspace/${path}`);
      }
    }
    if (options.authFile) {
      const auth = realpathSync(options.authFile);
      const info = lstatSync(auth);
      if (!info.isFile() || (info.mode & 0o077) || info.size > 64_000 ||
          (process.getuid && info.uid !== process.getuid()))
        throw new WorkflowError('unsafe_model_auth', 'Selected model authentication must be a private file.', 2);
      let supported = false;
      try {
        const shape = JSON.parse(readFileSync(auth, 'utf8')) as Record<string, unknown>;
        supported = (shape.auth_mode === 'apikey' && typeof shape.OPENAI_API_KEY === 'string' && shape.OPENAI_API_KEY.length > 0) ||
          (shape.auth_mode === 'chatgpt' && !!shape.tokens && typeof shape.tokens === 'object' && !Array.isArray(shape.tokens));
      } catch { /* Invalid auth is a missing capability; its bytes never enter the journal. */ }
      if (!supported) throw new WorkflowError('unsafe_model_auth', 'Selected authentication mode is unavailable in this file-only execution profile.', 2);
      base.push('--ro-bind', auth, '/home/worker/.codex/auth.json');
    }
    const binaries = [[options.nativeBinary, '/run/sc-codex'],
      [options.nativeHelpers?.codeModeHost, '/run/codex-code-mode-host'],
      [options.nativeHelpers?.execServer, '/run/codex-exec-server'],
      [options.openspecBinary, '/run/sc-openspec']] as const;
    for (const [input, target] of binaries) {
      if (!input) continue;
      const binary = realpathSync(input);
      const fd = openSync(binary, 'r'); const header = Buffer.alloc(4);
      try { readSync(fd, header); } finally { closeSync(fd); }
      if (!header.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])))
        throw new WorkflowError('unsupported_backend', 'This execution profile requires a native Codex binary.', 2);
      base.push('--ro-bind', binary, target);
      if (target === '/run/sc-openspec') base.push('--ro-bind', binary, '/run/openspec');
    }
    for (const [input, target] of [[options.schemaFile, '/run/sc-output-schema.json'],
      [options.scriptFile, '/run/sc-oracle.mjs']] as const) {
      if (!input) continue;
      const source = realpathSync(input);
      const info = lstatSync(source);
      if (!info.isFile() || (info.mode & 0o077))
        throw new WorkflowError('unsafe_schema', 'Invocation input must be a private regular file.', 2);
      base.push('--ro-bind', source, target);
    }
    const env = { PATH: '/run:/usr/bin:/bin', HOME: '/home/worker', USER: 'worker', SHELL: '/bin/bash',
      CODEX_HOME: '/home/worker/.codex',
      GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_OPTIONAL_LOCKS: '0',
      LANGSMITH_TRACING: 'false', LANGCHAIN_TRACING_V2: 'false', OPENSPEC_TELEMETRY: '0' };
    for (const [name, value] of Object.entries(env)) base.push('--setenv', name, value);
    base.push('--chdir', '/workspace');
    return {
      request(program, args) {
        if (!isAbsolute(program)) throw new WorkflowError('invalid_command', 'Sandbox program must be absolute.');
        return { command: '/usr/bin/bwrap', args: [...base, '--', program, ...args], cwd: workspace,
          env: { PATH: '/usr/bin:/bin' } };
      },
      dispose() { rmSync(staging, { recursive: true, force: true }); }
    };
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError('sandbox_unavailable', 'The selected source cannot be isolated with this execution profile.', 2);
  }
}
