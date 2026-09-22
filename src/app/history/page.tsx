import type { Metadata } from "next";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Quiz History" };
export const dynamic = "force-dynamic";

type Attempt = {
  id: string;
  title: string | null;
  status: "active" | "submitted" | "abandoned";
  total_questions: number;
  answered_count: number;
  correct_count: number;
  score_percent: number;
  started_at: string;
  submitted_at: string | null;
  duration_ms: number | null;
};

function formatDuration(durationMs: number | null) {
  if (!durationMs) return "—";
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export default async function HistoryPage() {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select(
      "id, title, status, total_questions, answered_count, correct_count, score_percent, started_at, submitted_at, duration_ms",
    )
    .eq("user_id", userId)
    .order("started_at", { ascending: false });

  const attempts = (data ?? []) as Attempt[];
  const completed = attempts.filter((attempt) => attempt.status === "submitted");
  const averageScore = completed.length
    ? Math.round(completed.reduce((sum, attempt) => sum + Number(attempt.score_percent), 0) / completed.length)
    : 0;
  const bestScore = completed.length
    ? Math.max(...completed.map((attempt) => Number(attempt.score_percent)))
    : 0;

  return (
    <div className="shell">
      <AppSidebar active="history" />

      <main className="main history-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Your attempts</p>
            <h1>Quiz history</h1>
            <p className="page-description">Review completed quizzes or continue an unfinished attempt.</p>
          </div>
          <Link className="button" href="/quiz/new">New quiz</Link>
        </header>

        <section className="history-metrics" aria-label="Quiz history summary">
          <article><span>Completed</span><strong>{completed.length}</strong></article>
          <article><span>Average score</span><strong>{averageScore}%</strong></article>
          <article><span>Best score</span><strong>{bestScore}%</strong></article>
        </section>

        {error ? <p className="notice notice-error">{error.message}</p> : null}

        {attempts.length ? (
          <section className="history-list" aria-label="Quiz attempts">
            {attempts.map((attempt) => {
              const isComplete = attempt.status === "submitted";
              const isActive = attempt.status === "active";
              const targetPosition = isComplete
                ? 1
                : Math.min(attempt.answered_count + 1, attempt.total_questions);

              return (
                <article className="history-row" key={attempt.id}>
                  <div className="history-title">
                    <span
                      className={`status-badge ${
                        isComplete ? "status-published" : isActive ? "status-draft" : "status-archived"
                      }`}
                    >
                      {isComplete ? "Completed" : isActive ? "In progress" : "Abandoned"}
                    </span>
                    <div>
                      <h2>{attempt.title ?? "Quiz"}</h2>
                      <p>
                        {new Date(attempt.submitted_at ?? attempt.started_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="history-detail">
                    <span>Score</span>
                    <strong>{isComplete ? `${Number(attempt.score_percent).toFixed(0)}%` : "—"}</strong>
                  </div>
                  <div className="history-detail">
                    <span>Correct</span>
                    <strong>{attempt.correct_count}/{attempt.total_questions}</strong>
                  </div>
                  <div className="history-detail">
                    <span>Time</span>
                    <strong>{formatDuration(attempt.duration_ms)}</strong>
                  </div>
                  {attempt.status === "abandoned" ? (
                    <span className="history-unavailable">Closed</span>
                  ) : (
                    <Link className="button button-secondary" href={`/quiz/${attempt.id}?position=${targetPosition}`}>
                      {isComplete ? "Review" : "Continue"}
                    </Link>
                  )}
                </article>
              );
            })}
          </section>
        ) : (
          <section className="empty-state panel history-empty">
            <div>
              <strong>No quiz attempts yet</strong>
              <p className="muted">Start a quiz and it will be saved here automatically.</p>
              <Link className="button" href="/quiz/new">Start your first quiz</Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
