"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AccentColor =
  | "blue"
  | "indigo"
  | "emerald"
  | "violet"
  | "amber"
  | "rose"
  | "cyan";

export type BorderRadius = "0.25rem" | "0.5rem" | "0.75rem" | "1rem";

export type FontFamily = "system" | "inter" | "geist" | "jakarta";

export interface AccentDefinition {
  name: string;
  label: string;
  hex: string;
  lightPrimary: string;
  darkPrimary: string;
  ring: string;
}

export const ACCENT_PRESETS: Record<AccentColor, AccentDefinition> = {
  blue: {
    name: "blue",
    label: "Linear Blue",
    hex: "#3b82f6",
    lightPrimary: "221.2 83.2% 53.3%",
    darkPrimary: "217.2 91.2% 59.8%",
    ring: "221.2 83.2% 53.3%",
  },
  indigo: {
    name: "indigo",
    label: "Indigo",
    hex: "#6366f1",
    lightPrimary: "238.7 83.5% 66.7%",
    darkPrimary: "238.7 83.5% 66.7%",
    ring: "238.7 83.5% 66.7%",
  },
  emerald: {
    name: "emerald",
    label: "Emerald",
    hex: "#10b981",
    lightPrimary: "158.1 64.4% 45.6%",
    darkPrimary: "158.1 64.4% 51.6%",
    ring: "158.1 64.4% 51.6%",
  },
  violet: {
    name: "violet",
    label: "Vercel Violet",
    hex: "#8b5cf6",
    lightPrimary: "262.1 83.3% 57.8%",
    darkPrimary: "262.1 83.3% 65.8%",
    ring: "262.1 83.3% 57.8%",
  },
  amber: {
    name: "amber",
    label: "Amber",
    hex: "#f59e0b",
    lightPrimary: "37.7 92.1% 50.2%",
    darkPrimary: "37.7 92.1% 55.2%",
    ring: "37.7 92.1% 50.2%",
  },
  rose: {
    name: "rose",
    label: "Rose",
    hex: "#f43f5e",
    lightPrimary: "346.8 77.2% 49.8%",
    darkPrimary: "346.8 77.2% 59.8%",
    ring: "346.8 77.2% 49.8%",
  },
  cyan: {
    name: "cyan",
    label: "Cyber Cyan",
    hex: "#06b6d4",
    lightPrimary: "188.7 94.5% 42.7%",
    darkPrimary: "188.7 94.5% 52.7%",
    ring: "188.7 94.5% 42.7%",
  },
};

export const FONT_PRESETS: Record<FontFamily, { label: string; css: string }> = {
  inter: {
    label: "Inter",
    css: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  geist: {
    label: "Geist Sans",
    css: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  jakarta: {
    label: "Plus Jakarta Sans",
    css: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  system: {
    label: "System Native",
    css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
};

interface ThemeState {
  accentColor: AccentColor;
  radius: BorderRadius;
  fontFamily: FontFamily;
  setAccentColor: (accent: AccentColor) => void;
  setRadius: (radius: BorderRadius) => void;
  setFontFamily: (font: FontFamily) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      accentColor: "blue",
      radius: "0.5rem",
      fontFamily: "inter",
      setAccentColor: (accent) => set({ accentColor: accent }),
      setRadius: (radius) => set({ radius }),
      setFontFamily: (font) => set({ fontFamily: font }),
    }),
    {
      name: "csv-tidy-theme-preferences",
    }
  )
);
