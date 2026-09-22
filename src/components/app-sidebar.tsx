import Link from "next/link";
import { signOut } from "@/app/login/actions";

type AppSidebarProps = {
  active: "dashboard" | "questions";
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
        <span className="nav-link" data-short="Quiz">
          <span>Take a quiz</span>
        </span>
        <span className="nav-link" data-short="Past">
          <span>Quiz history</span>
        </span>

        <p className="nav-label">Manage</p>
        <Link
          className={`nav-link ${active === "questions" ? "active" : ""}`}
          data-short="Bank"
          href="/admin/questions"
        >
          <span>Question Manager</span>
        </Link>
        <span className="nav-link" data-short="Prefs">
          <span>Settings</span>
        </span>
      </nav>

      <form className="sidebar-footer" action={signOut}>
        <button className="sidebar-signout" type="submit">
          Sign out
        </button>
      </form>
    </aside>
  );
}
