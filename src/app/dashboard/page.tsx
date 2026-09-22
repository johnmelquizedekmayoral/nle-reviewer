import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

type DashboardData = {
  name: string;
  role: "learner" | "instructor" | "admin" | "superadmin";
  quizzes: number;
  questions: number;
  accuracy: number;
  studyMinutes: number;
  bestScore: number;
  averageResponseSeconds: number;
  masteredQuestions: number;
  weakQuestions: number;
  recentTrend: number | null;
  recentAttempts: Array<{
    id: string;
    title: string | null;
    totalQuestions: number;
    correctCount: number;
    scorePercent: number;
    submittedAt: string | null;
  }>;
};

async function getDashboardData(): Promise<DashboardData> {
  if (!isSupabaseConfigured()) {
    return {
      name: "Learner",
      role: "learner",
      quizzes: 0,
      questions: 0,
      accuracy: 0,
      studyMinutes: 0,
      bestScore: 0,
      averageResponseSeconds: 0,
      masteredQuestions: 0,
      weakQuestions: 0,
      recentTrend: null,
      recentAttempts: [],
    };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const [{ data: profile }, { data: attempts }, { data: stats }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, role, is_approved, is_blocked")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("quiz_attempts")
      .select("id, title, total_questions, correct_count, score_percent, submitted_at, duration_ms")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("user_question_stats")
      .select("times_seen, times_correct, times_wrong, total_response_time_ms, current_correct_streak")
      .eq("user_id", userId),
  ]);

  if (!profile?.is_approved || profile.is_blocked) redirect("/pending-approval");

  const rows = attempts ?? [];
  const questions = rows.reduce((sum, row) => sum + row.total_questions, 0);
  const correct = rows.reduce((sum, row) => sum + row.correct_count, 0);
  const duration = rows.reduce((sum, row) => sum + (row.duration_ms ?? 0), 0);
  const statRows = stats ?? [];
  const totalSeen = statRows.reduce((sum, row) => sum + row.times_seen, 0);
  const totalResponseTime = statRows.reduce(
    (sum, row) => sum + Number(row.total_response_time_ms),
    0,
  );
  const recentAverage = rows.length
    ? rows.slice(0, 5).reduce((sum, row) => sum + Number(row.score_percent), 0) / Math.min(rows.length, 5)
    : 0;
  const previousRows = rows.slice(5, 10);
  const previousAverage = previousRows.length
    ? previousRows.reduce((sum, row) => sum + Number(row.score_percent), 0) / previousRows.length
    : null;

  return {
    name: profile?.display_name || "Learner",
    role: profile?.role ?? "learner",
    quizzes: rows.length,
    questions,
    accuracy: questions ? Math.round((correct / questions) * 100) : 0,
    studyMinutes: Math.round(duration / 60000),
    bestScore: rows.length ? Math.round(Math.max(...rows.map((row) => Number(row.score_percent)))) : 0,
    averageResponseSeconds: totalSeen ? Math.round(totalResponseTime / totalSeen / 100) / 10 : 0,
    masteredQuestions: statRows.filter(
      (row) => row.times_seen >= 2 && row.times_correct / row.times_seen >= 0.8,
    ).length,
    weakQuestions: statRows.filter((row) => row.times_wrong > row.times_correct).length,
    recentTrend: previousAverage === null ? null : Math.round(recentAverage - previousAverage),
    recentAttempts: rows.slice(0, 5).map((attempt) => ({
      id: attempt.id,
      title: attempt.title,
      totalQuestions: attempt.total_questions,
      correctCount: attempt.correct_count,
      scorePercent: Number(attempt.score_percent),
      submittedAt: attempt.submitted_at,
    })),
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
    ["Best score", `${data.bestScore}%`, "Highest completed quiz"],
    ["Avg. response", `${data.averageResponseSeconds}s`, "Time per answered question"],
    ["Mastered questions", data.masteredQuestions, "80%+ after multiple attempts"],
    ["Weak questions", data.weakQuestions, "More wrong than correct"],
  ];

  return (
    <div className="shell">
      <AppSidebar active="dashboard" role={data.role} />

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Review dashboard</p>
            <h1>Welcome, {data.name}.</h1>
          </div>
          <Link className="button" href="/quiz/new">New quiz</Link>
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
              <Link className="text-link" href="/history">View all</Link>
            </div>
            {data.recentAttempts.length ? (
              <div className="recent-quiz-list">
                {data.recentAttempts.map((attempt) => (
                  <Link
                    className="recent-quiz"
                    href={`/quiz/${attempt.id}?position=1`}
                    key={attempt.id}
                  >
                    <div>
                      <strong>{attempt.title ?? "Quiz"}</strong>
                      <p>
                        {attempt.submittedAt
                          ? new Date(attempt.submittedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              timeZone: "UTC",
                            })
                          : "Completed"}
                      </p>
                    </div>
                    <div className="recent-quiz-score">
                      <strong>{attempt.scorePercent.toFixed(0)}%</strong>
                      <span>{attempt.correctCount}/{attempt.totalQuestions}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div>
                  <strong>No completed quizzes yet</strong>
                  <p className="muted">Finish your first quiz and its score will appear here.</p>
                </div>
              </div>
            )}
          </article>

          <article className="panel insight-panel">
            <h2>Performance insights</h2>
            <div className="insight-score">
              <strong>{data.accuracy}%</strong>
              <span>overall accuracy</span>
            </div>
            <div className="insight-list">
              <p><span>Recent trend</span><strong>{data.recentTrend === null ? "More data needed" : `${data.recentTrend >= 0 ? "+" : ""}${data.recentTrend} pts`}</strong></p>
              <p><span>Mastered</span><strong>{data.masteredQuestions} questions</strong></p>
              <p><span>Needs review</span><strong>{data.weakQuestions} questions</strong></p>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
