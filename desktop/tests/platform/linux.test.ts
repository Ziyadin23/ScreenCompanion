import { describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../../src/contracts/defaults';
import { createLinuxPlatform } from '../../src/platform';

function fixture() {
  let secondInstance: ((event: unknown, argv: string[]) => void) | undefined;
  const app = { requestSingleInstanceLock: () => true,
    on: (_name: 'second-instance', listener: typeof secondInstance) => { secondInstance = listener; },
    removeListener: () => { secondInstance = undefined; } };
  const crop = vi.fn(() => ({ toJPEG: () => Buffer.from('synthetic-crop') }));
  const image = { isEmpty: () => false, getSize: () => ({ width: 1000, height: 500 }), crop };
  const platform = createLinuxPlatform({ app, argv: [], capture: async () => ({ jpeg: Buffer.from('synthetic-frame'), bounds: { x: 0, y: 0, width: 1000, height: 500 } }),
    imageFromBuffer: () => image, cryptor: { protectData: data => data, unprotectData: data => data },
    transport: { send: async () => ({ status: 200, headers: {}, body: Buffer.alloc(0) }) } });
  return { platform, crop, launch: (args: string[]) => secondInstance?.(null, args) };
}

describe('Linux platform behavior with synthetic desktop boundaries', () => {
  it('restores a duplicate launch and queues a compositor action until initialization completes', async () => {
    const f = fixture(), activate = vi.fn(), action = vi.fn();
    expect(await f.platform.acquireInstance(activate)).toBe(true);
    f.launch(['sc']); f.launch(['sc', '--action=capture']);
    expect(activate).toHaveBeenCalledOnce(); expect(action).not.toHaveBeenCalled();
    await f.platform.applyShortcuts(defaultSettings('synthetic'), false, action);
    expect(action).not.toHaveBeenCalled(); f.platform.ready?.();
    expect(action).toHaveBeenCalledExactlyOnceWith('capture');
    f.platform.dispose(); f.launch(['sc']); expect(activate).toHaveBeenCalledOnce();
  });
  it('crops the selected frame using the existing floor/ceiling pixel contract', async () => {
    const f = fixture();
    expect(await f.platform.crop(Buffer.from('synthetic-jpeg'), { x: .125, y: .25, width: .25, height: .25 })).toEqual(Buffer.from('synthetic-crop'));
    expect(f.crop).toHaveBeenCalledWith({ x: 125, y: 125, width: 250, height: 125 });
    await expect(f.platform.crop(Buffer.from('synthetic-jpeg'), { x: .9, y: 0, width: .2, height: 1 })).rejects.toThrow();
  });
});
