import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved, is_blocked")
    .eq("id", userId)
    .single();

  if (!profile?.is_approved || profile.is_blocked) redirect("/pending-approval");
  return { supabase, userId, role: profile.role };
}
