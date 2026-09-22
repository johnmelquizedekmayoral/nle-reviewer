# NLE Reviewer v13 category sync fix

This update fixes categories that exist in Supabase but remain missing from the
local Question Manager.

## Required order

1. Extract this ZIP into the root of the `nle-reviewer` project and overwrite
   the matching files.
2. Open Supabase **SQL Editor** and run
   `supabase/migrations/0011_category_tree_sync.sql`.
3. Run `npm run lint` and `npm run build`.
4. Commit and push to GitHub so Vercel deploys the update.
5. After Vercel finishes, sign out and sign back in once.
6. Open Question Manager and click **Sync now**.

The notification should report the number of synchronized folders. With the
current `NLE 2027` root, it should say `1 folder(s) synced.`

If synchronization fails, the top-right notification now displays the exact
RPC error and names the missing migration instead of silently showing zero.
