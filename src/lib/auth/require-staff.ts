import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const staffRoles = new Set(["instructor", "admin", "superadmin"]);

export async function requireStaff() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || !staffRoles.has(profile.role)) redirect("/dashboard");

  return { supabase, userId, role: profile.role };
}
