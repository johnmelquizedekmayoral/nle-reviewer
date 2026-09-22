"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/require-staff";

const basicRoles = new Set(["learner", "instructor"]);
const allRoles = new Set(["learner", "instructor", "admin", "superadmin"]);

export async function updateUserRole(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const nextRole = String(formData.get("role") ?? "");
  const { supabase, userId: callerId, role: callerRole } = await requireStaff();

  if (!userId || userId === callerId) {
    redirect("/admin/users?error=You%20cannot%20change%20your%20own%20role.");
  }

  const allowedRoles = callerRole === "superadmin" ? allRoles : basicRoles;
  if (!allowedRoles.has(nextRole)) {
    redirect("/admin/users?error=You%20cannot%20assign%20that%20role.");
  }

  const { error } = await supabase.rpc("set_user_role", {
    p_user_id: userId,
    p_role: nextRole,
  });

  if (error) redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/users");
  redirect("/admin/users?saved=1");
}

export async function updateUserApproval(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const isApproved = String(formData.get("is_approved")) === "true";
  const { supabase, userId: callerId, role } = await requireStaff();

  if (role !== "admin" && role !== "superadmin") redirect("/dashboard");
  if (!userId || userId === callerId) {
    redirect("/admin/users?error=You%20cannot%20change%20your%20own%20approval.");
  }

  const { error } = await supabase.rpc("set_user_approval", {
    p_user_id: userId,
    p_is_approved: isApproved,
  });

  if (error) redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/users");
  redirect(`/admin/users?saved=${isApproved ? "approved" : "revoked"}`);
}
