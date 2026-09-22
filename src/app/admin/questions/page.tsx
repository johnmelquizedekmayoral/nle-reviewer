import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { FormSubmitButton } from "@/components/form-submit-button";
import { DeleteQuestionForm } from "@/components/questions/delete-question-form";
import { requireStaff } from "@/lib/auth/require-staff";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  bulkCreateQuestions,
  createCategory,
  createQuestion,
  deleteQuestion,
  setQuestionVisibility,
} from "./actions";

export const metadata: Metadata = { title: "Question Manager" };
export const dynamic = "force-dynamic";

type CategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
  kind: "subject" | "topic" | "subtopic" | "folder";
};

type QuestionRow = {
  id: string;
  category_id: string;
  question_text: string;
  status: "draft" | "published" | "archived";
  created_at: string;
};

type QuestionManagerProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

function buildCategoryPath(category: CategoryRow, byId: Map<string, CategoryRow>) {
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

export default async function QuestionManagerPage({ searchParams }: QuestionManagerProps) {
  if (!isSupabaseConfigured()) redirect("/dashboard");

  const { success, error } = await searchParams;
  const { supabase, role } = await requireStaff();
  const [{ data: categoryData }, { data: questionData }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, parent_id, name, kind")
      .eq("is_archived", false)
      .order("sort_order")
      .order("name"),
    supabase
      .from("questions")
      .select("id, category_id, question_text, status, created_at")
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const categories = (categoryData ?? []) as CategoryRow[];
  const questions = (questionData ?? []) as QuestionRow[];
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const categoryOptions = categories
    .map((category) => ({
      ...category,
      path: buildCategoryPath(category, categoriesById),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return (
    <div className="shell">
      <AppSidebar active="questions" role={role} />

      <main className="main admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Content administration</p>
            <h1>Question Manager</h1>
            <p className="page-description">
              Organize the question bank and add board-style questions with complete explanations.
            </p>
          </div>
          <div className="header-stat">
            <strong>{questions.length}</strong>
            <span>recent questions</span>
          </div>
        </header>

        {success ? <p className="notice notice-success">{success}</p> : null}
        {error ? <p className="notice notice-error">{error}</p> : null}

        <section className="admin-grid">
          <article className="form-card compact-card">
            <div className="card-heading">
              <div>
                <p className="step-number">01</p>
                <h2>Create a category</h2>
              </div>
              <span className="count-badge">{categories.length} total</span>
            </div>
            <p className="form-help">
              Build the hierarchy as subject → topic → subtopic. Parent is optional for a root subject.
            </p>

            <form className="manager-form" action={createCategory}>
              <label className="field">
                Category name
                <input name="name" placeholder="Example: Fundamentals of Nursing" maxLength={120} required />
              </label>

              <div className="form-grid two-columns">
                <label className="field">
                  Type
                  <select name="kind" defaultValue="subject">
                    <option value="subject">Subject</option>
                    <option value="topic">Topic</option>
                    <option value="subtopic">Subtopic</option>
                    <option value="folder">Folder</option>
                  </select>
                </label>

                <label className="field">
                  Parent
                  <select name="parent_id" defaultValue="">
                    <option value="">None — root level</option>
                    {categoryOptions.map((category) => (
                      <option value={category.id} key={category.id}>
                        {category.path}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <FormSubmitButton pendingLabel="Creating category…">Create category</FormSubmitButton>
            </form>
          </article>

          <article className="form-card question-card">
            <div className="card-heading">
              <div>
                <p className="step-number">02</p>
                <h2>Add a question</h2>
              </div>
              <span className="count-badge">4 choices</span>
            </div>

            {!categories.length ? (
              <p className="notice notice-warning">
                Create at least one category before adding a question.
              </p>
            ) : null}

            <form className="manager-form" action={createQuestion}>
              <label className="field">
                Category
                <select name="category_id" defaultValue="" required disabled={!categories.length}>
                  <option value="" disabled>Select a category</option>
                  {categoryOptions.map((category) => (
                    <option value={category.id} key={category.id}>
                      {category.path}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Question
                <textarea
                  name="question_text"
                  rows={4}
                  placeholder="Enter the complete question text"
                  required
                  disabled={!categories.length}
                />
              </label>

              <fieldset className="choice-fieldset" disabled={!categories.length}>
                <legend>Answer choices and correct answer</legend>
                <p className="form-help">Select the radio button beside the correct choice.</p>
                {(["A", "B", "C", "D"] as const).map((label) => (
                  <div className="choice-row" key={label}>
                    <input
                      aria-label={`Mark choice ${label} as correct`}
                      name="correct_answer"
                      type="radio"
                      value={label}
                      required
                    />
                    <span className="choice-label">{label}</span>
                    <input
                      aria-label={`Choice ${label}`}
                      name={`choice_${label}`}
                      placeholder={`Choice ${label}`}
                      required
                    />
                  </div>
                ))}
              </fieldset>

              <label className="field">
                Explanation
                <textarea
                  name="explanation"
                  rows={5}
                  placeholder="Explain why the selected answer is correct. Include solution steps when needed."
                  required
                  disabled={!categories.length}
                />
              </label>

              <div className="form-grid two-columns">
                <label className="field">
                  Source <span className="optional">Optional</span>
                  <input name="source" placeholder="Book, lecture, or exam" disabled={!categories.length} />
                </label>
                <label className="field">
                  Visibility
                  <select name="status" defaultValue="published" disabled={!categories.length}>
                    <option value="published">Visible</option>
                    <option value="draft">Hidden</option>
                  </select>
                </label>
              </div>

              <FormSubmitButton pendingLabel="Saving question…" disabled={!categories.length}>
                Save question
              </FormSubmitButton>
            </form>
          </article>
        </section>

        <section className="form-card bulk-card">
          <div className="card-heading">
            <div>
              <p className="step-number">03</p>
              <h2>Bulk question parser</h2>
            </div>
            <span className="count-badge">Paste multiple</span>
          </div>
          <p className="form-help">
            Paste consecutive numbered questions using A–D choices, an Answer line, and an Explanation line.
            All parsed questions will use the category and visibility selected below.
          </p>

          <form className="manager-form" action={bulkCreateQuestions}>
            <div className="form-grid bulk-settings">
              <label className="field">
                Category
                <select name="bulk_category_id" defaultValue="" required disabled={!categories.length}>
                  <option value="" disabled>Select a category</option>
                  {categoryOptions.map((category) => (
                    <option value={category.id} key={category.id}>
                      {category.path}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Visibility
                <select name="bulk_status" defaultValue="published" disabled={!categories.length}>
                  <option value="published">Visible</option>
                  <option value="draft">Hidden</option>
                </select>
              </label>
              <label className="field">
                Source <span className="optional">Optional</span>
                <input name="bulk_source" placeholder="Book, lecture, or exam" disabled={!categories.length} />
              </label>
            </div>

            <label className="field">
              Formatted questions
              <textarea
                className="parser-input"
                name="bulk_questions"
                rows={16}
                placeholder={
                  "1. Question text\nA. Option\nB. Option\nC. Option\nD. Option\nAnswer: B\nExplanation: Why B is correct"
                }
                required
                disabled={!categories.length}
              />
            </label>

            <FormSubmitButton pendingLabel="Importing questions…" disabled={!categories.length}>
              Parse and add questions
            </FormSubmitButton>
          </form>
        </section>

        <section className="question-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Latest entries</p>
              <h2>Question bank</h2>
            </div>
            <span className="muted">Showing the newest 50</span>
          </div>

          {questions.length ? (
            <div className="question-list">
              {questions.map((question, index) => {
                const category = categoriesById.get(question.category_id);
                return (
                  <article className="question-row" key={question.id}>
                    <span className="question-index">{String(index + 1).padStart(2, "0")}</span>
                    <div className="question-copy">
                      <strong>{question.question_text}</strong>
                      <p>
                        {category ? buildCategoryPath(category, categoriesById) : "Uncategorized"}
                      </p>
                    </div>
                    <div className="question-controls">
                      <span className={`status-badge status-${question.status}`}>
                        {question.status === "published" ? "Visible" : "Hidden"}
                      </span>
                      <div className="row-actions">
                        <Link className="row-action" href={`/admin/questions/${question.id}`}>
                          Edit
                        </Link>
                        <form action={setQuestionVisibility}>
                          <input name="question_id" type="hidden" value={question.id} />
                          <input
                            name="status"
                            type="hidden"
                            value={question.status === "published" ? "draft" : "published"}
                          />
                          <FormSubmitButton className="row-action" pendingLabel="Updating visibility…">
                            {question.status === "published" ? "Hide" : "Show"}
                          </FormSubmitButton>
                        </form>
                        <DeleteQuestionForm action={deleteQuestion} questionId={question.id} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state panel">
              <div>
                <strong>No questions yet</strong>
                <p className="muted">Create a category, then add your first question above.</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
