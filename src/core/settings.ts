export interface Settings {
  youtubeDualSubs: boolean;
  nativeLang: string;
  pauseOnLookup: boolean;
}

export const DEFAULT_SETTINGS: Settings = { youtubeDualSubs: true, nativeLang: 'en', pauseOnLookup: true };

export const NATIVE_LANGS: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'ko', label: '한국어' },
  { code: 'zh-Hans', label: '中文（简体）' },
];

const STORAGE_KEY = 'settings';

function withDefaults(stored: unknown): Settings {
  return { ...DEFAULT_SETTINGS, ...(stored as Partial<Settings> | undefined) };
}

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.sync.get(STORAGE_KEY);
  return withDefaults(stored[STORAGE_KEY]);
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await browser.storage.sync.set({ [STORAGE_KEY]: { ...current, ...patch } });
}

export function watchSettings(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== 'sync' || !(STORAGE_KEY in changes)) return;
    cb(withDefaults(changes[STORAGE_KEY].newValue));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
