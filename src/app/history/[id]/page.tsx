import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { ReviewResults, type ReviewItem } from "@/components/quiz/review-results";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Quiz Review" };
export const dynamic = "force-dynamic";

type ReviewPageProps = { params: Promise<{ id: string }> };

type AttemptItemRow = {
  id: string;
  position: number;
  question_snapshot: { question_text?: string };
  choices_snapshot: ReviewItem["choices"];
  correct_choice_ids: string[];
  selected_choice_ids: string[] | null;
  explanation_snapshot: string;
  is_correct: boolean | null;
};

export default async function QuizReviewPage({ params }: ReviewPageProps) {
  const { id } = await params;
  const { supabase, userId, role } = await requireUser();
  const [{ data: attempt }, { data: itemData }] = await Promise.all([
    supabase
      .from("quiz_attempts")
      .select("id, title, total_questions, correct_count, score_percent, submitted_at")
      .eq("id", id)
      .eq("user_id", userId)
      .eq("status", "submitted")
      .maybeSingle(),
    supabase
      .from("quiz_attempt_items")
      .select(
        "id, position, question_snapshot, choices_snapshot, correct_choice_ids, selected_choice_ids, explanation_snapshot, is_correct",
      )
      .eq("attempt_id", id)
      .order("position"),
  ]);

  if (!attempt) notFound();
  const items = ((itemData ?? []) as AttemptItemRow[]).map((item) => ({
    id: item.id,
    position: item.position,
    questionText: item.question_snapshot.question_text ?? "Question unavailable",
    choices: item.choices_snapshot,
    correctChoiceIds: item.correct_choice_ids,
    selectedChoiceIds: item.selected_choice_ids ?? [],
    explanation: item.explanation_snapshot,
    isCorrect: Boolean(item.is_correct),
  }));

  return (
    <div className="shell">
      <AppSidebar active="history" role={role} />
      <main className="main review-main">
        <header className="admin-header review-header">
          <div>
            <p className="eyebrow">Completed quiz</p>
            <h1>{attempt.title ?? "Quiz review"}</h1>
            <p className="page-description">
              {attempt.correct_count}/{attempt.total_questions} correct · {Number(attempt.score_percent).toFixed(0)}%
            </p>
          </div>
          <Link className="button button-secondary" href="/history">Back to history</Link>
        </header>

        <ReviewResults items={items} />
      </main>
    </div>
  );
}

