import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

type DashboardData = {
  name: string;
  quizzes: number;
  questions: number;
  accuracy: number;
  studyMinutes: number;
};

async function getDashboardData(): Promise<DashboardData> {
  if (!isSupabaseConfigured()) {
    return { name: "Learner", quizzes: 0, questions: 0, accuracy: 0, studyMinutes: 0 };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const [{ data: profile }, { data: attempts }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase
      .from("quiz_attempts")
      .select("total_questions, correct_count, duration_ms")
      .eq("status", "submitted"),
  ]);

  const rows = attempts ?? [];
  const questions = rows.reduce((sum, row) => sum + row.total_questions, 0);
  const correct = rows.reduce((sum, row) => sum + row.correct_count, 0);
  const duration = rows.reduce((sum, row) => sum + (row.duration_ms ?? 0), 0);

  return {
    name: profile?.display_name || "Learner",
    quizzes: rows.length,
    questions,
    accuracy: questions ? Math.round((correct / questions) * 100) : 0,
    studyMinutes: Math.round(duration / 60000),
  };
}

export default async function DashboardPage() {
  const configured = isSupabaseConfigured();
  const data = await getDashboardData();
  const metrics = [
    ["Quizzes completed", data.quizzes, "Completed attempts"],
    ["Questions answered", data.questions, "Across all subjects"],
    ["Overall accuracy", `${data.accuracy}%`, "Based on submitted quizzes"],
    ["Study time", `${data.studyMinutes} min`, "Recorded quiz time"],
  ];

  return (
    <div className="shell">
      <AppSidebar active="dashboard" />

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Review dashboard</p>
            <h1>Welcome, {data.name}.</h1>
          </div>
          <button className="button" type="button" disabled>New quiz</button>
        </header>

        {!configured ? (
          <section className="setup-card">
            <div className="setup-row">
              <div>
                <strong>Connect Supabase to activate accounts and saving.</strong>
                <p>The application shell and database migration are ready. Add the project URL and publishable key next.</p>
              </div>
              <span className="setup-badge">Setup needed</span>
            </div>
          </section>
        ) : null}

        <section className="metrics" aria-label="Progress summary">
          {metrics.map(([label, value, note]) => (
            <article className="metric" key={label}>
              <p className="metric-label">{label}</p>
              <p className="metric-value">{value}</p>
              <p className="metric-foot"><span className="dot" /> {note}</p>
            </article>
          ))}
        </section>

        <section className="content-grid">
          <article className="panel">
            <div className="section-head">
              <h2>Recent quizzes</h2>
              <span className="muted">Latest first</span>
            </div>
            <div className="empty-state">
              <div>
                <strong>No completed quizzes yet</strong>
                <p className="muted">Your score, response time, and answer history will appear here after the quiz flow is connected.</p>
              </div>
            </div>
          </article>

          <article className="panel">
            <h2>Readiness foundation</h2>
            <div className="readiness-ring" aria-label="No readiness data yet" />
            <p className="muted" style={{ textAlign: "center", lineHeight: 1.6 }}>
              Readiness will be calculated only after enough reliable attempt data has been collected.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
