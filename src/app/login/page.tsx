import type { Metadata } from "next";
import Link from "next/link";
import { signIn } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

type LoginPageProps = { searchParams: Promise<{ error?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">N</span>
          <span style={{ color: "var(--ink)" }}>NLE Review</span>
        </Link>
        <p className="eyebrow">Personal learning account</p>
        <h1 id="login-title">Continue your review</h1>
        <p className="muted">
          Sign in to keep your quiz history, mistakes, and progress together.
        </p>
        {error ? <p className="auth-error">{error}</p> : null}
        <form action={signIn}>
          <label className="field">
            Email address
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            Password
            <input name="password" type="password" autoComplete="current-password" minLength={6} required />
          </label>
          <button className="button" type="submit">Sign in</button>
        </form>
      </section>
    </main>
  );
}
