"use client";

import { FormSubmitButton } from "@/components/form-submit-button";

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
      <FormSubmitButton className="row-action row-action-danger" pendingLabel="Deleting question…">
        Delete
      </FormSubmitButton>
    </form>
  );
}
