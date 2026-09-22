import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { QuizRunner, type QuizItem } from "@/components/quiz/quiz-runner";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Quiz" };
export const dynamic = "force-dynamic";

type QuizPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ position?: string }>;
};

export default async function QuizPage({ params, searchParams }: QuizPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
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

  return (
    <div className="shell">
      <AppSidebar active="quiz" role={role} />
      <QuizRunner initialItem={item} />
    </div>
  );
}
