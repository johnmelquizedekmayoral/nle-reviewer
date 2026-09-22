export type UserRole = "learner" | "instructor" | "admin" | "superadmin";

export type LocalChoice = {
  id: string;
  label: string;
  choice_text: string;
  is_correct?: boolean;
  sort_order?: number;
};

export type LocalCategory = {
  id: string;
  parent_id: string | null;
  name: string;
  kind: "subject" | "topic" | "subtopic" | "folder";
  path: string;
};

export type LocalQuestion = {
  id: string;
  category_id: string;
  question_text: string;
  explanation: string;
  source: string | null;
  status: "draft" | "published" | "archived";
  updated_at: string;
  choices: LocalChoice[];
};

export type LocalAttempt = {
  id: string;
  title: string | null;
  status: "active" | "submitted" | "abandoned";
  total_questions: number;
  answered_count: number;
  correct_count: number;
  score_percent: number;
  started_at: string;
  submitted_at: string | null;
  duration_ms: number | null;
};

export type LocalHistoryItem = {
  id: string;
  attempt_id: string;
  question_id: string | null;
  position: number;
  question_snapshot: { question_text?: string; category_id?: string };
  choices_snapshot: LocalChoice[];
  correct_choice_ids: string[];
  selected_choice_ids: string[] | null;
  explanation_snapshot: string;
  is_correct: boolean | null;
  response_time_ms: number | null;
};

export type TopicStrength = {
  id: string;
  path: string;
  attempts: number;
  correct: number;
  accuracy: number;
};

export type QuizCategory = {
  category_id: string;
  category_path: string;
  question_count: number;
};

export type DirectoryUser = {
  user_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  is_approved: boolean;
  is_blocked: boolean;
  created_at: string;
};

export type LocalPreferences = {
  user_id: string;
  theme: string;
  accent_color: string;
  font_scale: number;
  reduced_motion: boolean;
  default_quiz_size: number;
};

export type WorkspaceSnapshot = {
  synced_at: string;
  profile: { id: string; display_name: string; role: UserRole; is_approved: boolean };
  preferences: LocalPreferences;
  categories: LocalCategory[];
  quiz_categories: QuizCategory[];
  attempts: LocalAttempt[];
  history_items: LocalHistoryItem[];
  topic_strengths: TopicStrength[];
  questions: LocalQuestion[];
  users: DirectoryUser[];
};

export type OfflineQuizItem = {
  id: string;
  attempt_id: string;
  question_id: string | null;
  position: number;
  question_text: string;
  choices: LocalChoice[];
  correct_choice_ids: string[];
  explanation: string;
};

export type OfflineAnswer = {
  item_id: string;
  selected_choice_id: string;
  response_time_ms: number;
};

export type OfflineQuizPack = {
  attempt: LocalAttempt;
  items: OfflineQuizItem[];
  answers?: OfflineAnswer[];
  current_position?: number;
  needs_sync?: boolean;
};
