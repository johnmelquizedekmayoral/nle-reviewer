# NLE Review LMS

This is the working foundation for the quiz website. It currently includes:

- Next.js 16, TypeScript, and Tailwind CSS
- Supabase browser/server clients and session refresh proxy
- Email/password sign-in action
- Responsive learner dashboard
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

The next implementation checkpoint is Question Manager: category folders, question creation, and JSONL import.

## Main project paths

```text
src/app/dashboard/page.tsx          Dashboard
src/app/login/page.tsx              Login screen
src/app/login/actions.ts            Login/logout server actions
src/lib/supabase/                   Supabase clients and session handling
supabase/migrations/                Versioned database changes
proxy.ts                            Session refresh proxy
```
