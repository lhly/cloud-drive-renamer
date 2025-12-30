/**
 * Appearance / theme types
 */

/**
 * User-selected appearance mode.
 * - auto: follow system/browser prefers-color-scheme
 * - light: force light
 * - dark: force dark
 */
export type AppearanceMode = 'auto' | 'light' | 'dark';

/**
 * Resolved color scheme used by CSS.
 */
export type ColorScheme = 'light' | 'dark';

/**
 * Storage key for appearance mode.
 */
export const APPEARANCE_STORAGE_KEY = 'appearanceMode';

/**
 * Default appearance mode.
 */
export const DEFAULT_APPEARANCE_MODE: AppearanceMode = 'auto';

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === 'auto' || value === 'light' || value === 'dark';
}

export function resolveColorScheme(mode: AppearanceMode, systemScheme: ColorScheme): ColorScheme {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  return systemScheme;
}

