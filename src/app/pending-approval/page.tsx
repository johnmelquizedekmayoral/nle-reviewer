import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Approval pending" };
export const dynamic = "force-dynamic";

export default async function PendingApprovalPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, is_approved, is_blocked")
    .eq("id", userId)
    .single();

  if (profile?.is_approved && !profile.is_blocked) redirect("/dashboard");

  return (
    <main className="auth-page">
      <section className="auth-card pending-card">
        <span className="brand-mark">N</span>
        <p className="eyebrow">Account verification</p>
        <h1>Approval pending</h1>
        <p className="muted">
          Hi {profile?.display_name ?? "there"}. Your email is registered, but an administrator must approve your account before you can use the reviewer.
        </p>
        <p className="notice notice-warning">You can try signing in again after the administrator approves you.</p>
        <form action={signOut}>
          <FormSubmitButton className="button button-secondary" pendingLabel="Signing out…">Sign out</FormSubmitButton>
        </form>
      </section>
    </main>
  );
}
