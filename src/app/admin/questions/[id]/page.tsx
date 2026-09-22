import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { FormSubmitButton } from "@/components/form-submit-button";
import { requireStaff } from "@/lib/auth/require-staff";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateQuestion } from "../actions";

export const metadata: Metadata = { title: "Edit Question" };
export const dynamic = "force-dynamic";

type CategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
};

type ChoiceRow = {
  label: "A" | "B" | "C" | "D";
  choice_text: string;
  is_correct: boolean;
  sort_order: number;
};

type QuestionRow = {
  id: string;
  category_id: string;
  question_text: string;
  explanation: string;
  source: string | null;
  status: "draft" | "published" | "archived";
  question_choices: ChoiceRow[];
};

type EditQuestionProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

function buildPath(category: CategoryRow, byId: Map<string, CategoryRow>) {
  const names = [category.name];
  const visited = new Set([category.id]);
  let parentId = category.parent_id;

  while (parentId && !visited.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    names.unshift(parent.name);
    visited.add(parent.id);
    parentId = parent.parent_id;
  }

  return names.join(" / ");
}

export default async function EditQuestionPage({ params, searchParams }: EditQuestionProps) {
  if (!isSupabaseConfigured()) redirect("/dashboard");

  const [{ id }, { error: pageError }] = await Promise.all([params, searchParams]);
  const { supabase, role } = await requireStaff();
  const [{ data: categoryData }, { data: questionData }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, parent_id, name")
      .eq("is_archived", false)
      .order("name"),
    supabase
      .from("questions")
      .select(
        "id, category_id, question_text, explanation, source, status, question_choices(label, choice_text, is_correct, sort_order)",
      )
      .eq("id", id)
      .single(),
  ]);

  if (!questionData) notFound();

  const categories = (categoryData ?? []) as CategoryRow[];
  const question = questionData as QuestionRow;
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const categoryOptions = categories
    .map((category) => ({ ...category, path: buildPath(category, categoryMap) }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const choices = [...question.question_choices].sort((a, b) => a.sort_order - b.sort_order);
  const choicesByLabel = new Map(choices.map((choice) => [choice.label, choice]));

  return (
    <div className="shell">
      <AppSidebar active="questions" role={role} />

      <main className="main admin-main edit-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Question Manager</p>
            <h1>Edit question</h1>
            <p className="page-description">
              Changes affect future quizzes. Existing quiz-history snapshots remain unchanged.
            </p>
          </div>
          <Link className="button button-secondary" href="/admin/questions">
            Back to questions
          </Link>
        </header>

        {pageError ? <p className="notice notice-error">{pageError}</p> : null}

        <article className="form-card edit-card">
          <form className="manager-form" action={updateQuestion}>
            <input name="question_id" type="hidden" value={question.id} />

            <label className="field">
              Category
              <select name="category_id" defaultValue={question.category_id} required>
                {categoryOptions.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.path}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Question
              <textarea name="question_text" rows={5} defaultValue={question.question_text} required />
            </label>

            <fieldset className="choice-fieldset">
              <legend>Answer choices and correct answer</legend>
              <p className="form-help">Select the radio button beside the correct choice.</p>
              {(["A", "B", "C", "D"] as const).map((label) => {
                const choice = choicesByLabel.get(label);
                return (
                  <div className="choice-row" key={label}>
                    <input
                      aria-label={`Mark choice ${label} as correct`}
                      name="correct_answer"
                      type="radio"
                      value={label}
                      defaultChecked={choice?.is_correct}
                      required
                    />
                    <span className="choice-label">{label}</span>
                    <input
                      aria-label={`Choice ${label}`}
                      name={`choice_${label}`}
                      defaultValue={choice?.choice_text ?? ""}
                      required
                    />
                  </div>
                );
              })}
            </fieldset>

            <label className="field">
              Explanation
              <textarea name="explanation" rows={6} defaultValue={question.explanation} required />
            </label>

            <div className="form-grid two-columns">
              <label className="field">
                Source <span className="optional">Optional</span>
                <input name="source" defaultValue={question.source ?? ""} />
              </label>
              <label className="field">
                Visibility
                <select
                  name="status"
                  defaultValue={question.status === "published" ? "published" : "draft"}
                >
                  <option value="published">Visible</option>
                  <option value="draft">Hidden</option>
                </select>
              </label>
            </div>

            <div className="form-actions">
              <FormSubmitButton pendingLabel="Saving question…">Save changes</FormSubmitButton>
              <Link className="button button-secondary" href="/admin/questions">Cancel</Link>
            </div>
          </form>
        </article>
      </main>
    </div>
  );
}
