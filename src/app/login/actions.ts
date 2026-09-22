"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { APPEARANCE_COOKIE, appearanceFromPreferences } from "@/lib/appearance";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=Supabase%20is%20not%20connected%20yet.");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=Enter%20your%20email%20and%20password.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (userId) {
    const [{ data: profile }, { data: preferences }] = await Promise.all([
      supabase.from("profiles").select("is_approved, is_blocked").eq("id", userId).single(),
      supabase
        .from("user_preferences")
        .select("theme, accent_color, font_scale, reduced_motion")
        .eq("user_id", userId)
        .single(),
    ]);

    if (!profile?.is_approved || profile.is_blocked) redirect("/pending-approval");

    const cookieStore = await cookies();
    cookieStore.set(APPEARANCE_COOKIE, JSON.stringify(appearanceFromPreferences(preferences)), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 31536000,
    });
  }
  redirect("/dashboard");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  const cookieStore = await cookies();
  cookieStore.delete(APPEARANCE_COOKIE);
  redirect("/login");
}
