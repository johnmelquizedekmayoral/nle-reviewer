"use client";

type DeleteQuestionFormProps = {
  questionId: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function DeleteQuestionForm({ questionId, action }: DeleteQuestionFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Permanently delete this question? Existing quiz-history snapshots will remain.")) {
          event.preventDefault();
        }
      }}
    >
      <input name="question_id" type="hidden" value={questionId} />
      <button className="row-action row-action-danger" type="submit">
        Delete
      </button>
    </form>
  );
}
