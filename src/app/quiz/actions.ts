"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";

export async function createQuiz(formData: FormData) {
  const categoryId = String(formData.get("category_id") ?? "").trim();
  const questionCount = Number(formData.get("question_count"));

  if (!categoryId) redirect("/quiz/new?error=Choose%20a%20category.");
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100) {
    redirect("/quiz/new?error=Question%20count%20must%20be%20between%201%20and%20100.");
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_quiz_attempt", {
    p_category_id: categoryId,
    p_question_count: questionCount,
  });

  if (error || !data) {
    redirect(`/quiz/new?error=${encodeURIComponent(error?.message ?? "Quiz could not be created.")}`);
  }

  redirect(`/quiz/${data}?position=1`);
}

export async function submitQuizAnswer(formData: FormData) {
  const attemptId = String(formData.get("attempt_id") ?? "").trim();
  const itemId = String(formData.get("item_id") ?? "").trim();
  const selectedChoiceId = String(formData.get("selected_choice_id") ?? "").trim();
  const position = Number(formData.get("position"));
  const shownAt = Date.parse(String(formData.get("shown_at") ?? ""));
  const responseTime = Number.isFinite(shownAt) ? Math.max(Date.now() - shownAt, 0) : 0;

  if (!attemptId || !itemId || !selectedChoiceId || !Number.isInteger(position)) {
    redirect(`/quiz/${attemptId}?position=${position || 1}&error=Select%20an%20answer.`);
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("submit_quiz_answer", {
    p_attempt_id: attemptId,
    p_item_id: itemId,
    p_selected_choice_id: selectedChoiceId,
    p_response_time_ms: responseTime,
  });

  if (error) {
    redirect(
      `/quiz/${attemptId}?position=${position}&error=${encodeURIComponent(error.message)}`,
    );
  }

  redirect(`/quiz/${attemptId}?position=${position}`);
}
