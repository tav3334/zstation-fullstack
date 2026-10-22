import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "tonsor-theme";

/**
 * Thème clair/sombre pour les pages publiques (Landing, Login, Signup, Tarifs).
 * Persisté en localStorage, appliqué comme classe CSS sur l'élément racine
 * de la page (pas sur <html>, pour ne pas affecter les tableaux de bord
 * qui n'ont pas encore de support de thème).
 */
function useTheme(defaultTheme = "dark") {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore (stockage indisponible)
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme, isDark: theme === "dark" };
}

export default useTheme;
