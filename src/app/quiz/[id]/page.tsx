import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { FormSubmitButton } from "@/components/form-submit-button";
import { requireUser } from "@/lib/auth/require-user";
import { submitQuizAnswer } from "../actions";

export const metadata: Metadata = { title: "Quiz" };
export const dynamic = "force-dynamic";

type QuizChoice = {
  id: string;
  label: string;
  choice_text: string;
};

type QuizItem = {
  attempt_id: string;
  attempt_status: "active" | "submitted" | "abandoned";
  title: string | null;
  total_questions: number;
  answered_count: number;
  correct_count: number;
  score_percent: number;
  item_id: string;
  position: number;
  shown_at: string;
  question_text: string;
  choices: QuizChoice[];
  answered: boolean;
  selected_choice_ids: string[];
  is_correct: boolean | null;
  correct_choice_ids: string[];
  explanation: string | null;
};

type QuizPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ position?: string; error?: string }>;
};

export default async function QuizPage({ params, searchParams }: QuizPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const requestedPosition = Number(query.position ?? "1");

  if (!Number.isInteger(requestedPosition) || requestedPosition < 1) {
    redirect(`/quiz/${id}?position=1`);
  }

  const { supabase, role } = await requireUser();
  const { data, error } = await supabase.rpc("get_quiz_attempt_item", {
    p_attempt_id: id,
    p_position: requestedPosition,
  });

  if (error) {
    return (
      <div className="shell">
        <AppSidebar active="quiz" role={role} />
        <main className="main quiz-main">
          <p className="notice notice-error">{error.message}</p>
          <Link className="button button-secondary" href="/quiz/new">Start another quiz</Link>
        </main>
      </div>
    );
  }

  if (!data) notFound();
  const item = data as QuizItem;
  const latestAllowedPosition = Math.min(item.answered_count + 1, item.total_questions);

  if (item.attempt_status === "active" && requestedPosition > latestAllowedPosition) {
    redirect(`/quiz/${id}?position=${latestAllowedPosition}`);
  }

  const selectedId = item.selected_choice_ids[0];
  const correctId = item.correct_choice_ids[0];
  const finished = item.attempt_status === "submitted";
  const isFinalQuestion = item.position === item.total_questions;
  const progress = Math.round((item.answered_count / item.total_questions) * 100);

  return (
    <div className="shell">
      <AppSidebar active="quiz" role={role} />

      <main className="main quiz-main">
        <header className="quiz-top">
          <div>
            <p className="eyebrow">{item.title ?? "Quiz"}</p>
            <h1>Question {item.position} of {item.total_questions}</h1>
          </div>
          <span className="quiz-score">{item.correct_count} correct</span>
        </header>

        <div
          className="quiz-progress"
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>

        {query.error ? <p className="notice notice-error">{query.error}</p> : null}

        <article className="quiz-card">
          <p className="quiz-position">Select the best answer</p>
          <h2 className="quiz-question">{item.question_text}</h2>

          {item.answered ? (
            <div className="quiz-choices" aria-label="Answer choices">
              {item.choices.map((choice) => {
                const isCorrectChoice = choice.id === correctId;
                const isWrongSelection = choice.id === selectedId && !isCorrectChoice;
                const choiceClass = isCorrectChoice
                  ? "quiz-choice correct"
                  : isWrongSelection
                    ? "quiz-choice wrong"
                    : "quiz-choice";

                return (
                  <div className={choiceClass} key={choice.id}>
                    <span className="quiz-choice-label">{choice.label}</span>
                    <span>{choice.choice_text}</span>
                    {isCorrectChoice ? <strong>Correct</strong> : null}
                    {isWrongSelection ? <strong>Your answer</strong> : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <form className="quiz-answer-form" action={submitQuizAnswer}>
              <input type="hidden" name="attempt_id" value={item.attempt_id} />
              <input type="hidden" name="item_id" value={item.item_id} />
              <input type="hidden" name="position" value={item.position} />
              <input type="hidden" name="shown_at" value={item.shown_at} />

              <fieldset className="quiz-choices">
                <legend className="sr-only">Answer choices</legend>
                {item.choices.map((choice) => (
                  <label className="quiz-choice" key={choice.id}>
                    <input
                      type="radio"
                      name="selected_choice_id"
                      value={choice.id}
                      required
                    />
                    <span className="quiz-choice-label">{choice.label}</span>
                    <span>{choice.choice_text}</span>
                  </label>
                ))}
              </fieldset>

              <FormSubmitButton className="button quiz-submit" pendingLabel="Checking answer…">
                Check answer
              </FormSubmitButton>
            </form>
          )}

          {item.answered ? (
            <section className={`quiz-feedback ${item.is_correct ? "success" : "error"}`}>
              <strong>{item.is_correct ? "Correct answer" : "Not quite"}</strong>
              <p>{item.explanation || "No explanation was added for this question."}</p>
            </section>
          ) : null}

          {item.answered ? (
            <div className="quiz-actions">
              {isFinalQuestion && finished ? (
                <div className="quiz-summary">
                  <div>
                    <span>Final score</span>
                    <strong>{item.correct_count}/{item.total_questions} ({Number(item.score_percent).toFixed(0)}%)</strong>
                  </div>
                  <Link className="button" href="/dashboard">View dashboard</Link>
                  <Link className="button button-secondary" href="/quiz/new">Take another quiz</Link>
                </div>
              ) : (
                <Link className="button" href={`/quiz/${id}?position=${item.position + 1}`}>
                  Next question
                </Link>
              )}
            </div>
          ) : null}
        </article>
      </main>
    </div>
  );
}
