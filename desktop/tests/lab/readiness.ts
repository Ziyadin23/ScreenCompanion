import type { CapturedFrame, PixelBounds } from '../../src/contracts';

// Local lab presentation checks only. These captures never enter a provider retry path.
export const READINESS = Object.freeze({
  timeoutMilliseconds: 5000, maxCaptures: 16, pollMilliseconds: 25, maxPixels: 16 * 1024 * 1024,
  gridColumns: 192, gridRows: 108, questionColumns: 320, questionRows: 160,
  pixelDelta: 36, meanAbsolute: 7, badFraction: 0.025,
  edgeContrast: 28, edgeMeanAbsolute: 14, edgeBadFraction: 0.14,
  minSamples: 64, minEdgeSamples: 24, tileSize: 16, minTileBad: 4
});
type ReadinessCode = 'Aborted' | 'Deadline' | 'Unavailable' | 'Focus' | 'Geometry' | 'Bitmap' | 'Pixels';
export class PresentationError extends Error {
  constructor(readonly code: ReadinessCode) { super(`LabPresentation${code}`); }
}
export interface Bitmap { bytes: Buffer; width: number; height: number }
export interface PresentationGeometry {
  generation: number; current: boolean; focused: boolean; layoutFits: boolean;
  monitor: PixelBounds; windowMonitor: PixelBounds; displayPixels: PixelBounds;
  displayDip: PixelBounds; contentDip: PixelBounds;
  viewport: { width: number; height: number; deviceScale: number; displayScale: number; zoom: number;
    visualScale: number; scrollX: number; scrollY: number };
  questions: PixelBounds[];
}
export function sameBounds(a: PixelBounds, b: PixelBounds): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
function boundsValid(rect: PixelBounds, integer = true): boolean {
  return !!rect && [rect.x, rect.y, rect.width, rect.height].every(integer ? Number.isSafeInteger : Number.isFinite) &&
    rect.width > 0 && rect.height > 0;
}
export function questionPixels(geometry: PresentationGeometry, generation: number, count: number): PixelBounds[] {
  if (!geometry.focused) throw new PresentationError('Focus');
  const { viewport: v, monitor, windowMonitor, displayPixels, displayDip, contentDip } = geometry;
  if (!Number.isSafeInteger(generation) || generation < 1 || geometry.generation !== generation || !geometry.current || !geometry.layoutFits ||
      ![monitor, windowMonitor, displayPixels, displayDip, contentDip].every(rect => boundsValid(rect)) ||
      !sameBounds(monitor, windowMonitor) || !sameBounds(monitor, displayPixels) || !sameBounds(displayDip, contentDip) ||
      monitor.width * monitor.height > READINESS.maxPixels ||
      ![v.width, v.height, v.deviceScale, v.displayScale, v.zoom, v.visualScale, v.scrollX, v.scrollY].every(Number.isFinite) ||
      v.width !== contentDip.width || v.height !== contentDip.height || v.deviceScale !== v.displayScale ||
      v.displayScale < 1 || v.displayScale > 4 || v.zoom !== 1 || v.visualScale !== 1 || v.scrollX !== 0 || v.scrollY !== 0 ||
      Math.round(v.width * v.displayScale) !== monitor.width || Math.round(v.height * v.displayScale) !== monitor.height ||
      !Number.isSafeInteger(count) || count < 1 || count > 16 || geometry.questions.length !== count) throw new PresentationError('Geometry');
  return geometry.questions.map(rect => {
    if (!boundsValid(rect, false) || rect.x < 0 || rect.y < 0 || rect.x + rect.width > v.width || rect.y + rect.height > v.height)
      throw new PresentationError('Geometry');
    const x = Math.floor(rect.x * v.displayScale), y = Math.floor(rect.y * v.displayScale);
    return { x, y, width: Math.ceil((rect.x + rect.width) * v.displayScale) - x,
      height: Math.ceil((rect.y + rect.height) * v.displayScale) - y };
  });
}
export function bitmap(bytes: Buffer, width: number, height: number): Bitmap {
  if (!Buffer.isBuffer(bytes) || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      width * height > READINESS.maxPixels || bytes.length !== width * height * 4) throw new PresentationError('Bitmap');
  return { bytes, width, height };
}
function validateBitmap(image: Bitmap): void { bitmap(image.bytes, image.width, image.height); }
const at = (image: Bitmap, x: number, y: number): number => (y * image.width + x) * 4;
const luma = (image: Bitmap, x: number, y: number): number => {
  const i = at(image, x, y);
  // Electron's Windows bitmap copies are BGRA; alpha is not image evidence.
  return (image.bytes[i]! * 29 + image.bytes[i + 1]! * 150 + image.bytes[i + 2]! * 77) / 256;
};
function edge(image: Bitmap, x: number, y: number): boolean {
  const center = luma(image, x, y);
  const left = luma(image, Math.max(0, x - 2), y), right = luma(image, Math.min(image.width - 1, x + 2), y);
  const top = luma(image, x, Math.max(0, y - 2)), bottom = luma(image, x, Math.min(image.height - 1, y + 2));
  return Math.max(center, left, right, top, bottom) - Math.min(center, left, right, top, bottom) >= READINESS.edgeContrast;
}
function edgeDistance(actual: Bitmap, reference: Bitmap, x: number, y: number): number {
  const a = luma(actual, x, y), r = luma(reference, x, y);
  let forward = 255, reverse = 255;
  // One physical pixel tolerates JPEG/subpixel fringes; the symmetric direction rejects missing strokes.
  for (let dy = -1; dy <= 1; ++dy) for (let dx = -1; dx <= 1; ++dx) {
    const sx = Math.max(0, Math.min(actual.width - 1, x + dx)), sy = Math.max(0, Math.min(actual.height - 1, y + dy));
    forward = Math.min(forward, Math.abs(a - luma(reference, sx, sy)));
    reverse = Math.min(reverse, Math.abs(r - luma(actual, sx, sy)));
  }
  return Math.max(forward, reverse);
}
export interface PixelMetrics {
  samples: number; meanAbsolute: number; badFraction: number; edgeSamples: number; edgeMeanAbsolute: number;
  edgeBadFraction: number; badTiles: number; passes: boolean;
}
function compareRegion(actual: Bitmap, reference: Bitmap, rect: PixelBounds, dense: boolean): PixelMetrics {
  if (!boundsValid(rect) || rect.x < 0 || rect.y < 0 || rect.x + rect.width > actual.width || rect.y + rect.height > actual.height)
    throw new PresentationError('Geometry');
  const columns = Math.min(rect.width, dense ? READINESS.questionColumns : READINESS.gridColumns);
  const rows = Math.min(rect.height, dense ? READINESS.questionRows : READINESS.gridRows);
  const tileColumns = Math.ceil(rect.width / READINESS.tileSize), tileCount = tileColumns * Math.ceil(rect.height / READINESS.tileSize);
  const tileEdges = new Uint32Array(dense ? tileCount : 0), tileBad = new Uint32Array(dense ? tileCount : 0);
  const tileError = new Float64Array(dense ? tileCount : 0);
  let error = 0, bad = 0, edgeSamples = 0, edgeError = 0, edgeBad = 0;
  for (let row = 0; row < rows; ++row) for (let column = 0; column < columns; ++column) {
    const x = rect.x + Math.floor((column + 0.5) * rect.width / columns), y = rect.y + Math.floor((row + 0.5) * rect.height / rows);
    const index = at(actual, x, y);
    const b = Math.abs(actual.bytes[index]! - reference.bytes[index]!);
    const g = Math.abs(actual.bytes[index + 1]! - reference.bytes[index + 1]!);
    const r = Math.abs(actual.bytes[index + 2]! - reference.bytes[index + 2]!);
    error += (b + g + r) / 3; if (Math.max(b, g, r) > READINESS.pixelDelta) ++bad;
  }
  // Visit every physical question pixel for edges, rather than letting white card area dilute changed text.
  if (dense) for (let y = rect.y; y < rect.y + rect.height; ++y) for (let x = rect.x; x < rect.x + rect.width; ++x) {
    if (!edge(reference, x, y) && !edge(actual, x, y)) continue;
    const distance = edgeDistance(actual, reference, x, y);
    ++edgeSamples; edgeError += distance; if (distance > READINESS.pixelDelta) ++edgeBad;
    const tile = Math.floor((y - rect.y) / READINESS.tileSize) * tileColumns + Math.floor((x - rect.x) / READINESS.tileSize);
    ++tileEdges[tile]!; tileError[tile]! += distance; if (distance > READINESS.pixelDelta) ++tileBad[tile]!;
  }
  // A changed glyph must fail even when thousands of unchanged strokes dilute question-wide averages.
  let badTiles = 0;
  for (let tile = 0; tile < tileEdges.length; ++tile) if (tileBad[tile]! >= READINESS.minTileBad &&
      (tileBad[tile]! / tileEdges[tile]! > READINESS.edgeBadFraction || tileError[tile]! / tileEdges[tile]! > READINESS.edgeMeanAbsolute)) ++badTiles;
  tileEdges.fill(0); tileBad.fill(0); tileError.fill(0);
  const samples = rows * columns, meanAbsolute = error / Math.max(1, samples), badFraction = bad / Math.max(1, samples);
  const edgeMeanAbsolute = edgeError / Math.max(1, edgeSamples), edgeBadFraction = edgeBad / Math.max(1, edgeSamples);
  return { samples, meanAbsolute, badFraction, edgeSamples, edgeMeanAbsolute, edgeBadFraction, badTiles,
    passes: samples >= READINESS.minSamples && meanAbsolute <= READINESS.meanAbsolute && badFraction <= READINESS.badFraction &&
      (!dense || edgeSamples >= READINESS.minEdgeSamples && edgeMeanAbsolute <= READINESS.edgeMeanAbsolute && edgeBadFraction <= READINESS.edgeBadFraction && badTiles === 0) };
}
export function comparePresentation(actual: Bitmap, reference: Bitmap, questions: readonly PixelBounds[]): {
  passes: boolean; full: PixelMetrics; questions: PixelMetrics[];
} {
  validateBitmap(actual); validateBitmap(reference);
  if (actual.width !== reference.width || actual.height !== reference.height || questions.length < 1 || questions.length > 16)
    throw new PresentationError('Geometry');
  const full = compareRegion(actual, reference, { x: 0, y: 0, width: actual.width, height: actual.height }, false);
  const regions = questions.map(rect => compareRegion(actual, reference, rect, true));
  return { passes: full.passes && regions.every(result => result.passes), full, questions: regions };
}

/** Bound each asynchronous boundary and clean up results that arrive after cancellation/deadline. */
export class PresentationDeadline {
  private readonly expires = performance.now() + READINESS.timeoutMilliseconds;
  constructor(private readonly signal: AbortSignal) {}
  check(): void {
    if (this.signal.aborted) throw new PresentationError('Aborted');
    if (performance.now() >= this.expires) throw new PresentationError('Deadline');
  }
  step<T>(operation: () => Promise<T>, disposeLate?: (value: T) => void): Promise<T> {
    this.check();
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (error: PresentationError): void => {
        if (settled) return;
        settled = true; clearTimeout(timer); this.signal.removeEventListener('abort', cancelled); reject(error);
      };
      const cancelled = (): void => finish(new PresentationError('Aborted'));
      const timer = setTimeout(() => finish(new PresentationError('Deadline')), Math.max(1, this.expires - performance.now()));
      this.signal.addEventListener('abort', cancelled, { once: true });
      Promise.resolve().then(() => { this.check(); return operation(); }).then(value => {
        if (settled) { disposeLate?.(value); return; }
        try { this.check(); } catch (error) { disposeLate?.(value); finish(error as PresentationError); return; }
        settled = true; clearTimeout(timer); this.signal.removeEventListener('abort', cancelled); resolve(value);
      }, error => finish(error instanceof PresentationError ? error : new PresentationError('Unavailable')));
    });
  }
}
export interface PresentationSource {
  geometry(): Promise<PresentationGeometry>;
  reference(): Promise<Bitmap>;
  capture(bounds: PixelBounds): Promise<CapturedFrame>;
  decode(jpeg: Buffer): Bitmap;
  nextPaint(): Promise<void>;
}
export async function waitForNativePresentation(source: PresentationSource, options: {
  generation: number; questionCount: number; signal: AbortSignal; deadline?: PresentationDeadline;
}): Promise<{ frame: CapturedFrame; geometry: PresentationGeometry; captures: number }> {
  const deadline = options.deadline ?? new PresentationDeadline(options.signal);
  for (let captures = 1; captures <= READINESS.maxCaptures; ++captures) {
    let reference: Bitmap | undefined, actual: Bitmap | undefined, frame: CapturedFrame | undefined;
    let accepted = false;
    try {
      const before = await deadline.step(() => source.geometry());
      const questions = questionPixels(before, options.generation, options.questionCount);
      reference = await deadline.step(() => source.reference(), image => image.bytes.fill(0));
      frame = await deadline.step(() => source.capture(before.monitor), value => value.jpeg.fill(0));
      if (!sameBounds(frame.bounds, before.monitor) || frame.jpeg[0] !== 0xff || frame.jpeg[1] !== 0xd8) throw new PresentationError('Bitmap');
      actual = source.decode(frame.jpeg);
      const after = await deadline.step(() => source.geometry());
      questionPixels(after, options.generation, options.questionCount);
      if (JSON.stringify(before) !== JSON.stringify(after) || actual.width !== before.monitor.width || actual.height !== before.monitor.height)
        throw new PresentationError('Geometry');
      const comparison = comparePresentation(actual, reference, questions);
      deadline.check();
      if (comparison.passes) { accepted = true; return { frame, geometry: after, captures }; }
    } catch (error) {
      throw error instanceof PresentationError ? error : new PresentationError('Unavailable');
    } finally {
      reference?.bytes.fill(0); actual?.bytes.fill(0); if (!accepted) frame?.jpeg.fill(0);
    }
    if (captures < READINESS.maxCaptures) await deadline.step(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, READINESS.pollMilliseconds));
      deadline.check();
      await source.nextPaint();
    });
  }
  throw new PresentationError('Pixels');
}
