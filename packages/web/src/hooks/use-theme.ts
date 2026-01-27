import { useEffect, useState } from "react";

export type Theme =
  | "modern-light"
  | "modern-dark"
  | "fresh-light"
  | "fresh-dark";

export type ThemeMode = "light" | "dark";
export type ThemeStyle = "modern" | "fresh";

interface UseThemeReturn {
  theme: Theme;
  mode: ThemeMode;
  style: ThemeStyle;
  setTheme: (theme: Theme) => void;
  setMode: (mode: ThemeMode) => void;
  setStyle: (style: ThemeStyle) => void;
  toggleMode: () => void;
}

const STORAGE_KEY = "vocab-master-theme";

export function useTheme(): UseThemeReturn {
  // 从 localStorage 读取，默认为 modern-light
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as Theme) || "modern-light";
  });

  // 解析当前 theme 的 mode 和 style
  // theme 的格式为 "<style>-<mode>"（例如 "modern-light"），
  // 所以先解构出 style 再是 mode，类型为 [ThemeStyle, ThemeMode]
  const [style, mode] = theme.split("-") as [ThemeStyle, ThemeMode];

  // 设置主题
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  // 只设置模式（亮/暗）
  const setMode = (newMode: ThemeMode) => {
    const newTheme = `${style}-${newMode}` as Theme;
    setTheme(newTheme);
  };

  // 只设置风格（modern/fresh）
  const setStyle = (newStyle: ThemeStyle) => {
    const newTheme = `${newStyle}-${mode}` as Theme;
    setTheme(newTheme);
  };

  // 切换亮/暗模式
  const toggleMode = () => {
    const newMode = mode === "light" ? "dark" : "light";
    setMode(newMode);
  };

  // 初始化时设置 data-theme 属性
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return {
    theme,
    mode,
    style,
    setTheme,
    setMode,
    setStyle,
    toggleMode,
  };
}
