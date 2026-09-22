"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type QuizChoice = { id: string; label: string; choice_text: string };

export type QuizItem = {
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

type SubmitResult = {
  is_correct: boolean;
  answered_count: number;
  correct_count: number;
  total_questions: number;
  finished: boolean;
  selected_choice_ids: string[];
  correct_choice_ids: string[];
  explanation: string;
  score_percent: number;
  next_item: QuizItem | null;
};

export function QuizRunner({ initialItem }: { initialItem: QuizItem }) {
  const router = useRouter();
  const [item, setItem] = useState(initialItem);
  const [nextItem, setNextItem] = useState<QuizItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownAt = useRef(0);

  useEffect(() => { shownAt.current = Date.now(); }, [item.position]);

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedChoiceId = String(new FormData(event.currentTarget).get("selected_choice_id") ?? "");
    if (!selectedChoiceId || submitting) return;

    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data, error: submitError } = await supabase.rpc("submit_quiz_answer_fast", {
      p_attempt_id: item.attempt_id,
      p_item_id: item.item_id,
      p_selected_choice_id: selectedChoiceId,
      p_response_time_ms: Math.max(Date.now() - shownAt.current, 0),
    });

    if (submitError || !data) {
      setError(submitError?.message ?? "The answer could not be saved. Try again.");
      setSubmitting(false);
      return;
    }

    const result = data as SubmitResult;
    setItem((current) => ({
      ...current,
      answered: true,
      selected_choice_ids: result.selected_choice_ids,
      correct_choice_ids: result.correct_choice_ids,
      is_correct: result.is_correct,
      explanation: result.explanation,
      answered_count: result.answered_count,
      correct_count: result.correct_count,
      score_percent: result.score_percent,
      attempt_status: result.finished ? "submitted" : "active",
    }));
    setNextItem(result.next_item);
    setSubmitting(false);
  }

  function showNextQuestion() {
    if (!nextItem) {
      router.push(`/quiz/${item.attempt_id}?position=${item.position + 1}`);
      return;
    }
    setItem(nextItem);
    setNextItem(null);
    setError(null);
    window.history.pushState(null, "", `/quiz/${item.attempt_id}?position=${nextItem.position}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const selectedId = item.selected_choice_ids[0];
  const correctId = item.correct_choice_ids[0];
  const finished = item.attempt_status === "submitted";
  const isFinalQuestion = item.position === item.total_questions;
  const progress = Math.round((item.answered_count / item.total_questions) * 100);

  return (
    <main className="main quiz-main">
      <header className="quiz-top">
        <div><p className="eyebrow">{item.title ?? "Quiz"}</p><h1>Question {item.position} of {item.total_questions}</h1></div>
        <span className="quiz-score">{item.correct_count} correct</span>
      </header>
      <div className="quiz-progress" role="progressbar" aria-label="Quiz progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
      {error ? <p className="notice notice-error">{error}</p> : null}

      <article className="quiz-card">
        <p className="quiz-position">Select the best answer</p>
        <h2 className="quiz-question">{item.question_text}</h2>
        {item.answered ? (
          <div className="quiz-choices" aria-label="Answer choices">
            {item.choices.map((choice) => {
              const correct = choice.id === correctId;
              const wrong = choice.id === selectedId && !correct;
              return <div className={correct ? "quiz-choice correct" : wrong ? "quiz-choice wrong" : "quiz-choice"} key={choice.id}>
                <span className="quiz-choice-label">{choice.label}</span><span>{choice.choice_text}</span>
                {correct ? <strong>Correct</strong> : null}{wrong ? <strong>Your answer</strong> : null}
              </div>;
            })}
          </div>
        ) : (
          <form className="quiz-answer-form" onSubmit={submitAnswer} key={item.item_id}>
            <fieldset className="quiz-choices" disabled={submitting}>
              <legend className="sr-only">Answer choices</legend>
              {item.choices.map((choice) => <label className="quiz-choice" key={choice.id}>
                <input type="radio" name="selected_choice_id" value={choice.id} required />
                <span className="quiz-choice-label">{choice.label}</span><span>{choice.choice_text}</span>
              </label>)}
            </fieldset>
            <button className="button quiz-submit" type="submit" disabled={submitting}>{submitting ? "Checking answer…" : "Check answer"}</button>
            {submitting ? <div className="action-toast" role="status"><span />Saving answer…</div> : null}
          </form>
        )}

        {item.answered ? <section className={`quiz-feedback ${item.is_correct ? "success" : "error"}`}>
          <strong>{item.is_correct ? "Correct answer" : "Not quite"}</strong>
          <p>{item.explanation || "No explanation was added for this question."}</p>
        </section> : null}

        {item.answered ? <div className="quiz-actions">
          {isFinalQuestion && finished ? <div className="quiz-summary">
            <div><span>Final score</span><strong>{item.correct_count}/{item.total_questions} ({Number(item.score_percent).toFixed(0)}%)</strong></div>
            <Link className="button" href="/dashboard">View dashboard</Link>
            <Link className="button button-secondary" href="/quiz/new">Take another quiz</Link>
          </div> : <button className="button" type="button" onClick={showNextQuestion}>Next question</button>}
        </div> : null}
      </article>
    </main>
  );
}
