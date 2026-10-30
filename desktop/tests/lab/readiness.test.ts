import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CapturedFrame, PixelBounds } from '../../src/contracts';
import { bitmap, comparePresentation, PresentationDeadline, PresentationError, questionPixels, READINESS, waitForNativePresentation,
  type Bitmap, type PresentationGeometry, type PresentationSource } from './readiness';

const owned = new Set<Buffer>();
function own(bytes: Buffer): Buffer { owned.add(bytes); return bytes; }
const full: PixelBounds = { x: 0, y: 0, width: 640, height: 256 };
function synthetic(variant = 0): Bitmap {
  const image = bitmap(own(Buffer.alloc(full.width * full.height * 4, 255)), full.width, full.height);
  // Abstract strokes at many positions; no capture, text, answer or fixture HTML is stored.
  for (let y = 16; y < 240; ++y) for (let x = 16; x < 624; ++x) {
    if ((y % 32 < 7 && (x + variant * 21) % 80 < 47) || x >= 16 + variant * 18 && x < 21 + variant * 18) {
      const i = (y * image.width + x) * 4;
      image.bytes[i] = 68; image.bytes[i + 1] = 43; image.bytes[i + 2] = 24;
    }
  }
  return image;
}
function copy(image: Bitmap): Bitmap { return bitmap(own(Buffer.from(image.bytes)), image.width, image.height); }
function geometry(): PresentationGeometry {
  return { generation: 1, current: true, focused: true, layoutFits: true,
    monitor: { ...full }, windowMonitor: { ...full }, displayPixels: { ...full }, displayDip: { ...full }, contentDip: { ...full },
    viewport: { width: full.width, height: full.height, deviceScale: 1, displayScale: 1, zoom: 1, visualScale: 1, scrollX: 0, scrollY: 0 },
    questions: [{ ...full }] };
}
function frame(): CapturedFrame { return { jpeg: own(Buffer.from([0xff, 0xd8, 1, 2, 3])), bounds: { ...full } }; }
function source(images: Bitmap[] = [synthetic()]): {
  source: PresentationSource; frames: CapturedFrame[]; references: Bitmap[]; decoded: Bitmap[];
} {
  const frames: CapturedFrame[] = [], references: Bitmap[] = [], decoded: Bitmap[] = [];
  return { frames, references, decoded, source: {
    geometry: vi.fn(async () => geometry()),
    reference: vi.fn(async () => { const image = synthetic(); references.push(image); return image; }),
    capture: vi.fn(async () => { const captured = frame(); frames.push(captured); return captured; }),
    decode: vi.fn(() => { const image = copy(images[Math.min(decoded.length, images.length - 1)]!); decoded.push(image); return image; }),
    nextPaint: vi.fn(async () => {})
  } };
}
const signal = (): AbortSignal => new AbortController().signal;
const zero = (bytes: Buffer): boolean => bytes.every(value => value === 0);
afterEach(() => { for (const bytes of owned) bytes.fill(0); owned.clear(); vi.useRealTimers(); });

describe('native presentation pixels (invented in-memory BGRA)', () => {
  it('accepts exact pixels and small independent JPEG-like channel noise', () => {
    const reference = synthetic(), actual = copy(reference);
    expect(comparePresentation(actual, reference, [full]).passes).toBe(true);
    for (let i = 0; i < actual.bytes.length; ++i) if (i % 4 !== 3)
      actual.bytes[i] = Math.max(0, Math.min(255, actual.bytes[i]! + i % 7 - 3));
    const result = comparePresentation(actual, reference, [full]);
    expect(result.passes).toBe(true); expect(result.questions[0]!.edgeSamples).toBeGreaterThan(READINESS.minEdgeSamples);
  });
  it('rejects a previous renderer frame even with matching JPEG dimensions', () => {
    expect(comparePresentation(synthetic(), synthetic(1), [full]).passes).toBe(false);
  });
  it('rejects a blank native screen, and a blank renderer reference', () => {
    const blank = bitmap(own(Buffer.alloc(full.width * full.height * 4, 255)), full.width, full.height);
    expect(comparePresentation(blank, synthetic(), [full]).passes).toBe(false);
    expect(comparePresentation(blank, blank, [full]).passes).toBe(false);
  });
  it('rejects a small changed text stroke among otherwise matching text and whitespace', () => {
    const reference = synthetic(), actual = copy(reference);
    for (let y = 80; y < 89; ++y) for (let x = 85; x < 91; ++x) {
      const i = (y * actual.width + x) * 4;
      actual.bytes.fill(30, i, i + 3);
    }
    const result = comparePresentation(actual, reference, [full]);
    // Global color and edge averages alone miss this small, high-contrast change.
    expect(result.full.passes).toBe(true);
    expect(result.questions[0]!.edgeBadFraction).toBeLessThan(READINESS.edgeBadFraction);
    expect(result.passes).toBe(false);
  });
  it('checks the second question separately so a large first question cannot hide it', () => {
    const reference = synthetic(), actual = copy(reference);
    const questions = [{ x: 0, y: 0, width: 640, height: 192 }, { x: 0, y: 192, width: 160, height: 64 }];
    for (let y = 192; y < 256; ++y) actual.bytes.fill(255, (y * 640) * 4, (y * 640 + 160) * 4);
    const result = comparePresentation(actual, reference, questions);
    expect(result.questions[0]!.passes).toBe(true); expect(result.questions[1]!.passes).toBe(false); expect(result.passes).toBe(false);
  });
  it('rejects larger uniform color offsets and swapped color channels', () => {
    const reference = synthetic(), actual = copy(reference);
    for (let i = 0; i < actual.bytes.length; ++i) if (i % 4 !== 3) {
      reference.bytes[i] = Math.max(0, reference.bytes[i]! - 20); actual.bytes[i] = reference.bytes[i]! + 12;
    }
    expect(comparePresentation(actual, reference, [full]).passes).toBe(false);
    for (let i = 0; i < actual.bytes.length; i += 4) {
      actual.bytes[i] = reference.bytes[i + 2]!; actual.bytes[i + 1] = reference.bytes[i + 1]!; actual.bytes[i + 2] = reference.bytes[i]!;
    }
    expect(comparePresentation(actual, reference, [full]).passes).toBe(false);
  });
  it('fails closed on invalid bitmap sizes, missing questions and out-of-image regions', () => {
    expect(() => bitmap(own(Buffer.alloc(1)), full.width, full.height)).toThrow(PresentationError);
    expect(() => bitmap(own(Buffer.alloc(4)), 1.5, 1)).toThrow(PresentationError);
    expect(() => comparePresentation(synthetic(), synthetic(), [])).toThrow(PresentationError);
    expect(() => comparePresentation(synthetic(), synthetic(), [{ ...full, x: 1 }])).toThrow(PresentationError);
    expect(() => comparePresentation(synthetic(), bitmap(own(Buffer.alloc(4)), 1, 1), [full])).toThrow(PresentationError);
  });
});

describe('explicit viewport, scale and physical monitor mapping', () => {
  it('accepts exact 100% mapping and a verified 200% physical mapping without resizing images', () => {
    expect(questionPixels(geometry(), 1, 1)).toEqual([full]);
    const value = geometry();
    value.viewport.width /= 2; value.viewport.height /= 2; value.viewport.deviceScale = value.viewport.displayScale = 2;
    value.displayDip.width /= 2; value.displayDip.height /= 2; value.contentDip = { ...value.displayDip };
    value.questions = [{ x: 10.25, y: 8.25, width: 100.5, height: 20.5 }];
    expect(questionPixels(value, 1, 1)).toEqual([{ x: 20, y: 16, width: 202, height: 42 }]);
  });
  it.each(['focus', 'identity', 'generation', 'layout', 'monitor', 'offset', 'content', 'viewport', 'scale', 'zoom', 'visualScale', 'scroll', 'count', 'clipped'])(
    'rejects %s mismatch', kind => {
      const value = geometry();
      if (kind === 'focus') value.focused = false;
      if (kind === 'identity') value.current = false;
      if (kind === 'generation') value.generation = 2;
      if (kind === 'layout') value.layoutFits = false;
      if (kind === 'monitor') value.windowMonitor.width--;
      if (kind === 'offset') value.displayPixels.x++;
      if (kind === 'content') value.contentDip.y++;
      if (kind === 'viewport') value.viewport.width--;
      if (kind === 'scale') value.viewport.deviceScale = 1.25;
      if (kind === 'zoom') value.viewport.zoom = 1.1;
      if (kind === 'visualScale') value.viewport.visualScale = 1.1;
      if (kind === 'scroll') value.viewport.scrollY = 1;
      if (kind === 'count') value.questions.push({ ...full });
      if (kind === 'clipped') value.questions[0]!.x = 1;
      expect(() => questionPixels(value, 1, 1)).toThrow(PresentationError);
    });
});

describe('bounded readiness capture ownership and model-send boundary', () => {
  it('discards stale native candidates, accepts current pixels and retains only the accepted JPEG for its caller', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const fake = source([synthetic(1), synthetic()]);
    const pending = waitForNativePresentation(fake.source, { generation: 1, questionCount: 1, signal: signal() });
    await vi.runAllTimersAsync(); const ready = await pending;
    expect(ready.captures).toBe(2); expect(ready.frame).toBe(fake.frames[1]);
    expect(zero(fake.frames[0]!.jpeg)).toBe(true); expect(zero(ready.frame.jpeg)).toBe(false);
    expect(fake.references.every(image => zero(image.bytes))).toBe(true); expect(fake.decoded.every(image => zero(image.bytes))).toBe(true);
    ready.frame.jpeg.fill(0);
  });
  it('never sends a model request after the native capture limit', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const fake = source([synthetic(1)]), send = vi.fn();
    const pending = waitForNativePresentation(fake.source, { generation: 1, questionCount: 1, signal: signal() }).then(send);
    const failed = expect(pending).rejects.toMatchObject({ code: 'Pixels' });
    await vi.runAllTimersAsync(); await failed;
    expect(fake.source.capture).toHaveBeenCalledTimes(READINESS.maxCaptures); expect(send).not.toHaveBeenCalled();
    expect(fake.frames.every(value => zero(value.jpeg))).toBe(true);
    expect([...fake.references, ...fake.decoded].every(image => zero(image.bytes))).toBe(true);
  });
  it.each(['Focus', 'Geometry', 'Unavailable', 'Bitmap'])('stops immediately and cleans up on %s failure', async kind => {
    const fake = source(), send = vi.fn();
    if (kind === 'Unavailable') fake.source.reference = async () => { throw new Error('untrusted raw detail'); };
    if (kind === 'Bitmap') fake.source.decode = () => { throw new PresentationError('Bitmap'); };
    if (kind === 'Focus' || kind === 'Geometry') {
      let reads = 0;
      fake.source.geometry = async () => { const value = geometry(); if (++reads > 1) {
        if (kind === 'Focus') value.focused = false; else value.questions[0]!.width--;
      } return value; };
    }
    await expect(waitForNativePresentation(fake.source, { generation: 1, questionCount: 1, signal: signal() }).then(send)).rejects.toMatchObject({ code: kind });
    expect(send).not.toHaveBeenCalled(); expect(fake.frames.every(value => zero(value.jpeg))).toBe(true);
    expect(fake.references.every(image => zero(image.bytes))).toBe(true);
  });
  it('does not capture or send when already aborted', async () => {
    const fake = source(), controller = new AbortController(), send = vi.fn(); controller.abort('untrusted raw reason');
    await expect(waitForNativePresentation(fake.source, { generation: 1, questionCount: 1, signal: controller.signal }).then(send)).rejects.toMatchObject({ code: 'Aborted' });
    expect(fake.source.capture).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });
  it.each(['reference', 'capture'] as const)('bounds a hung %s and zeroes its late result before any model send', async stage => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const fake = source(), send = vi.fn();
    let finishReference: ((value: Bitmap) => void) | undefined, finishCapture: ((value: CapturedFrame) => void) | undefined;
    if (stage === 'reference') fake.source.reference = () => new Promise(resolve => { finishReference = resolve; });
    else fake.source.capture = () => new Promise(resolve => { finishCapture = resolve; });
    const pending = waitForNativePresentation(fake.source, { generation: 1, questionCount: 1, signal: signal() }).then(send);
    const failed = expect(pending).rejects.toMatchObject({ code: 'Deadline' });
    await vi.advanceTimersByTimeAsync(READINESS.timeoutMilliseconds + 1); await failed;
    const lateImage = synthetic(), lateFrame = frame();
    if (stage === 'reference') finishReference!(lateImage); else finishCapture!(lateFrame);
    await vi.runAllTimersAsync();
    expect(zero(stage === 'reference' ? lateImage.bytes : lateFrame.jpeg)).toBe(true);
    expect(fake.references.every(image => zero(image.bytes))).toBe(true); expect(send).not.toHaveBeenCalled();
  });
  it('abort interrupts a pending capture, cleans the renderer bitmap and wipes late native bytes', async () => {
    const fake = source(), controller = new AbortController();
    let finish: ((value: CapturedFrame) => void) | undefined;
    fake.source.capture = () => new Promise(resolve => { finish = resolve; });
    const pending = waitForNativePresentation(fake.source, { generation: 1, questionCount: 1, signal: controller.signal });
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    controller.abort(); await expect(pending).rejects.toMatchObject({ code: 'Aborted' });
    const late = frame(); finish!(late); await Promise.resolve(); await Promise.resolve();
    expect(zero(late.jpeg)).toBe(true); expect(fake.references.every(image => zero(image.bytes))).toBe(true);
  });
  it('rejects an operation resolving exactly at its deadline and clears its owned result', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const deadline = new PresentationDeadline(signal()), bytes = own(Buffer.alloc(16, 19));
    const pending = deadline.step(() => new Promise<Buffer>(resolve => setTimeout(() => resolve(bytes), READINESS.timeoutMilliseconds)), value => value.fill(0));
    const failed = expect(pending).rejects.toMatchObject({ code: 'Deadline' });
    await vi.runAllTimersAsync(); await failed; expect(zero(bytes)).toBe(true);
  });
});
