export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "assistencia-theme";
export const THEME_CHANGE_EVENT = "assistencia-theme-change";

export function readThemePreference(storage: Pick<Storage, "getItem">): Theme {
  try { return storage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light"; }
  catch { return "light"; }
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setThemePreference(theme: Theme) {
  applyTheme(theme);
  try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); }
  catch { /* Armazenamento bloqueado: a escolha ainda funciona nesta página. */ }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function subscribeToTheme(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    try { applyTheme(readThemePreference(window.localStorage)); }
    catch { applyTheme("light"); }
    listener();
  };
  window.addEventListener(THEME_CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getThemeSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function getServerThemeSnapshot(): Theme { return "light"; }

// Executado no head antes da primeira pintura. Só aceita os dois valores fixos;
// nada vindo do storage é interpolado como código, HTML ou nome de classe.
export const themeInitializationScript = `(function(){var t="light";try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="dark")t="dark"}catch(e){}document.documentElement.classList.toggle("dark",t==="dark")})();`;
