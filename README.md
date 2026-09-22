# NLE Reviewer

This is the working foundation for the quiz website. It currently includes:

- Next.js 16, TypeScript, and Tailwind CSS
- Supabase browser/server clients and session refresh proxy
- Email/password sign-in action
- Responsive learner dashboard
- Instant-feedback quizzes with shuffled questions and choices
- Saved scores and recent quiz results on the dashboard
- Full quiz history with review and resume links
- Account-based theme, accent color, text size, and reduced-motion settings
- Public email/password registration through Supabase Auth
- Admin-controlled learner and instructor role assignment
- Administrator approval required before new accounts can enter the app
- Scrollable quiz review with All, Correct, and Wrong filters
- Responsive mobile bottom navigation and global loading notifications
- Advanced performance, mastery, response-time, and weakness metrics
- Ten appearance themes spanning clean, modern, natural, retro, terminal, and synthwave styles
- One-request quiz answers with the next question preloaded (no full page reload)
- Versioned PostgreSQL schema with Row Level Security
- Tables for users, folders, questions, choices, quiz attempts, history, and per-question statistics

## Current checkpoint

The application builds and runs without Supabase so the interface can be inspected. Login and saved progress activate after completing the setup below.

## 1. Create the Supabase project

1. Sign in at `https://supabase.com/dashboard`.
2. Select **New project**.
3. Choose a project name, database password, and nearby region.
4. Wait for the project to finish provisioning.

## 2. Create the database

1. Open **SQL Editor** in the Supabase dashboard.
2. Open `supabase/migrations/0001_initial_schema.sql` from this project.
3. Copy the complete file into a new SQL query.
4. Select **Run** once.

Do not run only portions of the migration. The tables, functions, permissions, and security policies are designed to be created together.

## 3. Connect the application

1. In Supabase, open **Project Settings → API** or the project **Connect** panel.
2. Copy the project URL and publishable key.
3. Duplicate `.env.example` and rename the copy to `.env.local`.
4. Replace the placeholder values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Do not put the service-role key in any variable whose name starts with `NEXT_PUBLIC_`.

## 4. Create the first account

For the first checkpoint, create the user through **Supabase → Authentication → Users → Add user**. Registration inside the website will be added after login is verified.

After creating the user, run this in the SQL Editor to make that account an admin. Replace the email address first.

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'YOUR_EMAIL@example.com'
);
```

## 5. Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/login`, sign in, and confirm that `/dashboard` loads.

## 6. Verify before deployment

```bash
npm run build
```

The Question Manager supports category folders, manual and bulk formatted question entry,
four answer choices, correct-answer selection, explanations, editing, hiding, showing, and deletion.

After the initial schema, run `supabase/migrations/0002_question_manager_bulk.sql`
once in Supabase SQL Editor before using the bulk parser or question editor.

Then run `supabase/migrations/0003_quiz_engine.sql` once to enable category-based
quiz creation, secure answer submission, instant explanations, and saved scores.

Run `supabase/migrations/0004_signup_and_roles.sql` once to enable the secure
administrator user directory and role assignment.

Run `supabase/migrations/0005_access_approval.sql` once to add account approval,
repair the user-directory functions, and enforce approved quiz access. Existing
learner accounts enter the approval queue; existing staff accounts remain approved.

Run `supabase/migrations/0006_expanded_themes.sql` once before selecting one of
the additional appearance themes in Settings.

Run `supabase/migrations/0007_fast_quiz.sql` once to enable the faster quiz runner.
It saves the answer, returns feedback, and preloads the next question in one direct
Supabase request instead of reloading the entire Next.js route after every answer.

## Deploy to Vercel

1. Import the `johnmelquizedekmayoral/nle-reviewer` GitHub repository in Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   under **Project Settings → Environment Variables**.
3. Deploy the project.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to the
   production Vercel address and add the same address to Redirect URLs.
5. In **Authentication → Providers → Email**, allow new-user signups and keep
   email confirmation enabled for public registration.

For the lowest server-side latency, check the Supabase project region and choose
the closest available Vercel Function Region under **Project Settings → Functions**.
The browser-based quiz answer path talks directly to Supabase, but matching regions
still improves dashboard, history, settings, and administration requests.

The service-role key is not required for deployment and must never be exposed
as a `NEXT_PUBLIC_` environment variable.

## Main project paths

```text
src/app/dashboard/page.tsx          Dashboard
src/app/login/page.tsx              Login screen
src/app/login/actions.ts            Login/logout server actions
src/app/quiz/                       Quiz setup, questions, and server actions
src/lib/supabase/                   Supabase clients and session handling
supabase/migrations/                Versioned database changes
proxy.ts                            Session refresh proxy
```
