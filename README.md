# NLE Reviewer v10 — final Question Manager and role display fix

This patch is for the v9 local-first workspace.

## Install

1. Extract this archive into the root of your `nle-reviewer` project.
2. Allow the six files under `src/` to overwrite their existing copies.
3. Run `npm run lint` and `npm run build`.
4. Commit and push the changes to GitHub. Vercel will deploy the new commit.
5. Open the deployed site and reload once if it was already open.

No Supabase migration or environment-variable change is required.

## Fixes

- Normalizes older locally cached question/category records before Question Manager renders.
- Prevents malformed category ancestry from recursively crashing the category tree.
- Uses the freshest valid role from the authenticated page or synchronized workspace data.
- Shows the current administrator's effective role in Users & roles and prevents accidental self-role/self-approval changes.
- Adds an exact technical error detail to the recovery screen if another panel edge case occurs.

## Verified

- ESLint: passed
- Next.js production build: passed
- TypeScript: passed
- Production runtime endpoints: passed
