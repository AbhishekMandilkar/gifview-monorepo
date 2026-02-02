import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { Uniwind, useUniwind } from "uniwind";

type ThemeName = "light" | "dark";

type AppThemeContextType = {
  currentTheme: string;
  isLight: boolean;
  isDark: boolean;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
};

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined);

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useUniwind();

  // Force dark theme on mount
  useEffect(() => {
    Uniwind.setTheme("dark");
  }, []);

  const isLight = useMemo(() => {
    return false;
  }, []);

  const isDark = useMemo(() => {
    return true;
  }, []);

  const setTheme = useCallback((newTheme: ThemeName) => {
    Uniwind.setTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    Uniwind.setTheme(theme === "light" ? "dark" : "light");
  }, [theme]);

  const value = useMemo(
    () => ({
      currentTheme: "dark",
      isLight,
      isDark,
      setTheme,
      toggleTheme,
    }),
    [isLight, isDark, setTheme, toggleTheme],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
};

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return context;
}
