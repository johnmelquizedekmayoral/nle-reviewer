import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { FormSubmitButton } from "@/components/form-submit-button";
import { requireUser } from "@/lib/auth/require-user";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createQuiz } from "../actions";

export const metadata: Metadata = { title: "New Quiz" };
export const dynamic = "force-dynamic";

type QuizCategory = {
  category_id: string;
  category_path: string;
  question_count: number;
};

type NewQuizPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewQuizPage({ searchParams }: NewQuizPageProps) {
  if (!isSupabaseConfigured()) redirect("/dashboard");

  const { error: pageError } = await searchParams;
  const { supabase, userId, role } = await requireUser();
  const [{ data, error }, { data: preferences }] = await Promise.all([
    supabase.rpc("get_quiz_categories"),
    supabase.from("user_preferences").select("default_quiz_size").eq("user_id", userId).single(),
  ]);
  const categories = (data ?? []) as QuizCategory[];

  return (
    <div className="shell">
      <AppSidebar active="quiz" role={role} />

      <main className="main quiz-setup-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Instant feedback mode</p>
            <h1>Start a quiz</h1>
            <p className="page-description">
              Choose a category and question count. Questions and answer choices are shuffled automatically.
            </p>
          </div>
        </header>

        {pageError ? <p className="notice notice-error">{pageError}</p> : null}
        {error ? <p className="notice notice-error">{error.message}</p> : null}

        {categories.length ? (
          <article className="form-card quiz-setup-card">
            <form className="manager-form" action={createQuiz}>
              <label className="field">
                Category
                <select name="category_id" defaultValue="" required>
                  <option value="" disabled>Select a subject or topic</option>
                  {categories.map((category) => (
                    <option value={category.category_id} key={category.category_id}>
                      {category.category_path} — {category.question_count} questions
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Number of questions
                <input
                  name="question_count"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={preferences?.default_quiz_size ?? 20}
                  required
                />
              </label>

              <div className="quiz-mode-note">
                <strong>Instant feedback</strong>
                <p>After every answer, you will see whether it is correct and read the explanation.</p>
              </div>

              <FormSubmitButton pendingLabel="Preparing quiz…">Begin quiz</FormSubmitButton>
            </form>
          </article>
        ) : (
          <section className="empty-state panel quiz-empty">
            <div>
              <strong>No visible questions are available</strong>
              <p className="muted">Add questions or change hidden questions to visible in Question Manager.</p>
              <Link className="button" href="/admin/questions">Open Question Manager</Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
