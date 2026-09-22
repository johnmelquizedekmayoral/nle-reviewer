import Link from "next/link";
import { signOut } from "@/app/login/actions";

type AppSidebarProps = {
  active: "dashboard" | "quiz" | "history" | "questions" | "users" | "settings";
};

export function AppSidebar({ active }: AppSidebarProps) {
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

        <p className="nav-label">Manage</p>
        <Link
          className={`nav-link ${active === "questions" ? "active" : ""}`}
          data-short="Bank"
          href="/admin/questions"
        >
          <span>Question Manager</span>
        </Link>
        <Link
          className={`nav-link ${active === "users" ? "active" : ""}`}
          data-short="Users"
          href="/admin/users"
        >
          <span>Users &amp; roles</span>
        </Link>
        <Link
          className={`nav-link ${active === "settings" ? "active" : ""}`}
          data-short="Prefs"
          href="/settings"
        >
          <span>Settings</span>
        </Link>
      </nav>

      <form className="sidebar-footer" action={signOut}>
        <button className="sidebar-signout" type="submit">
          Sign out
        </button>
      </form>
    </aside>
  );
}
