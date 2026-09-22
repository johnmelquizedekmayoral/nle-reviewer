"use server";

import { cookies } from "next/headers";
import { APPEARANCE_COOKIE } from "@/lib/appearance";
import { requireUser } from "@/lib/auth/require-user";

const themes = new Set(["system", "light", "dark", "midnight", "ocean", "forest", "warm", "retro", "terminal", "synthwave"]);
const accents = new Set(["green", "blue", "purple", "teal", "orange", "pink", "red"]);

export async function saveWorkspaceSettings(input: {
  displayName: string;
  theme: string;
  accentColor: string;
  fontScale: number;
  reducedMotion: boolean;
  defaultQuizSize: number;
}) {
  if (!input.displayName.trim() || input.displayName.length > 80) return { error: "Display name must contain 1 to 80 characters." };
  if (!themes.has(input.theme) || !accents.has(input.accentColor)) return { error: "Invalid appearance setting." };
  if (![0.9, 1, 1.1, 1.2].includes(input.fontScale)) return { error: "Invalid text size." };
  if (!Number.isInteger(input.defaultQuizSize) || input.defaultQuizSize < 5 || input.defaultQuizSize > 100) return { error: "Quiz size must be between 5 and 100." };

  const { supabase, userId } = await requireUser();
  const [{ error: profileError }, { error: preferenceError }] = await Promise.all([
    supabase.from("profiles").update({ display_name: input.displayName.trim() }).eq("id", userId),
    supabase.from("user_preferences").upsert({
      user_id: userId, theme: input.theme, accent_color: input.accentColor,
      font_scale: input.fontScale, reduced_motion: input.reducedMotion,
      default_quiz_size: input.defaultQuizSize,
    }),
  ]);
  const error = profileError ?? preferenceError;
  if (error) return { error: error.message };

  const cookieStore = await cookies();
  cookieStore.set(APPEARANCE_COOKIE, JSON.stringify({ theme: input.theme, accentColor: input.accentColor, fontScale: input.fontScale, reducedMotion: input.reducedMotion }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 31536000,
  });
  return { error: null };
}
