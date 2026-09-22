# NLE Reviewer v12 update

This focused update adds the complete left-side Category Manager and the full
post-quiz answer review.

## Install

1. Extract this ZIP into the root of your `nle-reviewer` project and allow it
   to overwrite the matching files.
2. In the Supabase SQL Editor, run
   `supabase/migrations/0010_category_manager.sql` once. Do this before testing
   or deploying—the folder buttons require the new database functions.
3. From the project folder, run:

   ```bash
   npm run lint
   npm run build
   ```

4. Commit and push the files to GitHub. Vercel will deploy the pushed commit.
5. Reload the deployed app once after Vercel finishes.

## Category Manager

- The folder tree and all controls are together in the left Categories panel.
- Use **New root** to add another top-level folder.
- Select a folder, then use **New subfolder** to create inside it.
- A selected folder can be renamed or moved to the root/another folder.
- **Move folder tree** moves the folder and every descendant together.
- **Delete folder tree** archives the branch and all contained questions. It
  does not damage previous quiz history or saved answer snapshots.
- Circular moves are blocked, and a folder's descendants are excluded from its
  destination list.

## Quiz results

After submitting a quiz, the result screen shows the score summary and every
question. Use **All**, **Correct**, and **Wrong** to filter the review, then use
**Back to dashboard** when finished.
