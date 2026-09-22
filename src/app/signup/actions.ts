"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/signup?error=Supabase%20is%20not%20connected%20yet.");
  }

  const displayName = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!displayName || displayName.length > 80) {
    redirect("/signup?error=Display%20name%20must%20contain%201%20to%2080%20characters.");
  }
  if (!email) redirect("/signup?error=Enter%20a%20valid%20email%20address.");
  if (password.length < 8) {
    redirect("/signup?error=Password%20must%20contain%20at%20least%208%20characters.");
  }
  if (password !== confirmPassword) {
    redirect("/signup?error=Passwords%20do%20not%20match.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  if (data.session) redirect("/pending-approval");

  redirect("/login?success=Check%20your%20email%20and%20confirm%20your%20account%20before%20signing%20in.");
}
