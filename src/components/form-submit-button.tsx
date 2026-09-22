"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  disabled?: boolean;
};

export function FormSubmitButton({
  children,
  pendingLabel,
  className = "button",
  disabled = false,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <>
      <button className={className} type="submit" disabled={disabled || pending}>
        {pending ? pendingLabel : children}
      </button>
      {pending ? <div className="action-toast" role="status"><span />{pendingLabel}</div> : null}
    </>
  );
}
