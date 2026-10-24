export type JsonObject = Record<string, unknown>;
export const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const nonblank = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
export const hasFields = (value: unknown, names: readonly string[]): value is JsonObject =>
  isObject(value) && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));

/** JSON.parse alone silently accepts duplicate keys, which would weaken canonical envelopes. */
export function parseJson(text: string): unknown {
  const value: unknown = JSON.parse(text);
  const stack: { object: boolean; key: boolean; names: Set<string> }[] = [];
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}[\],:]|[^\s{}[\],:]+/g) ?? [];
  for (const token of tokens) {
    const frame = stack.at(-1);
    if (token === '{' || token === '[') stack.push({ object: token === '{', key: token === '{', names: new Set() });
    else if (token === '}' || token === ']') stack.pop();
    else if (frame?.object && token === ',') frame.key = true;
    else if (frame?.object && token === ':') frame.key = false;
    else if (frame?.object && frame.key && token.startsWith('"')) {
      const name = JSON.parse(token) as string;
      if (frame.names.has(name)) throw new SyntaxError('Duplicate JSON field');
      frame.names.add(name);
    }
  }
  return value;
}
