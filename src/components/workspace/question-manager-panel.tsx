"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CategoryTree } from "@/components/workspace/category-tree";
import { parseBulkQuestions } from "@/lib/questions/parse-bulk-questions";
import { createClient } from "@/lib/supabase/client";
import type { LocalCategory, LocalQuestion } from "@/lib/offline/types";

type Props = { categories: LocalCategory[]; questions: LocalQuestion[]; onRefresh: () => Promise<void> };

export function QuestionManagerPanel({ categories, questions, onRefresh }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());
  const [search, setSearch] = useState("");
  const [entryMode, setEntryMode] = useState<"single" | "bulk">("single");
  const [editing, setEditing] = useState<LocalQuestion | null>(null);
  const [moveDestination, setMoveDestination] = useState("");
  const [categoryParentId, setCategoryParentId] = useState<string | null>(null);
  const [categoryMoveDestination, setCategoryMoveDestination] = useState("__root__");
  const [categoryRename, setCategoryRename] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const matchingQuestions = useMemo(() => {
    let filtered = questions;
    if (selectedCategory) {
    const descendants = new Set([selectedCategory]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const category of categories) if (category.parent_id && descendants.has(category.parent_id) && !descendants.has(category.id)) {
        descendants.add(category.id); changed = true;
      }
    }
      filtered = questions.filter((question) => descendants.has(question.category_id));
    }
    const query = search.trim().toLowerCase();
    return query ? filtered.filter((question) => question.question_text.toLowerCase().includes(query)) : filtered;
  }, [categories, questions, search, selectedCategory]);
  const visibleQuestions = matchingQuestions.slice(0, 250);
  const allMatchingSelected = matchingQuestions.length > 0 && matchingQuestions.every((question) => selectedIds.has(question.id));
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const categoryOptions = useMemo(() => [...categories].sort((a, b) => a.path.localeCompare(b.path)), [categories]);
  const questionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    questions.forEach((question) => counts.set(question.category_id, (counts.get(question.category_id) ?? 0) + 1));
    return counts;
  }, [questions]);
  const selectedFolder = selectedCategory ? categoryById.get(selectedCategory) ?? null : null;
  const selectedBranchIds = useMemo(() => {
    const branch = new Set<string>();
    if (!selectedCategory) return branch;
    branch.add(selectedCategory);
    let changed = true;
    while (changed) {
      changed = false;
      for (const category of categories) {
        if (category.parent_id && branch.has(category.parent_id) && !branch.has(category.id)) {
          branch.add(category.id); changed = true;
        }
      }
    }
    return branch;
  }, [categories, selectedCategory]);
  const categoryMoveOptions = useMemo(() => categoryOptions.filter((category) => !selectedBranchIds.has(category.id)), [categoryOptions, selectedBranchIds]);

  function selectCategory(id: string | null) {
    setSelectedCategory(id);
    setCategoryParentId(id);
    const folder = id ? categoryById.get(id) : null;
    setCategoryRename(folder?.name ?? "");
    setCategoryMoveDestination(folder?.parent_id ?? "__root__");
    setCategoryMessage(null);
  }

  async function submitQuestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true); setMessage(null);
    const form = new FormData(formElement);
    const categoryId = String(form.get("category_id") ?? "");
    const status = String(form.get("status") ?? "published");
    const source = String(form.get("source") ?? "");
    const supabase = createClient();
    try {
      if (entryMode === "bulk") {
        const parsed = parseBulkQuestions(String(form.get("bulk_questions") ?? ""));
        const { error } = await supabase.rpc("bulk_create_questions", { p_category_id: categoryId, p_status: status, p_questions: parsed.map((question) => ({
          question_text: question.questionText, explanation: question.explanation, source,
          choices: question.choices.map((choice) => ({ label: choice.label, choice_text: choice.choiceText, is_correct: choice.isCorrect, sort_order: choice.sortOrder })),
        })) });
        if (error) throw error;
        setMessage(`${parsed.length} questions added.`);
      } else {
        const choices = ["A", "B", "C", "D"].map((label, sortOrder) => ({
          label, choice_text: String(form.get(`choice_${label}`) ?? ""),
          is_correct: form.get("correct_answer") === label, sort_order: sortOrder,
        }));
        if (editing) {
          const { error } = await supabase.rpc("update_question_with_choices", {
            p_question_id: editing.id, p_category_id: categoryId,
            p_question_text: String(form.get("question_text") ?? ""),
            p_explanation: String(form.get("explanation") ?? ""), p_source: source,
            p_status: status, p_choices: choices,
          });
          if (error) throw error;
          setEditing(null); setMessage("Question updated.");
        } else {
          const { error } = await supabase.rpc("bulk_create_questions", { p_category_id: categoryId, p_status: status, p_questions: [{
            question_text: String(form.get("question_text") ?? ""), explanation: String(form.get("explanation") ?? ""), source, choices,
          }] });
          if (error) throw error;
          setMessage("Question added.");
        }
      }
      formElement.reset();
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The question change failed.");
    } finally { setBusy(false); }
  }

  async function runBulk(action: "show" | "hide" | "move" | "delete", categoryId?: string) {
    if (!selectedIds.size) return;
    if (action === "delete" && !window.confirm(`Archive ${selectedIds.size} selected questions?`)) return;
    setBusy(true); setMessage(null);
    try {
      const { data, error } = await createClient().rpc("bulk_manage_questions", {
        p_question_ids: [...selectedIds], p_action: action, p_category_id: categoryId || null,
      });
      if (error) setMessage(error.message); else {
        setMessage(`${data ?? selectedIds.size} questions updated.`); setSelectedIds(new Set());
        if (action === "move") setMoveDestination("");
        await onRefresh();
      }
    } catch (bulkError) {
      setMessage(bulkError instanceof Error ? bulkError.message : "The bulk action failed.");
    } finally { setBusy(false); }
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allMatchingSelected) matchingQuestions.forEach((question) => next.delete(question.id));
      else matchingQuestions.forEach((question) => next.add(question.id));
      return next;
    });
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("category_name") ?? "").trim();
    if (!name) { setCategoryMessage({ tone: "error", text: "Enter a folder name." }); return; }
    setCategoryBusy(true); setCategoryMessage(null);
    try {
      const { data: created, error } = await createClient().rpc("create_category_folder", {
        p_name: name,
        p_parent_id: categoryParentId,
      });
      if (error) setCategoryMessage({ tone: "error", text: error.message });
      else {
        form.reset();
        setCategoryMessage({ tone: "success", text: categoryParentId ? `Subfolder “${name}” created.` : `Root folder “${name}” created.` });
        await onRefresh();
        if (created?.id) {
          setCategoryParentId(created.id); setSelectedCategory(created.id);
          setCategoryRename(name); setCategoryMoveDestination(categoryParentId ?? "__root__");
        }
      }
    } catch (categoryError) {
      setCategoryMessage({ tone: "error", text: categoryError instanceof Error ? categoryError.message : "The folder could not be created." });
    } finally { setCategoryBusy(false); }
  }

  async function manageCategory(action: "move" | "rename" | "delete") {
    if (!selectedCategory || !selectedFolder) return;
    if (action === "rename" && !categoryRename.trim()) {
      setCategoryMessage({ tone: "error", text: "Enter the folder's new name." }); return;
    }
    if (action === "move" && (selectedFolder.parent_id ?? "__root__") === categoryMoveDestination) {
      setCategoryMessage({ tone: "error", text: "Choose a different destination." }); return;
    }
    if (action === "delete") {
      const branchQuestions = questions.filter((question) => selectedBranchIds.has(question.category_id)).length;
      const approved = window.confirm(`Delete “${selectedFolder.name}”, its ${selectedBranchIds.size - 1} subfolder(s), and archive ${branchQuestions} question(s)? Past quiz results will remain safe.`);
      if (!approved) return;
    }
    setCategoryBusy(true); setCategoryMessage(null);
    try {
      const { data, error } = await createClient().rpc("manage_category_branch", {
        p_category_id: selectedCategory,
        p_action: action,
        p_destination_id: action === "move" && categoryMoveDestination !== "__root__" ? categoryMoveDestination : null,
        p_name: action === "rename" ? categoryRename.trim() : null,
      });
      if (error) throw error;
      await onRefresh();
      if (action === "delete") {
        setSelectedCategory(null); setCategoryParentId(null); setCategoryRename("");
        setCategoryMessage({ tone: "success", text: `${data?.folders_archived ?? selectedBranchIds.size} folder(s) deleted; ${data?.questions_archived ?? 0} question(s) archived.` });
      } else if (action === "move") {
        setCategoryMessage({ tone: "success", text: `“${selectedFolder.name}” and its subfolders were moved.` });
      } else {
        setCategoryMessage({ tone: "success", text: `Folder renamed to “${categoryRename.trim()}”.` });
      }
    } catch (categoryError) {
      setCategoryMessage({ tone: "error", text: categoryError instanceof Error ? categoryError.message : "The folder change failed." });
    } finally { setCategoryBusy(false); }
  }

  const editChoices = new Map((Array.isArray(editing?.choices) ? editing.choices : []).map((choice) => [choice.label, choice]));

  return (
    <main className="workspace-panel question-workspace">
      <header className="admin-header"><div><p className="eyebrow">Local question workspace</p><h1>Question Manager</h1><p className="page-description">Browse folders as a tree, edit one question, or manage many at once.</p></div><span className="sync-badge">{questions.length} cached</span></header>
      {message ? <p className="notice">{message}</p> : null}
      <section className="question-manager-layout">
        <aside className="tree-panel">
          <div className="tree-panel-heading"><div><p className="eyebrow">Folder structure</p><h2>Categories</h2></div><span>{categories.length}</span></div>
          <CategoryTree categories={categories} selectedId={selectedCategory} onSelect={selectCategory} questionCounts={questionCounts} />
          <section className="tree-category-manager" aria-labelledby="category-manager-title">
            <div><h3 id="category-manager-title">Category Manager</h3><p>Create folders here, then select a folder in the tree to rename, move, or delete its complete branch.</p></div>
            <div className="tree-create-mode" aria-label="Choose folder type">
              <button type="button" className={categoryParentId === null ? "active" : ""} onClick={() => { setCategoryParentId(null); setCategoryMessage(null); }}>New root</button>
              <button type="button" className={categoryParentId !== null ? "active" : ""} disabled={!selectedFolder} onClick={() => { if (selectedCategory) setCategoryParentId(selectedCategory); setCategoryMessage(null); }}>New subfolder</button>
            </div>
            <p className="category-parent-label"><span>New folder location</span><strong>{categoryParentId ? categoryById.get(categoryParentId)?.path ?? "Selected folder" : "Root level"}</strong></p>
            <form className="tree-category-form" onSubmit={createCategory}>
              <label className="field">Folder name<input name="category_name" maxLength={120} placeholder={categoryParentId ? "New subfolder" : "New root folder"} disabled={categoryBusy} required /></label>
              <button className="button" type="submit" disabled={categoryBusy}>{categoryBusy ? "Creating…" : categoryParentId ? "Create subfolder" : "Create root folder"}</button>
            </form>
            {selectedFolder ? <section className="tree-branch-tools" aria-label={`Manage ${selectedFolder.name}`}>
              <div><h4>Manage selected folder</h4><small>{selectedBranchIds.size} folder(s) · {questions.filter((question) => selectedBranchIds.has(question.category_id)).length} question(s)</small></div>
              <label className="field">Folder name<input value={categoryRename} maxLength={120} disabled={categoryBusy} onChange={(event) => setCategoryRename(event.target.value)} /></label>
              <button className="button button-secondary" type="button" disabled={categoryBusy || !categoryRename.trim() || categoryRename.trim() === selectedFolder.name} onClick={() => manageCategory("rename")}>Rename folder</button>
              <label className="field">Move entire branch to<select value={categoryMoveDestination} disabled={categoryBusy} onChange={(event) => setCategoryMoveDestination(event.target.value)}><option value="__root__">Root level</option>{categoryMoveOptions.map((category) => <option value={category.id} key={category.id}>{category.path}</option>)}</select></label>
              <button className="button button-secondary" type="button" disabled={categoryBusy || (selectedFolder.parent_id ?? "__root__") === categoryMoveDestination} onClick={() => manageCategory("move")}>Move folder tree</button>
              <button className="button button-danger" type="button" disabled={categoryBusy} onClick={() => manageCategory("delete")}>Delete folder tree</button>
            </section> : null}
            {categoryMessage ? <p className={`tree-category-status ${categoryMessage.tone}`} role="status">{categoryMessage.text}</p> : null}
          </section>
        </aside>
        <div className="question-manager-content">
          <section className="form-card unified-entry">
            <div className="segmented-control"><button type="button" className={entryMode === "single" ? "active" : ""} onClick={() => setEntryMode("single")}>Add one</button><button type="button" className={entryMode === "bulk" ? "active" : ""} onClick={() => { setEntryMode("bulk"); setEditing(null); }}>Add in bulk</button></div>
            <form className="manager-form" onSubmit={submitQuestions} key={`${entryMode}-${editing?.id ?? "new"}`}>
              <div className="form-grid bulk-settings">
                <label className="field">Category<select name="category_id" defaultValue={editing?.category_id ?? selectedCategory ?? ""} required><option value="" disabled>Select category</option>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.path}</option>)}</select></label>
                <label className="field">Visibility<select name="status" defaultValue={editing?.status ?? "published"}><option value="published">Visible</option><option value="draft">Hidden</option></select></label>
                <label className="field">Source<input name="source" defaultValue={editing?.source ?? ""} /></label>
              </div>
              {entryMode === "bulk" ? <label className="field">Formatted questions<textarea className="parser-input" name="bulk_questions" rows={14} required placeholder={"1. Question text\nA. Option\nB. Option\nC. Option\nD. Option\nAnswer: B\nExplanation: Why B is correct"} /></label> : <>
                <label className="field">Question<textarea name="question_text" rows={3} defaultValue={editing?.question_text ?? ""} required /></label>
                <fieldset className="choice-fieldset"><legend>Choices</legend>{["A", "B", "C", "D"].map((label) => <div className="choice-row" key={label}><input type="radio" name="correct_answer" value={label} defaultChecked={editChoices.get(label)?.is_correct} required /><span className="choice-label">{label}</span><input name={`choice_${label}`} defaultValue={editChoices.get(label)?.choice_text ?? ""} required /></div>)}</fieldset>
                <label className="field">Explanation<textarea name="explanation" rows={4} defaultValue={editing?.explanation ?? ""} required /></label>
              </>}
              <div className="form-actions"><button className="button" type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Update question" : entryMode === "bulk" ? "Parse and add" : "Add question"}</button>{editing ? <button className="button button-secondary" type="button" onClick={() => setEditing(null)}>Cancel edit</button> : null}</div>
            </form>
          </section>

          <section className="bulk-toolbar">
            <strong>{selectedIds.size} selected</strong>
            <button type="button" disabled={busy || !matchingQuestions.length} onClick={toggleSelectAll}>{allMatchingSelected ? "Clear filtered" : `Select all (${matchingQuestions.length})`}</button>
            <input className="question-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cached questions" />
            <button type="button" disabled={busy || !selectedIds.size} onClick={() => runBulk("show")}>Show</button>
            <button type="button" disabled={busy || !selectedIds.size} onClick={() => runBulk("hide")}>Hide</button>
            <select aria-label="Move selected questions to category" value={moveDestination} disabled={busy || !selectedIds.size} onChange={(event) => setMoveDestination(event.target.value)}><option value="">Move to…</option>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.path}</option>)}</select>
            <button type="button" disabled={busy || !selectedIds.size || !moveDestination} onClick={() => runBulk("move", moveDestination)}>Move</button>
            <button className="danger" type="button" disabled={busy || !selectedIds.size} onClick={() => runBulk("delete")}>Delete</button>
          </section>

          <div className="question-list local-question-list">
            {visibleQuestions.map((question) => <article className="question-row" key={question.id}>
              <input type="checkbox" aria-label={`Select ${question.question_text}`} checked={selectedIds.has(question.id)} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(question.id); else next.delete(question.id); return next; })} />
              <div className="question-copy"><strong>{question.question_text}</strong><p>{categoryById.get(question.category_id)?.path ?? "Uncategorized"}</p></div>
              <div className="question-controls"><span className={`status-badge status-${question.status}`}>{question.status === "published" ? "Visible" : "Hidden"}</span><button className="row-action" type="button" onClick={() => { setEntryMode("single"); setEditing(question); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button></div>
            </article>)}
          </div>
          {matchingQuestions.length > visibleQuestions.length ? <p className="muted question-limit-note">Showing the first 250 of {matchingQuestions.length}. Narrow the folder or search to find more.</p> : null}
        </div>
      </section>
    </main>
  );
}
