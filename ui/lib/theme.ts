export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "systemone-theme";

/** Resolves a preference to a concrete palette, consulting the OS for "system". */
export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Applies a preference to the document.
 *
 * `data-theme` is always set to a concrete value, never "system" — that is what
 * lets globals.css define the dark palette exactly once, under a single
 * selector, instead of repeating it inside a prefers-color-scheme block.
 */
export function applyTheme(preference: ThemePreference): void {
  const effective = resolveTheme(preference);
  document.documentElement.setAttribute("data-theme", effective);
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute("content", effective);
}

export function readStoredTheme(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    // Storage can throw in private-browsing modes; fall back to "system".
  }
  return "system";
}

export function storeTheme(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Non-fatal: the theme still applies for this session.
  }
  listeners.forEach((listener) => listener());
}

const listeners = new Set<() => void>();

/**
 * Subscription half of a `useSyncExternalStore` pair over the stored preference.
 *
 * Components read the preference this way rather than via an effect, because
 * localStorage cannot be touched during a server render: an effect would have to
 * setState on mount, which is a cascading render React now flags.
 */
export function subscribeTheme(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` fires when another tab changes the preference.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Server snapshot: the document has no storage yet, so assume "system". */
export function getServerThemeSnapshot(): ThemePreference {
  return "system";
}
