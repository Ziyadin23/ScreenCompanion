import type { NormalizedRegion } from '../contracts';
import { isObject } from '../providers/json';
import { PipelineValidationError } from './trace';

export function validateRegion(region: NormalizedRegion, allowWholeImage = false): void {
  const { x, y, width, height } = region;
  if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || x >= 1 || y >= 1 || width <= 0 || height <= 0 ||
      x + width > 1.000001 || y + height > 1.000001)
    throw new PipelineValidationError('IncompleteExtraction', 'The question region is outside the captured image.', 'QuestionRegion');
  if (!allowWholeImage && width * height >= .98)
    throw new PipelineValidationError('IncompleteExtraction', 'The question region could not be isolated from the full screen.', 'QuestionRegion');
}
export function readRegion(value: unknown): NormalizedRegion {
  if (!isObject(value) || !['x', 'y', 'width', 'height'].every(key => typeof value[key] === 'number'))
    throw new PipelineValidationError('IncompleteExtraction', 'The screen extractor returned invalid image coordinates.', 'QuestionRegion');
  return { x: value.x as number, y: value.y as number, width: value.width as number, height: value.height as number };
}
export function padWithinQuestion(visual: NormalizedRegion, question: NormalizedRegion, padding: number): NormalizedRegion {
  const left = Math.max(question.x, visual.x - question.width * padding);
  const top = Math.max(question.y, visual.y - question.height * padding);
  const right = Math.min(question.x + question.width, visual.x + visual.width + question.width * padding);
  const bottom = Math.min(question.y + question.height, visual.y + visual.height + question.height * padding);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
