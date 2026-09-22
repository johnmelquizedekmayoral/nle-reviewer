import type { Metadata } from "next";
import { WorkspaceApp } from "@/components/workspace/workspace-app";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Workspace" };
export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const { supabase, userId, role } = await requireUser();
  const [{ data: profile }, { data: preferences }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).single(),
    supabase.from("user_preferences").select("theme, accent_color, font_scale, reduced_motion, default_quiz_size").eq("user_id", userId).single(),
  ]);

  return (
    <WorkspaceApp
      userId={userId}
      role={role}
      roleCheckedAt={new Date().toISOString()}
      initialName={profile?.display_name ?? "Learner"}
      initialPreferences={{
        theme: preferences?.theme ?? "system",
        accent_color: preferences?.accent_color ?? "green",
        font_scale: Number(preferences?.font_scale ?? 1),
        reduced_motion: preferences?.reduced_motion ?? false,
        default_quiz_size: preferences?.default_quiz_size ?? 20,
      }}
    />
  );
}
