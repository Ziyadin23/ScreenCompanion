const PATHS = {
  capture: 'M8 3H4a1 1 0 0 0-1 1v4m13-5h4a1 1 0 0 1 1 1v4M3 16v4a1 1 0 0 0 1 1h4m8 0h4a1 1 0 0 0 1-1v-4M7 7h10v10H7Z',
  question: 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-5 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 5h8m-8 4h5',
  settings: 'M4 6h3m4 0h9M4 12h9m4 0h3M4 18h3m4 0h9M7 4v4m6 2v4m-6 2v4',
  hide: 'M4 12h16',
  exit: 'M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5m5-13 5 5-5 5m-6-5h11',
  chevron: 'm8 10 4 4 4-4',
  send: 'm6 12 6-6 6 6m-6-6v14',
  answer: 'M5 5h14M5 10h14M5 15h9M5 20h6',
  panel: 'M4 4h16v16H4Zm0 5h16M9 9v11',
  models: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5',
  commands: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2 4h.01M12 9h.01M17 9h.01M7 13h.01M12 13h.01M17 13h.01M8 16h8',
  updates: 'M20 8a8 8 0 1 0 0 8m0-13v5h-5m-3 0v4l3 2'
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={PATHS[name]} /></svg>;
}
