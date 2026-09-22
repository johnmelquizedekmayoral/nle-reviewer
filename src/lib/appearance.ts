export const APPEARANCE_COOKIE = "nle-appearance";

export type Appearance = {
  theme:
    | "light"
    | "dark"
    | "system"
    | "midnight"
    | "ocean"
    | "forest"
    | "warm"
    | "retro"
    | "terminal"
    | "synthwave";
  accentColor: string;
  fontScale: number;
  reducedMotion: boolean;
};

export const defaultAppearance: Appearance = {
  theme: "system",
  accentColor: "green",
  fontScale: 1,
  reducedMotion: false,
};

export function parseAppearance(value?: string): Appearance {
  if (!value) return defaultAppearance;
  try {
    const parsed = JSON.parse(value) as Partial<Appearance>;
    return {
      theme: [
        "light",
        "dark",
        "system",
        "midnight",
        "ocean",
        "forest",
        "warm",
        "retro",
        "terminal",
        "synthwave",
      ].includes(parsed.theme ?? "")
        ? parsed.theme as Appearance["theme"]
        : defaultAppearance.theme,
      accentColor: typeof parsed.accentColor === "string" ? parsed.accentColor : "green",
      fontScale: typeof parsed.fontScale === "number" ? parsed.fontScale : 1,
      reducedMotion: Boolean(parsed.reducedMotion),
    };
  } catch {
    return defaultAppearance;
  }
}

export function appearanceFromPreferences(preferences: {
  theme?: string;
  accent_color?: string;
  font_scale?: number | string;
  reduced_motion?: boolean;
} | null): Appearance {
  if (!preferences) return defaultAppearance;
  return {
    theme: (preferences.theme as Appearance["theme"] | undefined) ?? "system",
    accentColor: preferences.accent_color ?? "green",
    fontScale: Number(preferences.font_scale ?? 1),
    reducedMotion: preferences.reduced_motion ?? false,
  };
}
