"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import {
  useThemeStore,
  ACCENT_PRESETS,
  FONT_PRESETS,
} from "@/store/useThemeStore";

function ThemeVariableSync() {
  const { resolvedTheme } = useTheme();
  const accentColor = useThemeStore((s) => s.accentColor);
  const radius = useThemeStore((s) => s.radius);
  const fontFamily = useThemeStore((s) => s.fontFamily);

  React.useEffect(() => {
    const root = document.documentElement;
    const isDark = resolvedTheme === "dark";
    const accent = ACCENT_PRESETS[accentColor] || ACCENT_PRESETS.blue;
    const font = FONT_PRESETS[fontFamily] || FONT_PRESETS.inter;

    root.style.setProperty(
      "--primary",
      isDark ? accent.darkPrimary : accent.lightPrimary
    );
    root.style.setProperty("--ring", accent.ring);
    root.style.setProperty("--radius", radius);
    root.style.setProperty("--font-current", font.css);
  }, [resolvedTheme, accentColor, radius, fontFamily]);

  return null;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ThemeVariableSync />
      {children}
    </NextThemesProvider>
  );
}
