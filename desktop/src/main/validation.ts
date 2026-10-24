import { z } from 'zod';
import { PROVIDERS, RESPONSE_MODES } from '../contracts';

const key = z.string().max(8192).refine(value => !/[\u0000-\u001f\u007f]/u.test(value));
const shortcut = z.object({ Modifiers: z.number().int().min(0).max(15), Key: z.number().int().min(1).max(65535) });
const color = z.string().regex(/^#[0-9a-f]{6}$/iu);
const model = z.string().min(1).max(160).regex(/^[A-Za-z0-9_./:-]+$/u).refine(value => !value.includes('://'));
const pipeline = z.enum(['Thorough', 'Balanced', 'Direct']);
export const settingsDraftSchema = z.object({
  values: z.object({
    ResponseMode: z.enum(RESPONSE_MODES), CustomInstruction: z.string().max(2000),
    Capture: shortcut, Visibility: shortcut, Test: shortcut,
    SettingsShortcut: shortcut, ExitShortcut: shortcut, InputShortcut: shortcut,
    CommandsShown: z.boolean(),
    Appearance: z.object({
      TransparencyPercent: z.number().int().min(0).max(100), TextOpacityPercent: z.number().int().min(15).max(100),
      TextSizePoints: z.number().int().min(8).max(28), BackgroundColor: color, TextColor: color, AccentColor: color
    }),
    Models: z.object({ Provider: z.enum(PROVIDERS), AnswerModel: model, VisionModel: model,
      Thinking: z.enum(['None', 'Low', 'High', 'Max']), AnswerTokenLimit: z.number().int().min(256).max(32000).nullable() }).nullable(),
    PipelineMode: pipeline.nullable()
  }),
  keyPresence: z.record(z.enum(PROVIDERS), z.boolean()),
  keyUpdates: z.partialRecord(z.enum(PROVIDERS), key)
});
export const setupKeySchema = key.min(1).refine(value => value.trim().length > 0);
export const colorSchema = color;
export const updateActionSchema = z.enum(['check', 'download', 'install']);
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.enum(['capture', 'showInput', 'toggleVisibility', 'settings', 'captureTest', 'exit', 'escape', 'beginMove']) }),
  z.object({ type: z.literal('submit'), question: z.string().min(1).max(4000).refine(value => value.trim().length > 0) }),
  z.object({ type: z.literal('recordShortcut'), recording: z.boolean() }),
  z.object({ type: z.literal('beginResize'), edge: z.enum(['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']) })
]);
