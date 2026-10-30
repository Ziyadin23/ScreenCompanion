export interface ShortcutRequest {
  operation: 'ping' | 'hold' | 'probe' | 'release' | 'drain' | 'send' | 'close';
  id?: number; modifiers?: number; key?: number; keys?: number[];
}
export interface ShortcutReply { ok: boolean; events: number[] }
export function startShortcutHolder(): Promise<{
  request(value: ShortcutRequest): Promise<ShortcutReply>;
  close(): Promise<void>;
}>;
