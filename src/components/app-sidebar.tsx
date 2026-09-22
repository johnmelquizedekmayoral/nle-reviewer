import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { FormSubmitButton } from "@/components/form-submit-button";

type AppSidebarProps = {
  active: "dashboard" | "quiz" | "history" | "questions" | "users" | "settings";
  role?: "learner" | "instructor" | "admin" | "superadmin";
};

export function AppSidebar({ active, role = "learner" }: AppSidebarProps) {
  const canManageQuestions = role !== "learner";
  const canManageUsers = role === "admin" || role === "superadmin";

  return (
    <aside className="sidebar">
      <Link className="brand" href="/dashboard">
        <span className="brand-mark">N</span>
        <span className="brand-name">NLE Reviewer</span>
      </Link>

      <nav aria-label="Main navigation">
        <p className="nav-label">Workspace</p>
        <Link
          className={`nav-link ${active === "dashboard" ? "active" : ""}`}
          data-short="Home"
          href="/dashboard"
        >
          <span>Dashboard</span>
        </Link>
        <Link
          className={`nav-link ${active === "quiz" ? "active" : ""}`}
          data-short="Quiz"
          href="/quiz/new"
        >
          <span>Take a quiz</span>
        </Link>
        <Link
          className={`nav-link ${active === "history" ? "active" : ""}`}
          data-short="Past"
          href="/history"
        >
          <span>Quiz history</span>
        </Link>

        {canManageQuestions || canManageUsers ? <p className="nav-label">Manage</p> : null}
        {canManageQuestions ? (
          <Link
            className={`nav-link ${active === "questions" ? "active" : ""}`}
            data-short="Bank"
            href="/admin/questions"
          >
            <span>Question Manager</span>
          </Link>
        ) : null}
        {canManageUsers ? (
          <Link
            className={`nav-link ${active === "users" ? "active" : ""}`}
            data-short="Users"
            href="/admin/users"
          >
            <span>Users &amp; roles</span>
          </Link>
        ) : null}
        <Link
          className={`nav-link ${active === "settings" ? "active" : ""}`}
          data-short="Prefs"
          href="/settings"
        >
          <span>Settings</span>
        </Link>
      </nav>

      <form className="sidebar-footer" action={signOut}>
        <FormSubmitButton className="sidebar-signout" pendingLabel="Signing out…">Sign out</FormSubmitButton>
      </form>
    </aside>
  );
}
