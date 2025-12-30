import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE_MODE,
  type AppearanceMode,
  type ColorScheme,
  isAppearanceMode,
  resolveColorScheme as resolveColorSchemeFromMode,
} from '../types/appearance';
import { storage } from './storage';

export async function getAppearanceMode(): Promise<AppearanceMode> {
  const stored = await storage.get<AppearanceMode>(APPEARANCE_STORAGE_KEY);
  return isAppearanceMode(stored) ? stored : DEFAULT_APPEARANCE_MODE;
}

export async function setAppearanceMode(mode: AppearanceMode): Promise<void> {
  await storage.set(APPEARANCE_STORAGE_KEY, mode);
}

export function getSystemColorScheme(): ColorScheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveColorScheme(mode: AppearanceMode): ColorScheme {
  return resolveColorSchemeFromMode(mode, getSystemColorScheme());
}

export function applyAppearanceToDocument(mode: AppearanceMode, doc: Document = document): ColorScheme {
  const resolved = resolveColorScheme(mode);
  doc.documentElement.dataset.appearanceMode = mode;
  doc.documentElement.dataset.colorScheme = resolved;
  return resolved;
}

export function applyAppearanceToElement(element: HTMLElement, mode: AppearanceMode): ColorScheme {
  const resolved = resolveColorScheme(mode);
  element.dataset.appearanceMode = mode;
  element.dataset.colorScheme = resolved;
  return resolved;
}

export function watchSystemColorScheme(onChange: (scheme: ColorScheme) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (event: MediaQueryListEvent) => {
    onChange(event.matches ? 'dark' : 'light');
  };

  // Fire once for initial value
  onChange(mql.matches ? 'dark' : 'light');

  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }

  // Legacy Safari
  mql.addListener(handler);
  return () => mql.removeListener(handler);
}

