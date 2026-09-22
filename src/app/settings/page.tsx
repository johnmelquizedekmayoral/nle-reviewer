import type { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";
import { FormSubmitButton } from "@/components/form-submit-button";
import { requireUser } from "@/lib/auth/require-user";
import { saveSettings } from "./actions";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const query = await searchParams;
  const { supabase, userId, role } = await requireUser();
  const [{ data: profile }, { data: preferences }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).single(),
    supabase
      .from("user_preferences")
      .select("theme, accent_color, font_scale, reduced_motion, default_quiz_size")
      .eq("user_id", userId)
      .single(),
  ]);

  const theme = preferences?.theme ?? "system";
  const accent = preferences?.accent_color ?? "green";
  const fontScale = Number(preferences?.font_scale ?? 1);

  return (
    <div className="shell">
      <AppSidebar active="settings" role={role} />

      <main className="main settings-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Personal preferences</p>
            <h1>Settings</h1>
            <p className="page-description">
              Change your profile and the appearance of the entire reviewer.
            </p>
          </div>
        </header>

        {query.saved ? <p className="notice notice-success">Settings saved.</p> : null}
        {query.error ? <p className="notice notice-error">{query.error}</p> : null}

        <form className="settings-form" action={saveSettings}>
          <section className="form-card settings-section">
            <div>
              <p className="step-number">PROFILE</p>
              <h2>Your account</h2>
            </div>
            <label className="field">
              Display name
              <input
                name="display_name"
                type="text"
                minLength={1}
                maxLength={80}
                defaultValue={profile?.display_name ?? "Learner"}
                required
              />
            </label>
          </section>

          <section className="form-card settings-section">
            <div>
              <p className="step-number">APPEARANCE</p>
              <h2>Theme</h2>
              <p className="form-help">System follows your computer’s light or dark setting.</p>
            </div>
            <fieldset className="settings-options theme-options">
              <legend className="sr-only">Theme</legend>
              {[
                ["system", "System", "Matches your device"],
                ["light", "Clean Light", "Simple and neutral"],
                ["dark", "Clean Dark", "Low-glare minimal"],
                ["midnight", "Midnight", "Modern deep navy"],
                ["ocean", "Ocean", "Fresh coastal blue"],
                ["forest", "Forest", "Calm natural green"],
                ["warm", "Warm Paper", "Soft and comfortable"],
                ["retro", "Retro Desk", "Cream and hard shadows"],
                ["terminal", "Terminal", "Classic computer style"],
                ["synthwave", "Synthwave", "Neon purple atmosphere"],
              ].map(([value, label, description]) => (
                <label className="setting-choice" key={value}>
                  <input type="radio" name="theme" value={value} defaultChecked={theme === value} />
                  <span className={`theme-preview ${value}`} aria-hidden="true"><i /><i /><i /></span>
                  <span className="theme-copy"><strong>{label}</strong><small>{description}</small></span>
                </label>
              ))}
            </fieldset>

            <div>
              <h2>Accent color</h2>
              <p className="form-help">Used for progress, focus, and active navigation.</p>
            </div>
            <fieldset className="settings-options accent-options">
              <legend className="sr-only">Accent color</legend>
              {[
                ["green", "Green"],
                ["blue", "Blue"],
                ["purple", "Purple"],
                ["teal", "Teal"],
                ["orange", "Orange"],
                ["pink", "Pink"],
                ["red", "Red"],
              ].map(([value, label]) => (
                <label className="setting-choice" key={value}>
                  <input
                    type="radio"
                    name="accent_color"
                    value={value}
                    defaultChecked={accent === value}
                  />
                  <span className={`accent-swatch ${value}`} />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>

            <label className="field">
              Text size
              <select name="font_scale" defaultValue={String(fontScale)}>
                <option value="0.9">Small</option>
                <option value="1">Default</option>
                <option value="1.1">Large</option>
                <option value="1.2">Extra large</option>
              </select>
            </label>

            <label className="settings-toggle">
              <input
                type="checkbox"
                name="reduced_motion"
                defaultChecked={preferences?.reduced_motion ?? false}
              />
              <span>
                <strong>Reduce motion</strong>
                <small>Turns off hover movement and most transitions.</small>
              </span>
            </label>
          </section>

          <section className="form-card settings-section">
            <div>
              <p className="step-number">QUIZZES</p>
              <h2>Quiz defaults</h2>
              <p className="form-help">Used as the suggested size whenever you start a new quiz.</p>
            </div>
            <label className="field">
              Default number of questions
              <input
                name="default_quiz_size"
                type="number"
                min={5}
                max={100}
                defaultValue={preferences?.default_quiz_size ?? 20}
                required
              />
            </label>
          </section>

          <div className="settings-save">
            <FormSubmitButton pendingLabel="Saving settings…">Save settings</FormSubmitButton>
          </div>
        </form>
      </main>
    </div>
  );
}
