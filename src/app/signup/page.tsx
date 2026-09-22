import type { Metadata } from "next";
import Link from "next/link";
import { signUp } from "./actions";

export const metadata: Metadata = { title: "Create account" };

type SignupPageProps = { searchParams: Promise<{ error?: string }> };

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error } = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="signup-title">
        <Link className="brand" href="/">
          <span className="brand-mark">N</span>
          <span style={{ color: "var(--ink)" }}>NLE Reviewer</span>
        </Link>
        <p className="eyebrow">New learning account</p>
        <h1 id="signup-title">Start your review</h1>
        <p className="muted">Create an account to save quiz scores, history, and preferences.</p>

        {error ? <p className="auth-error">{error}</p> : null}

        <form action={signUp}>
          <label className="field">
            Display name
            <input name="display_name" type="text" autoComplete="name" maxLength={80} required />
          </label>
          <label className="field">
            Email address
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            Password
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label className="field">
            Confirm password
            <input name="confirm_password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <button className="button" type="submit">Create account</button>
        </form>

        <p className="auth-switch">Already registered? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}

