# NLE Reviewer v11 — quiz lock, bulk move, and category manager

## Required installation order

1. Extract this folder into the root of the current `nle-reviewer` project and overwrite the matching files.
2. In Supabase SQL Editor, run `supabase/migrations/0009_quiz_session_lock.sql` once.
3. Run `npm run lint` and `npm run build` locally.
4. Commit and push the files to GitHub. Vercel will deploy the commit.
5. Reload the deployed website once.

Do not deploy the frontend before running migration `0009`; quiz recovery and explicit quitting depend on its RPC functions.

## Existing unfinished quizzes

Open Take a quiz. Every active attempt will have a Resume quiz button. Finish it or use Quit quiz to permanently discard its unfinished progress. Once the older attempts are cleared, the database prevents more than one active quiz from being created.

## Included fixes

- Exact-question local recovery after accidental reloads or leaving the site.
- No Save & exit; only a confirmed Quit quiz that discards progress.
- Active quiz UI hides workspace navigation and warns before browser navigation.
- Filter-aware Select all in Question Manager.
- Controlled Move to destination with a separate Move button.
- Tree-based Category Manager for root folders and nested subfolders.

## Verification

- ESLint passed.
- TypeScript passed.
- Next.js production build passed.
- Production runtime endpoint smoke test passed.
