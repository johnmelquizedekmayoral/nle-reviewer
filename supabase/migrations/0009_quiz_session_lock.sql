-- Enforce one active quiz, recover existing attempts, and explicitly abandon quits.

create or replace function public.enforce_single_active_quiz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    if tg_op = 'UPDATE' then
      if old.status = 'active' and old.user_id = new.user_id then return new; end if;
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
    if exists (
      select 1 from public.quiz_attempts attempt
      where attempt.user_id = new.user_id
        and attempt.status = 'active'
        and attempt.id <> new.id
    ) then
      raise exception 'Resume or quit your unfinished quiz before starting another.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists quiz_attempts_single_active on public.quiz_attempts;
create trigger quiz_attempts_single_active
  before insert or update of status, user_id on public.quiz_attempts
  for each row execute function public.enforce_single_active_quiz();

create or replace function public.get_offline_quiz_pack(
  p_attempt_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
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
    from public.quiz_attempt_items item where item.attempt_id = attempt.id), '[]'::jsonb),
    'answers', coalesce((select jsonb_agg(jsonb_build_object(
      'item_id', item.id,
      'selected_choice_id', item.selected_choice_ids[1],
      'response_time_ms', coalesce(item.response_time_ms, 0)
    ) order by item.position)
    from public.quiz_attempt_items item
    where item.attempt_id = attempt.id and item.answered_at is not null), '[]'::jsonb),
    'current_position', greatest(coalesce((select min(item.position) - 1
      from public.quiz_attempt_items item
      where item.attempt_id = attempt.id and item.answered_at is null), attempt.total_questions - 1), 0),
    'needs_sync', false
  ) into result
  from public.quiz_attempts attempt
  where attempt.id = p_attempt_id
    and attempt.user_id = (select auth.uid())
    and attempt.status = 'active';

  if result is null then
    raise exception 'Active quiz not found.';
  end if;

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
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null then raise exception 'Authentication required.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text, 0));

  if exists (
    select 1 from public.quiz_attempts attempt
    where attempt.user_id = caller_id and attempt.status = 'active'
  ) then
    raise exception 'Resume or quit your unfinished quiz before starting another.';
  end if;

  attempt_id := public.create_quiz_attempt(p_category_id, p_question_count);
  return public.get_offline_quiz_pack(attempt_id);
end;
$$;

create or replace function public.abandon_offline_quiz_attempt(
  p_attempt_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  update public.quiz_attempts
  set status = 'abandoned'
  where id = p_attempt_id
    and user_id = (select auth.uid())
    and status = 'active';

  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

revoke all on function public.get_offline_quiz_pack(uuid) from public;
revoke all on function public.create_offline_quiz_pack(uuid, integer) from public;
revoke all on function public.abandon_offline_quiz_attempt(uuid) from public;

grant execute on function public.get_offline_quiz_pack(uuid) to authenticated;
grant execute on function public.create_offline_quiz_pack(uuid, integer) to authenticated;
grant execute on function public.abandon_offline_quiz_attempt(uuid) to authenticated;
