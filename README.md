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
- Local-first authenticated workspace backed by IndexedDB
- Offline-ready quiz packs with batched result synchronization
- Single-page dashboard, quiz, history, question, user, and settings panels
- Tree-based categories, unified question entry, and bulk question actions
- Live settings preview before preferences are saved
- Deployment-version detection that replaces stale service-worker caches automatically
- Automatic recovery of the exact locally saved quiz question after reopening the site
- Offline score graph, activity heatmap, accuracy ring, streak, and colorful metrics
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

Run `supabase/migrations/0008_local_first_workspace.sql` once to enable the
local-first workspace, offline quiz packs, batched quiz synchronization, topic
strength data, and bulk question actions. Login now opens `/workspace`.

The first workspace visit downloads the account's preferences, history, metrics,
and categories. Staff accounts also download the question bank. Later panel changes
read IndexedDB immediately and synchronization runs separately. Learners download
only the quiz packs they start; the entire answer bank is deliberately not exposed
to learner browser storage.

Offline operation begins only after one successful online workspace visit. Starting
a new quiz still requires a connection so the server can securely build its pack.
Once loaded, the quiz runs locally and uploads all answers after the result screen.
Signing out clears the local workspace and application cache from that browser.

## v9 reliability update

No additional Supabase migration is required after `0008_local_first_workspace.sql`.
This update fixes mobile drawer labels, makes Question Manager part of the initial
offline bundle, adds a full-screen login status, and checks the Vercel deployment
version every minute and whenever the app becomes visible. When a new Git commit is
deployed, active clients clear only the application-shell cache and reload while
preserving IndexedDB history, preferences, question data, and active quiz progress.

Devices already trapped on an older service worker may need one manual browser reload
after this release is deployed. Future Git-pushed deployments are detected automatically.

## v11 quiz lock and category manager update

Run `supabase/migrations/0009_quiz_session_lock.sql` once before deploying this
version. It prevents users from starting another quiz while an active attempt exists,
allows existing unfinished attempts to be recovered, and securely abandons attempts
when the user explicitly chooses Quit quiz.

Question Manager now includes Select all for the current filtered results, a controlled
Move-to-category action with a separate confirmation button, and a tree-based Category
Manager for adding root folders and nested subfolders.

## v12 left category-tree fix

Run `supabase/migrations/0010_category_manager.sql` once before deploying this
version. Category Manager now sits directly beneath the expandable Categories tree
on the left. Folder creation uses a dedicated staff-only RPC and displays success or
error feedback beside the form. Selecting All questions creates a root folder;
selecting an existing folder creates a nested subfolder inside it.
Select any folder to rename it, move its complete branch to the root or another
folder, or safely delete the branch. Deletion archives contained questions so
past quiz results and database references remain intact.

The immediate quiz result screen now includes the complete question review with the
same All, Correct, and Wrong filters used in Quiz History, plus a Back to dashboard
action after reviewing the completed attempt.

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
