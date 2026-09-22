-- Local-first workspace: one bootstrap payload, offline quiz packs, and bulk management.

create or replace function public.get_workspace_bootstrap(
  p_include_bank boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role public.user_role;
  result jsonb;
begin
  select profile.role into caller_role
  from public.profiles profile
  where profile.id = caller_id and profile.is_approved and not profile.is_blocked;

  if caller_role is null then raise exception 'Approved account required.'; end if;

  with recursive category_paths as (
    select category.id, category.parent_id, category.name, category.kind,
           category.name::text as path
    from public.categories category
    where category.parent_id is null and not category.is_archived
    union all
    select child.id, child.parent_id, child.name, child.kind,
           (parent.path || ' / ' || child.name)::text
    from public.categories child
    join category_paths parent on parent.id = child.parent_id
    where not child.is_archived
  ), topic_strength as (
    select path.id, path.path,
           sum(stats.times_seen)::integer as attempts,
           sum(stats.times_correct)::integer as correct,
           round(sum(stats.times_correct)::numeric * 100 / greatest(sum(stats.times_seen), 1), 1) as accuracy
    from public.user_question_stats stats
    join public.questions question on question.id = stats.question_id
    join category_paths path on path.id = question.category_id
    where stats.user_id = caller_id
    group by path.id, path.path
  )
  select jsonb_build_object(
    'synced_at', now(),
    'profile', (select to_jsonb(profile) - 'is_blocked'
      from public.profiles profile where profile.id = caller_id),
    'preferences', (select to_jsonb(preference)
      from public.user_preferences preference where preference.user_id = caller_id),
    'categories', coalesce((select jsonb_agg(to_jsonb(path) order by path.path)
      from category_paths path), '[]'::jsonb),
    'quiz_categories', coalesce((select jsonb_agg(to_jsonb(quiz_category) order by quiz_category.category_path)
      from public.get_quiz_categories() quiz_category), '[]'::jsonb),
    'attempts', coalesce((select jsonb_agg(to_jsonb(attempt) order by attempt.started_at desc)
      from public.quiz_attempts attempt where attempt.user_id = caller_id), '[]'::jsonb),
    'history_items', coalesce((select jsonb_agg(to_jsonb(item) order by item.attempt_id, item.position)
      from public.quiz_attempt_items item
      join public.quiz_attempts attempt on attempt.id = item.attempt_id
      where attempt.user_id = caller_id and attempt.status = 'submitted'), '[]'::jsonb),
    'topic_strengths', coalesce((select jsonb_agg(to_jsonb(strength) order by strength.accuracy, strength.path)
      from topic_strength strength), '[]'::jsonb),
    'questions', case when p_include_bank and caller_role in ('instructor', 'admin', 'superadmin') then
      coalesce((select jsonb_agg(
        (to_jsonb(question) || jsonb_build_object(
          'choices', coalesce((select jsonb_agg(to_jsonb(choice) order by choice.sort_order)
            from public.question_choices choice where choice.question_id = question.id), '[]'::jsonb)
        )) order by question.updated_at desc
      ) from public.questions question where question.status <> 'archived'), '[]'::jsonb)
      else '[]'::jsonb end,
    'users', case when caller_role in ('admin', 'superadmin') then
      coalesce((select jsonb_agg(to_jsonb(directory_user) order by directory_user.created_at desc)
        from public.list_user_profiles() directory_user), '[]'::jsonb)
      else '[]'::jsonb end
  ) into result;

  return result;
end;
$$;

create or replace function public.create_offline_quiz_pack(
  p_category_id uuid,
  p_question_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_id uuid;
  result jsonb;
begin
  attempt_id := public.create_quiz_attempt(p_category_id, p_question_count);

  select jsonb_build_object(
    'attempt', to_jsonb(attempt),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', item.id,
      'attempt_id', item.attempt_id,
      'question_id', item.question_id,
      'position', item.position,
      'question_text', item.question_snapshot ->> 'question_text',
      'choices', item.choices_snapshot,
      'correct_choice_ids', to_jsonb(item.correct_choice_ids),
      'explanation', item.explanation_snapshot
    ) order by item.position)
    from public.quiz_attempt_items item where item.attempt_id = attempt.id), '[]'::jsonb)
  ) into result
  from public.quiz_attempts attempt
  where attempt.id = attempt_id and attempt.user_id = (select auth.uid());

  return result;
end;
$$;

create or replace function public.sync_offline_quiz_attempt(
  p_attempt_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  answer jsonb;
  item_record record;
begin
  if jsonb_typeof(p_answers) <> 'array' then raise exception 'Answers must be an array.'; end if;

  for answer in select value from jsonb_array_elements(p_answers) loop
    select item.id, item.answered_at into item_record
    from public.quiz_attempt_items item
    join public.quiz_attempts attempt on attempt.id = item.attempt_id
    where item.id = (answer ->> 'item_id')::uuid
      and item.attempt_id = p_attempt_id
      and attempt.user_id = (select auth.uid());

    if not found then raise exception 'Quiz item not found.'; end if;
    if item_record.answered_at is null then
      perform public.submit_quiz_answer(
        p_attempt_id,
        item_record.id,
        (answer ->> 'selected_choice_id')::uuid,
        greatest(coalesce((answer ->> 'response_time_ms')::integer, 0), 0)
      );
    end if;
  end loop;

  return public.get_workspace_bootstrap(false);
end;
$$;

create or replace function public.bulk_manage_questions(
  p_question_ids uuid[],
  p_action text,
  p_category_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if public.current_user_role() not in ('instructor', 'admin', 'superadmin') or not exists (
    select 1 from public.profiles where id = (select auth.uid()) and is_approved and not is_blocked
  ) then
    raise exception 'Staff access required.';
  end if;
  if coalesce(array_length(p_question_ids, 1), 0) = 0 then return 0; end if;

  if p_action = 'show' then
    update public.questions set status = 'published' where id = any(p_question_ids);
  elsif p_action = 'hide' then
    update public.questions set status = 'draft' where id = any(p_question_ids);
  elsif p_action = 'move' then
    if p_category_id is null then raise exception 'Choose a destination category.'; end if;
    update public.questions set category_id = p_category_id where id = any(p_question_ids);
  elsif p_action = 'delete' then
    update public.questions set status = 'archived' where id = any(p_question_ids);
  else
    raise exception 'Invalid bulk action.';
  end if;

  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.get_workspace_bootstrap(boolean) from public;
revoke all on function public.create_offline_quiz_pack(uuid, integer) from public;
revoke all on function public.sync_offline_quiz_attempt(uuid, jsonb) from public;
revoke all on function public.bulk_manage_questions(uuid[], text, uuid) from public;

grant execute on function public.get_workspace_bootstrap(boolean) to authenticated;
grant execute on function public.create_offline_quiz_pack(uuid, integer) to authenticated;
grant execute on function public.sync_offline_quiz_attempt(uuid, jsonb) to authenticated;
grant execute on function public.bulk_manage_questions(uuid[], text, uuid) to authenticated;
