import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { FormSubmitButton } from "@/components/form-submit-button";
import { requireStaff } from "@/lib/auth/require-staff";
import { updateUserApproval, updateUserRole } from "./actions";

export const metadata: Metadata = { title: "Users & Roles" };
export const dynamic = "force-dynamic";

type UserProfile = {
  user_id: string;
  email: string;
  display_name: string;
  role: "learner" | "instructor" | "admin" | "superadmin";
  is_approved: boolean;
  is_blocked: boolean;
  created_at: string;
};

type UsersPageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const query = await searchParams;
  const { supabase, userId, role } = await requireStaff();
  if (role !== "admin" && role !== "superadmin") redirect("/dashboard");

  const { data, error } = await supabase.rpc("list_user_profiles");
  const users = (data ?? []) as UserProfile[];
  const assignableRoles = role === "superadmin"
    ? ["learner", "instructor", "admin", "superadmin"]
    : ["learner", "instructor"];

  return (
    <div className="shell">
      <AppSidebar active="users" role={role} />

      <main className="main admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Administrator only</p>
            <h1>Users &amp; roles</h1>
            <p className="page-description">
              Give trusted contributors the instructor role so they can manage the question pool.
            </p>
          </div>
          <div className="header-stat"><strong>{users.length}</strong><span>accounts</span></div>
        </header>

        {query.saved ? <p className="notice notice-success">User access updated.</p> : null}
        {query.error ? <p className="notice notice-error">{query.error}</p> : null}
        {error ? <p className="notice notice-error">{error.message}</p> : null}

        <section className="user-list" aria-label="Registered users">
          {users.map((user) => {
            const isSelf = user.user_id === userId;
            const protectedAdmin = role === "admin" && (user.role === "admin" || user.role === "superadmin");
            const canEdit = !isSelf && !protectedAdmin;

            return (
              <article className="user-row" key={user.user_id}>
                <div className="user-identity">
                  <span className="user-avatar">{user.display_name.charAt(0).toUpperCase()}</span>
                  <div>
                    <strong>{user.display_name}{isSelf ? " (you)" : ""}</strong>
                    <p>{user.email}</p>
                  </div>
                </div>

                <div className="user-badges">
                  <span className={`role-badge role-${user.role}`}>{user.role}</span>
                  <span className={`role-badge ${user.is_approved ? "status-published" : "status-draft"}`}>
                    {user.is_approved ? "Approved" : "Pending"}
                  </span>
                </div>

                {canEdit ? (
                  <div className="user-actions">
                    <form className="role-form" action={updateUserRole}>
                      <input type="hidden" name="user_id" value={user.user_id} />
                      <label className="sr-only" htmlFor={`role-${user.user_id}`}>Role for {user.display_name}</label>
                      <select id={`role-${user.user_id}`} name="role" defaultValue={user.role}>
                        {assignableRoles.map((assignableRole) => (
                          <option value={assignableRole} key={assignableRole}>{assignableRole}</option>
                        ))}
                      </select>
                      <FormSubmitButton className="row-action" pendingLabel="Saving role…">Save role</FormSubmitButton>
                    </form>
                    <form action={updateUserApproval}>
                      <input type="hidden" name="user_id" value={user.user_id} />
                      <input type="hidden" name="is_approved" value={user.is_approved ? "false" : "true"} />
                      <FormSubmitButton
                        className={`row-action ${user.is_approved ? "row-action-danger" : ""}`}
                        pendingLabel={user.is_approved ? "Revoking access…" : "Approving access…"}
                      >
                        {user.is_approved ? "Revoke access" : "Approve access"}
                      </FormSubmitButton>
                    </form>
                  </div>
                ) : (
                  <span className="role-locked">Protected</span>
                )}
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
