import type { ImageCropper, NormalizedRegion } from '../../src/contracts';

export interface RequiredVisual { diagram: NormalizedRegion; labels: NormalizedRegion[] }
export interface VisualCoverage { observed: boolean; diagram: boolean; labels: boolean }
const valid = (r: NormalizedRegion): boolean => [r.x, r.y, r.width, r.height].every(Number.isFinite) &&
  r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0 && r.x + r.width <= 1.000001 && r.y + r.height <= 1.000001;
const contains = (outer: NormalizedRegion, inner: NormalizedRegion): boolean => valid(outer) && valid(inner) &&
  outer.x <= inner.x + .000001 && outer.y <= inner.y + .000001 &&
  outer.x + outer.width >= inner.x + inner.width - .000001 && outer.y + outer.height >= inner.y + inner.height - .000001;
/** Observe actual production crop calls; Thorough subcrops are composed into monitor coordinates. */
export class CropCoverage implements ImageCropper {
  private readonly bounds = new Map<Buffer, NormalizedRegion>();
  private readonly visuals: NormalizedRegion[] = [];
  private missing = false;
  constructor(private readonly cropper: ImageCropper, original: Buffer, private readonly extracting: () => boolean) {
    this.bounds.set(original, { x: 0, y: 0, width: 1, height: 1 });
  }
  async crop(input: Buffer, region: NormalizedRegion): Promise<Buffer> {
    const parent = this.bounds.get(input), visual = this.extracting();
    const result = await this.cropper.crop(input, region);
    if (!parent || !valid(region) || !Buffer.isBuffer(result) || !result.length || result === input) this.missing = true;
    else {
      const absolute = { x: parent.x + region.x * parent.width, y: parent.y + region.y * parent.height,
        width: region.width * parent.width, height: region.height * parent.height };
      this.bounds.set(result, absolute);
      if (visual) this.visuals.push(absolute);
    }
    return result;
  }
  grade(required: readonly RequiredVisual[] | undefined): VisualCoverage {
    const observed = !this.missing && !!required?.length && required.every(item => valid(item.diagram) && item.labels.length === 2 && item.labels.every(valid)) && this.visuals.length > 0;
    return { observed, diagram: observed && required!.every(item => this.visuals.some(crop => contains(crop, item.diagram))),
      labels: observed && required!.every(item => item.labels.every(label => this.visuals.some(crop => contains(crop, label)))) };
  }
  clear(): void { this.bounds.clear(); this.visuals.length = 0; }
}
