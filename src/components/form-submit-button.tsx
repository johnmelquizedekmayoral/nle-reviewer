"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  disabled?: boolean;
  overlay?: boolean;
};

export function FormSubmitButton({
  children,
  pendingLabel,
  className = "button",
  disabled = false,
  overlay = false,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <>
      <button className={className} type="submit" disabled={disabled || pending}>
        {pending ? pendingLabel : children}
      </button>
      {pending ? <div className="action-toast" role="status"><span />{pendingLabel}</div> : null}
      {pending && overlay ? <div className="login-loading-overlay" role="status" aria-live="polite"><div><span />{pendingLabel}<small>Checking your account and loading your local workspace…</small></div></div> : null}
    </>
  );
}
