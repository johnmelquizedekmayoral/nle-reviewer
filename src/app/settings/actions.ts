"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { APPEARANCE_COOKIE } from "@/lib/appearance";
import { requireUser } from "@/lib/auth/require-user";

const themes = new Set([
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
]);
const accents = new Set(["green", "blue", "purple", "teal", "orange", "pink", "red"]);
const fontScales = new Set([0.9, 1, 1.1, 1.2]);

export async function saveSettings(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const theme = String(formData.get("theme") ?? "system");
  const accentColor = String(formData.get("accent_color") ?? "green");
  const fontScale = Number(formData.get("font_scale"));
  const reducedMotion = formData.get("reduced_motion") === "on";
  const defaultQuizSize = Number(formData.get("default_quiz_size"));

  if (!displayName || displayName.length > 80) {
    redirect("/settings?error=Display%20name%20must%20contain%201%20to%2080%20characters.");
  }
  if (!themes.has(theme) || !accents.has(accentColor) || !fontScales.has(fontScale)) {
    redirect("/settings?error=One%20or%20more%20settings%20are%20invalid.");
  }
  if (!Number.isInteger(defaultQuizSize) || defaultQuizSize < 5 || defaultQuizSize > 100) {
    redirect("/settings?error=Default%20quiz%20size%20must%20be%20between%205%20and%20100.");
  }

  const { supabase, userId } = await requireUser();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId);

  if (profileError) {
    redirect(`/settings?error=${encodeURIComponent(profileError.message)}`);
  }

  const { error: preferenceError } = await supabase.from("user_preferences").upsert({
    user_id: userId,
    theme,
    accent_color: accentColor,
    font_scale: fontScale,
    reduced_motion: reducedMotion,
    default_quiz_size: defaultQuizSize,
  });

  if (preferenceError) {
    redirect(`/settings?error=${encodeURIComponent(preferenceError.message)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    APPEARANCE_COOKIE,
    JSON.stringify({ theme, accentColor, fontScale, reducedMotion }),
    { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 31536000 },
  );

  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}
