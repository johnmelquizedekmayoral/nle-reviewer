"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { OfflineQuiz } from "@/components/workspace/offline-quiz";
import { clearLocalWorkspace, deleteLocal, quizKey, readLocal, workspaceKey, writeLocal } from "@/lib/offline/db";
import type { LocalAttempt, LocalHistoryItem, LocalPreferences, OfflineQuizPack, UserRole, WorkspaceSnapshot } from "@/lib/offline/types";
import { createClient } from "@/lib/supabase/client";
import { saveWorkspaceSettings } from "@/app/workspace/actions";

type Panel = "dashboard" | "quiz" | "history" | "questions" | "users" | "settings";
type InitialPreferences = Omit<LocalPreferences, "user_id">;

const themes = ["system", "light", "dark", "midnight", "ocean", "forest", "warm", "retro", "terminal", "synthwave"];
const accents = ["green", "blue", "purple", "teal", "orange", "pink", "red"];
const QuestionManagerPanel = dynamic(
  () => import("@/components/workspace/question-manager-panel").then((module) => module.QuestionManagerPanel),
  { ssr: false, loading: () => <main className="workspace-panel"><p className="eyebrow">Opening local question bank…</p></main> },
);

async function uploadOfflinePack(pack: OfflineQuizPack) {
  return createClient().rpc("sync_offline_quiz_attempt", { p_attempt_id: pack.attempt.id, p_answers: pack.answers ?? [] });
}

export function WorkspaceApp({ userId, role, initialName, initialPreferences }: { userId: string; role: UserRole; initialName: string; initialPreferences: InitialPreferences }) {
  const [panel, setPanel] = useState<Panel>("dashboard");
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<OfflineQuizPack | null>(null);
  const [resultQuiz, setResultQuiz] = useState<OfflineQuizPack | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const cacheKey = workspaceKey(userId);
  const canManageQuestions = role !== "learner";
  const canManageUsers = role === "admin" || role === "superadmin";
  const router = useRouter();

  const refresh = useCallback(async (silent = false, includeBank = true) => {
    if (!navigator.onLine) { if (!silent) setNotice("Offline: using the latest data saved on this device."); return; }
    setSyncing(true);
    const { data, error } = await createClient().rpc("get_workspace_bootstrap", { p_include_bank: includeBank });
    if (error || !data) setNotice(error?.message ?? "Sync failed.");
    else {
      const incoming = data as WorkspaceSnapshot;
      const cached = includeBank ? null : await readLocal<WorkspaceSnapshot>(cacheKey);
      const next = includeBank ? incoming : { ...incoming, questions: cached?.questions ?? [] };
      setSnapshot(next); await writeLocal(cacheKey, next); if (!silent) setNotice("Everything is up to date.");
    }
    setSyncing(false);
  }, [cacheKey]);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      const cached = await readLocal<WorkspaceSnapshot>(cacheKey);
      if (!cancelled && cached) setSnapshot(cached);
      if (navigator.onLine) await refresh(true);
      const activeId = await readLocal<string>(`active-quiz:${userId}`);
      if (activeId) {
        const pack = await readLocal<OfflineQuizPack>(quizKey(activeId));
        if (!cancelled && pack && (pack.answers?.length ?? 0) < pack.items.length) setActiveQuiz(pack);
        if (!cancelled && pack && (pack.answers?.length ?? 0) === pack.items.length) {
          setResultQuiz(pack);
          if (navigator.onLine) {
            const { data } = await uploadOfflinePack(pack);
            if (data) {
              const incoming = data as WorkspaceSnapshot;
              const local = await readLocal<WorkspaceSnapshot>(cacheKey);
              const next = { ...incoming, questions: local?.questions ?? [] };
              setSnapshot(next); await writeLocal(cacheKey, next); await deleteLocal(quizKey(pack.attempt.id)); await deleteLocal(`active-quiz:${userId}`);
            }
          }
        }
      }
    }
    void start();
    const handleOnline = () => { setOnline(true); void start(); };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline); window.addEventListener("offline", handleOffline);
    return () => { cancelled = true; window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, [cacheKey, refresh, userId]);

  function choosePanel(next: Panel) { setPanel(next); setDrawerOpen(false); setNotice(null); }

  async function signOut() {
    await clearLocalWorkspace();
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function syncCompletedPack(pack: OfflineQuizPack) {
    if (!navigator.onLine) { setNotice("Result saved locally. It will sync when you reconnect."); return; }
    setSyncing(true);
    const { data, error } = await uploadOfflinePack(pack);
    if (error || !data) setNotice(`Result saved locally; sync retry needed: ${error?.message ?? "unknown error"}`);
    else {
      const incoming = data as WorkspaceSnapshot;
      const cached = await readLocal<WorkspaceSnapshot>(cacheKey);
      const next = { ...incoming, questions: cached?.questions ?? [] };
      setSnapshot(next); await writeLocal(cacheKey, next); await deleteLocal(quizKey(pack.attempt.id)); await deleteLocal(`active-quiz:${userId}`); setNotice("Quiz result synced.");
    }
    setSyncing(false);
  }

  async function completeQuiz(pack: OfflineQuizPack) {
    const answers = pack.answers ?? [];
    const correct = answers.filter((answer) => pack.items.find((item) => item.id === answer.item_id)?.correct_choice_ids.includes(answer.selected_choice_id)).length;
    const completedAttempt: LocalAttempt = { ...pack.attempt, status: "submitted", answered_count: answers.length, correct_count: correct, score_percent: answers.length ? correct * 100 / answers.length : 0, submitted_at: new Date().toISOString(), duration_ms: answers.reduce((sum, answer) => sum + answer.response_time_ms, 0) };
    const items: LocalHistoryItem[] = pack.items.map((item) => {
      const answer = answers.find((candidate) => candidate.item_id === item.id);
      return { id: item.id, attempt_id: pack.attempt.id, question_id: item.question_id, position: item.position, question_snapshot: { question_text: item.question_text }, choices_snapshot: item.choices, correct_choice_ids: item.correct_choice_ids, selected_choice_ids: answer ? [answer.selected_choice_id] : [], explanation_snapshot: item.explanation, is_correct: Boolean(answer && item.correct_choice_ids.includes(answer.selected_choice_id)), response_time_ms: answer?.response_time_ms ?? 0 };
    });
    if (snapshot) {
      const next = { ...snapshot, attempts: [completedAttempt, ...snapshot.attempts.filter((attempt) => attempt.id !== pack.attempt.id)], history_items: [...snapshot.history_items.filter((item) => item.attempt_id !== pack.attempt.id), ...items] };
      setSnapshot(next); await writeLocal(cacheKey, next);
    }
    setActiveQuiz(null); setResultQuiz({ ...pack, attempt: completedAttempt });
    window.setTimeout(() => void syncCompletedPack(pack), 900);
  }

  const preferences = snapshot?.preferences ?? { user_id: userId, ...initialPreferences };
  const name = snapshot?.profile.display_name ?? initialName;
  if (activeQuiz) return <OfflineQuiz pack={activeQuiz} onComplete={completeQuiz} onExit={() => setActiveQuiz(null)} />;

  const nav: Array<[Panel, string]> = [["dashboard", "Dashboard"], ["quiz", "Take a quiz"], ["history", "Quiz history"]];
  if (canManageQuestions) nav.push(["questions", "Question Manager"]);
  if (canManageUsers) nav.push(["users", "Users & roles"]);
  nav.push(["settings", "Settings"]);

  return (
    <div className="workspace-shell">
      <button className="mobile-menu-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation">☰</button>
      {drawerOpen ? <button className="drawer-backdrop" type="button" onClick={() => setDrawerOpen(false)} aria-label="Close navigation" /> : null}
      <aside className={`workspace-sidebar ${drawerOpen ? "open" : ""}`}>
        <button className="brand workspace-brand" type="button" onClick={() => choosePanel("dashboard")}><span className="brand-mark">N</span><span className="brand-name">NLE Reviewer</span></button>
        <nav aria-label="Workspace panels">{nav.map(([id, label]) => <button className={`nav-link ${panel === id ? "active" : ""}`} type="button" key={id} onClick={() => choosePanel(id)}><span>{label}</span></button>)}</nav>
        <div className="workspace-connection"><span className={online ? "online" : "offline"} />{online ? "Online" : "Offline"}<button type="button" onClick={() => refresh()} disabled={syncing}>{syncing ? "Syncing…" : "Sync now"}</button></div>
        <button className="sidebar-signout" type="button" onClick={signOut}>Sign out</button>
      </aside>

      <div className="workspace-stage">
        {notice ? <div className="workspace-toast" role="status">{notice}</div> : null}
        {!snapshot ? <WorkspaceSkeleton online={online} /> : null}
        {snapshot && panel === "dashboard" ? <DashboardPanel snapshot={snapshot} name={name} onQuiz={() => choosePanel("quiz")} /> : null}
        {snapshot && panel === "quiz" ? <QuizPanel snapshot={snapshot} preferences={preferences} online={online} result={resultQuiz} onStart={async (pack) => { setResultQuiz(null); setActiveQuiz(pack); await writeLocal(quizKey(pack.attempt.id), pack); await writeLocal(`active-quiz:${userId}`, pack.attempt.id); }} /> : null}
        {snapshot && panel === "history" ? <HistoryPanel snapshot={snapshot} /> : null}
        {snapshot && panel === "questions" && canManageQuestions ? <QuestionManagerPanel categories={snapshot.categories} questions={snapshot.questions} onRefresh={() => refresh(true)} /> : null}
        {snapshot && panel === "users" && canManageUsers ? <UsersPanel snapshot={snapshot} role={role} onRefresh={() => refresh(true, false)} /> : null}
        {snapshot && panel === "settings" ? <SettingsPanel name={name} preferences={preferences} onSaved={() => refresh(true, false)} /> : null}
      </div>
    </div>
  );
}

function WorkspaceSkeleton({ online }: { online: boolean }) {
  return <main className="workspace-panel"><p className="eyebrow">{online ? "Preparing local workspace" : "No offline copy found"}</p><h1>{online ? "Loading once…" : "Connect once to download your workspace."}</h1><div className="skeleton-grid"><i /><i /><i /><i /></div></main>;
}

function DashboardPanel({ snapshot, name, onQuiz }: { snapshot: WorkspaceSnapshot; name: string; onQuiz: () => void }) {
  const completed = snapshot.attempts.filter((attempt) => attempt.status === "submitted");
  const total = completed.reduce((sum, attempt) => sum + attempt.total_questions, 0);
  const correct = completed.reduce((sum, attempt) => sum + attempt.correct_count, 0);
  const accuracy = total ? Math.round(correct * 100 / total) : 0;
  const best = completed.length ? Math.max(...completed.map((attempt) => Number(attempt.score_percent))) : 0;
  const strengths = [...snapshot.topic_strengths].sort((a, b) => b.accuracy - a.accuracy);
  return <main className="workspace-panel"><header className="topbar"><div><p className="eyebrow">Local dashboard</p><h1>Welcome, {name}.</h1><p className="page-description">This panel recalculates from the data stored on your device.</p></div><button className="button" type="button" onClick={onQuiz}>New quiz</button></header>
    <section className="metrics"><Metric label="Quizzes" value={completed.length} note="Completed" /><Metric label="Questions" value={total} note="Answered" /><Metric label="Accuracy" value={`${accuracy}%`} note="Overall" /><Metric label="Best score" value={`${Math.round(best)}%`} note="Personal best" /></section>
    <section className="content-grid"><article className="panel"><h2>Strongest topics</h2><StrengthList rows={strengths.slice(0, 6)} empty="More quiz data is needed." /></article><article className="panel"><h2>Needs improvement</h2><StrengthList rows={[...strengths].reverse().slice(0, 6)} empty="More quiz data is needed." /></article></section>
  </main>;
}

function Metric({ label, value, note }: { label: string; value: string | number; note: string }) { return <article className="metric"><p className="metric-label">{label}</p><p className="metric-value">{value}</p><p className="metric-foot"><span className="dot" />{note}</p></article>; }
function StrengthList({ rows, empty }: { rows: WorkspaceSnapshot["topic_strengths"]; empty: string }) { return rows.length ? <div className="strength-list">{rows.map((row) => <div key={row.id}><span>{row.path}</span><strong>{row.accuracy}%</strong><i><b style={{ width: `${row.accuracy}%` }} /></i><small>{row.correct}/{row.attempts} correct</small></div>)}</div> : <p className="muted">{empty}</p>; }

function QuizPanel({ snapshot, preferences, online, result, onStart }: { snapshot: WorkspaceSnapshot; preferences: LocalPreferences; online: boolean; result: OfflineQuizPack | null; onStart: (pack: OfflineQuizPack) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!online) { setError("Connect to download a new quiz. A downloaded quiz can then run fully offline."); return; }
    setBusy(true); setError(null); const form = new FormData(event.currentTarget);
    const { data, error: requestError } = await createClient().rpc("create_offline_quiz_pack", { p_category_id: String(form.get("category_id")), p_question_count: Number(form.get("question_count")) });
    if (requestError || !data) setError(requestError?.message ?? "Quiz could not be downloaded."); else onStart({ ...(data as OfflineQuizPack), answers: [], current_position: 0, needs_sync: false });
    setBusy(false);
  }
  if (result) { const answers = result.answers ?? []; const correct = answers.filter((answer) => result.items.find((item) => item.id === answer.item_id)?.correct_choice_ids.includes(answer.selected_choice_id)).length; return <main className="workspace-panel"><article className="quiz-result-card"><p className="eyebrow">Results saved locally</p><h1>{Math.round(correct * 100 / Math.max(answers.length, 1))}%</h1><p>{correct} of {answers.length} correct</p><p className="muted">The result is uploading in the background when online.</p></article></main>; }
  return <main className="workspace-panel"><header><p className="eyebrow">Download once, answer locally</p><h1>Start a quiz</h1><p className="page-description">Starting requires a connection. After the pack loads, answering and explanations do not wait for the server.</p></header>{error ? <p className="notice notice-error">{error}</p> : null}<article className="form-card quiz-setup-card"><form className="manager-form" onSubmit={start}><label className="field">Category<select name="category_id" defaultValue="" required><option value="" disabled>Select a topic</option>{snapshot.quiz_categories.map((category) => <option key={category.category_id} value={category.category_id}>{category.category_path} — {category.question_count}</option>)}</select></label><label className="field">Questions<input name="question_count" type="number" min={1} max={100} defaultValue={preferences.default_quiz_size} required /></label><button className="button" type="submit" disabled={busy || !online}>{busy ? "Downloading quiz…" : online ? "Download and begin" : "Connect to start"}</button></form></article></main>;
}

function HistoryPanel({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  const [reviewId, setReviewId] = useState<string | null>(null); const [filter, setFilter] = useState<"all" | "correct" | "wrong">("all");
  if (reviewId) { const attempt = snapshot.attempts.find((candidate) => candidate.id === reviewId); const all = snapshot.history_items.filter((item) => item.attempt_id === reviewId); const items = all.filter((item) => filter === "all" || (filter === "correct" ? item.is_correct : !item.is_correct)); return <main className="workspace-panel"><button className="button button-secondary" type="button" onClick={() => setReviewId(null)}>Back to history</button><header><p className="eyebrow">Quiz review</p><h1>{attempt?.title ?? "Quiz"}</h1></header><div className="review-filters">{(["all", "correct", "wrong"] as const).map((value) => <button type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{value}</button>)}</div><div className="review-list">{items.map((item) => <article className={`review-card ${item.is_correct ? "correct" : "wrong"}`} key={item.id}><div className="review-card-head"><span>Question {item.position}</span><strong>{item.is_correct ? "Correct" : "Wrong"}</strong></div><h2>{item.question_snapshot.question_text}</h2><div className="review-choices">{item.choices_snapshot.map((choice) => <div className={`review-choice ${item.correct_choice_ids.includes(choice.id) ? "correct" : item.selected_choice_ids?.includes(choice.id) ? "wrong" : ""}`} key={choice.id}><span>{choice.label}</span><p>{choice.choice_text}</p></div>)}</div><div className="review-explanation"><strong>Explanation</strong><p>{item.explanation_snapshot}</p></div></article>)}</div></main>; }
  return <main className="workspace-panel"><header><p className="eyebrow">Stored on this device</p><h1>Quiz history</h1></header><section className="history-list">{snapshot.attempts.map((attempt) => <article className="history-row" key={attempt.id}><div className="history-title"><div><h2>{attempt.title ?? "Quiz"}</h2><p>{new Date(attempt.started_at).toLocaleDateString()}</p></div></div><div className="history-detail"><span>Score</span><strong>{Math.round(Number(attempt.score_percent))}%</strong></div><div className="history-detail"><span>Correct</span><strong>{attempt.correct_count}/{attempt.total_questions}</strong></div>{attempt.status === "submitted" ? <button className="button button-secondary" type="button" onClick={() => setReviewId(attempt.id)}>Review</button> : <span className="status-badge status-draft">In progress</span>}</article>)}</section></main>;
}

function SettingsPanel({ name, preferences, onSaved }: { name: string; preferences: LocalPreferences; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState(preferences); const [displayName, setDisplayName] = useState(name); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { const root = document.documentElement; root.dataset.theme = draft.theme; root.dataset.accent = draft.accent_color; root.dataset.reducedMotion = draft.reduced_motion ? "true" : "false"; root.style.setProperty("--user-font-scale", String(draft.font_scale)); return () => { root.dataset.theme = preferences.theme; root.dataset.accent = preferences.accent_color; root.dataset.reducedMotion = preferences.reduced_motion ? "true" : "false"; root.style.setProperty("--user-font-scale", String(preferences.font_scale)); }; }, [draft, preferences.accent_color, preferences.font_scale, preferences.reduced_motion, preferences.theme]);
  async function save(event: FormEvent) { event.preventDefault(); setBusy(true); const result = await saveWorkspaceSettings({ displayName, theme: draft.theme, accentColor: draft.accent_color, fontScale: draft.font_scale, reducedMotion: draft.reduced_motion, defaultQuizSize: draft.default_quiz_size }); setMessage(result.error ?? "Settings saved."); if (!result.error) await onSaved(); setBusy(false); }
  return <main className="workspace-panel"><header><p className="eyebrow">Live preview</p><h1>Settings</h1><p className="page-description">Changes preview immediately on this device. Nothing is sent until you select Save.</p></header><form className="settings-form" onSubmit={save}><section className="form-card settings-section"><label className="field">Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><h2>Theme</h2><div className="settings-options theme-options">{themes.map((theme) => <label className="setting-choice" key={theme}><input type="radio" name="theme" checked={draft.theme === theme} onChange={() => setDraft({ ...draft, theme })} /><span className={`theme-preview ${theme}`}><i /><i /><i /></span><span>{theme}</span></label>)}</div><h2>Accent</h2><div className="settings-options accent-options">{accents.map((accent) => <label className="setting-choice" key={accent}><input type="radio" name="accent" checked={draft.accent_color === accent} onChange={() => setDraft({ ...draft, accent_color: accent })} /><span className={`accent-swatch ${accent}`} />{accent}</label>)}</div><label className="field">Text size<select value={draft.font_scale} onChange={(event) => setDraft({ ...draft, font_scale: Number(event.target.value) })}><option value="0.9">Small</option><option value="1">Default</option><option value="1.1">Large</option><option value="1.2">Extra large</option></select></label><label className="settings-toggle"><input type="checkbox" checked={draft.reduced_motion} onChange={(event) => setDraft({ ...draft, reduced_motion: event.target.checked })} /><span><strong>Reduce motion</strong><small>Turns off most transitions.</small></span></label><label className="field">Default quiz size<input type="number" min={5} max={100} value={draft.default_quiz_size} onChange={(event) => setDraft({ ...draft, default_quiz_size: Number(event.target.value) })} /></label><button className="button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>{message ? <p className="notice">{message}</p> : null}</section></form></main>;
}

function UsersPanel({ snapshot, role, onRefresh }: { snapshot: WorkspaceSnapshot; role: UserRole; onRefresh: () => Promise<void> }) {
  const [busyId, setBusyId] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null);
  async function change(userId: string, action: "role" | "approval", value: string | boolean) { setBusyId(userId); const supabase = createClient(); const result = action === "role" ? await supabase.rpc("set_user_role", { p_user_id: userId, p_role: value }) : await supabase.rpc("set_user_approval", { p_user_id: userId, p_is_approved: value }); setMessage(result.error?.message ?? "User updated."); if (!result.error) await onRefresh(); setBusyId(null); }
  return <main className="workspace-panel"><header><p className="eyebrow">Administrator only</p><h1>Users &amp; roles</h1></header>{message ? <p className="notice">{message}</p> : null}<section className="user-list">{snapshot.users.map((user) => <article className="user-row" key={user.user_id}><div className="user-identity"><span className="user-avatar">{user.display_name.slice(0, 1).toUpperCase()}</span><div><strong>{user.display_name}</strong><p>{user.email}</p></div></div><span className={`role-badge role-${user.role}`}>{user.role}</span><div className="user-actions"><select value={user.role} disabled={busyId === user.user_id || (role === "admin" && ["admin", "superadmin"].includes(user.role))} onChange={(event) => change(user.user_id, "role", event.target.value)}><option value="learner">learner</option><option value="instructor">instructor</option>{role === "superadmin" ? <><option value="admin">admin</option><option value="superadmin">superadmin</option></> : null}</select><button type="button" disabled={busyId === user.user_id} onClick={() => change(user.user_id, "approval", !user.is_approved)}>{user.is_approved ? "Revoke access" : "Approve"}</button></div></article>)}</section></main>;
}
