"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/require-staff";
import { parseBulkQuestions } from "@/lib/questions/parse-bulk-questions";

const categoryKinds = new Set(["subject", "topic", "subtopic", "folder"]);
const questionStatuses = new Set(["draft", "published"]);
const answerLabels = ["A", "B", "C", "D"] as const;

function readQuestionForm(formData: FormData) {
  const categoryId = String(formData.get("category_id") ?? "").trim();
  const questionText = String(formData.get("question_text") ?? "").trim();
  const explanation = String(formData.get("explanation") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();
  const status = String(formData.get("status") ?? "published");
  const correctLabel = String(formData.get("correct_answer") ?? "");
  const choices = answerLabels.map((label, index) => ({
    label,
    choice_text: String(formData.get(`choice_${label}`) ?? "").trim(),
    is_correct: label === correctLabel,
    sort_order: index,
  }));

  if (!categoryId) goBack("error", "Choose a category.");
  if (!questionText) goBack("error", "Enter the question text.");
  if (!explanation) goBack("error", "Enter an explanation.");
  if (!questionStatuses.has(status)) goBack("error", "Choose a valid publishing status.");
  if (!answerLabels.includes(correctLabel as (typeof answerLabels)[number])) {
    goBack("error", "Choose the correct answer.");
  }
  if (choices.some((choice) => !choice.choice_text)) {
    goBack("error", "Complete all four answer choices.");
  }

  return { categoryId, questionText, explanation, source, status, choices };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "category";
}

function goBack(type: "success" | "error", message: string): never {
  redirect(`/admin/questions?${type}=${encodeURIComponent(message)}`);
}

export async function createCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "folder");
  const parentId = String(formData.get("parent_id") ?? "").trim() || null;

  if (!name || name.length > 120) goBack("error", "Enter a category name up to 120 characters.");
  if (!categoryKinds.has(kind)) goBack("error", "Choose a valid category type.");

  const { supabase } = await requireStaff();
  const { error } = await supabase.from("categories").insert({
    name,
    slug: slugify(name),
    kind,
    parent_id: parentId,
  });

  if (error?.code === "23505") {
    goBack("error", "A category with that name already exists in the selected location.");
  }
  if (error) goBack("error", error.message);

  revalidatePath("/admin/questions");
  goBack("success", "Category created.");
}

export async function createQuestion(formData: FormData) {
  const { categoryId, questionText, explanation, source, status, choices } =
    readQuestionForm(formData);

  const { supabase, userId } = await requireStaff();
  const { data: question, error: questionError } = await supabase
    .from("questions")
    .insert({
      category_id: categoryId,
      question_text: questionText,
      explanation,
      source: source || null,
      status,
      created_by: userId,
    })
    .select("id")
    .single();

  if (questionError || !question) {
    goBack("error", questionError?.message ?? "The question could not be created.");
  }

  const { error: choicesError } = await supabase.from("question_choices").insert(
    choices.map((choice) => ({
      question_id: question.id,
      label: choice.label,
      choice_text: choice.choice_text,
      is_correct: choice.is_correct,
      sort_order: choice.sort_order,
    })),
  );

  if (choicesError) {
    await supabase.from("questions").delete().eq("id", question.id);
    goBack("error", choicesError.message);
  }

  revalidatePath("/admin/questions");
  goBack("success", status === "published" ? "Question published." : "Draft saved.");
}

export async function bulkCreateQuestions(formData: FormData) {
  const categoryId = String(formData.get("bulk_category_id") ?? "").trim();
  const status = String(formData.get("bulk_status") ?? "published");
  const source = String(formData.get("bulk_source") ?? "").trim();
  const input = String(formData.get("bulk_questions") ?? "").trim();

  if (!categoryId) goBack("error", "Choose a category for the bulk questions.");
  if (!questionStatuses.has(status)) goBack("error", "Choose a valid bulk publishing status.");
  if (!input) goBack("error", "Paste at least one formatted question.");

  let parsed: ReturnType<typeof parseBulkQuestions>;
  try {
    parsed = parseBulkQuestions(input);
  } catch (error) {
    goBack("error", error instanceof Error ? error.message : "The pasted questions could not be parsed.");
  }

  const { supabase } = await requireStaff();
  const { data, error } = await supabase.rpc("bulk_create_questions", {
    p_category_id: categoryId,
    p_status: status,
    p_questions: parsed.map((question) => ({
      question_text: question.questionText,
      explanation: question.explanation,
      source,
      choices: question.choices.map((choice) => ({
        label: choice.label,
        choice_text: choice.choiceText,
        is_correct: choice.isCorrect,
        sort_order: choice.sortOrder,
      })),
    })),
  });

  if (error) goBack("error", error.message);

  revalidatePath("/admin/questions");
  goBack("success", `${data ?? parsed.length} questions added successfully.`);
}

export async function updateQuestion(formData: FormData) {
  const questionId = String(formData.get("question_id") ?? "").trim();
  if (!questionId) goBack("error", "Question ID is missing.");

  const { categoryId, questionText, explanation, source, status, choices } =
    readQuestionForm(formData);
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("update_question_with_choices", {
    p_question_id: questionId,
    p_category_id: categoryId,
    p_question_text: questionText,
    p_explanation: explanation,
    p_source: source,
    p_status: status,
    p_choices: choices,
  });

  if (error) {
    redirect(`/admin/questions/${questionId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/questions");
  revalidatePath(`/admin/questions/${questionId}`);
  goBack("success", "Question updated.");
}

export async function setQuestionVisibility(formData: FormData) {
  const questionId = String(formData.get("question_id") ?? "").trim();
  const status = String(formData.get("status") ?? "");

  if (!questionId || !questionStatuses.has(status)) {
    goBack("error", "Invalid visibility change.");
  }

  const { supabase } = await requireStaff();
  const { error } = await supabase
    .from("questions")
    .update({ status })
    .eq("id", questionId);

  if (error) goBack("error", error.message);

  revalidatePath("/admin/questions");
  goBack("success", status === "published" ? "Question is now visible." : "Question is now hidden.");
}

export async function deleteQuestion(formData: FormData) {
  const questionId = String(formData.get("question_id") ?? "").trim();
  if (!questionId) goBack("error", "Question ID is missing.");

  const { supabase } = await requireStaff();
  const { error } = await supabase.from("questions").delete().eq("id", questionId);

  if (error) goBack("error", error.message);

  revalidatePath("/admin/questions");
  goBack("success", "Question deleted.");
}
