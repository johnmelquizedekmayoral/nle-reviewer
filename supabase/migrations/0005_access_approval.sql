-- Approval-gated accounts and self-contained administrator controls.

alter table public.profiles
  add column if not exists is_approved boolean not null default false;

-- Preserve staff access; existing learner accounts enter the approval queue.
update public.profiles
set is_approved = role in ('instructor', 'admin', 'superadmin');

drop function if exists public.list_user_profiles();

create function public.list_user_profiles()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.user_role,
  is_approved boolean,
  is_blocked boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() not in ('admin', 'superadmin') then
    raise exception 'Administrator access required.';
  end if;

  return query
  select
    profile.id,
    auth_user.email::text,
    profile.display_name,
    profile.role,
    profile.is_approved,
    profile.is_blocked,
    profile.created_at
  from public.profiles profile
  join auth.users auth_user on auth_user.id = profile.id
  order by profile.created_at desc;
end;
$$;

create or replace function public.set_user_role(
  p_user_id uuid,
  p_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role public.user_role := public.current_user_role();
  target_role public.user_role;
begin
  if caller_id is null or caller_role not in ('admin', 'superadmin') then
    raise exception 'Administrator access required.';
  end if;
  if p_user_id = caller_id then
    raise exception 'You cannot change your own role.';
  end if;

  select profile.role into target_role
  from public.profiles profile
  where profile.id = p_user_id
  for update;

  if not found then raise exception 'User not found.'; end if;

  if caller_role = 'admin' and (
    target_role in ('admin', 'superadmin') or p_role in ('admin', 'superadmin')
  ) then
    raise exception 'Only a superadmin can manage administrator roles.';
  end if;

  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

create or replace function public.set_user_approval(
  p_user_id uuid,
  p_is_approved boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null or public.current_user_role() not in ('admin', 'superadmin') then
    raise exception 'Administrator access required.';
  end if;
  if p_user_id = caller_id then
    raise exception 'You cannot change your own approval.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found.';
  end if;

  update public.profiles set is_approved = p_is_approved where id = p_user_id;
end;
$$;

create or replace function public.enforce_approved_quiz_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  if tg_table_name = 'quiz_attempts' then
    owner_id := new.user_id;
  else
    select attempt.user_id into owner_id
    from public.quiz_attempts attempt
    where attempt.id = new.attempt_id;
  end if;

  if owner_id = (select auth.uid()) and not exists (
    select 1 from public.profiles
    where id = owner_id and is_approved and not is_blocked
  ) then
    raise exception 'Your account is awaiting approval.';
  end if;
  return new;
end;
$$;

drop trigger if exists quiz_attempts_require_approval on public.quiz_attempts;
create trigger quiz_attempts_require_approval
  before insert or update on public.quiz_attempts
  for each row execute function public.enforce_approved_quiz_access();

drop trigger if exists quiz_items_require_approval on public.quiz_attempt_items;
create trigger quiz_items_require_approval
  before update on public.quiz_attempt_items
  for each row execute function public.enforce_approved_quiz_access();

create or replace function public.get_quiz_attempt_item(
  p_attempt_id uuid,
  p_position integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  result jsonb;
begin
  if caller_id is null or not exists (
    select 1 from public.profiles
    where id = caller_id and is_approved and not is_blocked
  ) then
    raise exception 'Your account is awaiting approval.';
  end if;

  select jsonb_build_object(
    'attempt_id', attempt.id,
    'attempt_status', attempt.status,
    'title', attempt.title,
    'total_questions', attempt.total_questions,
    'answered_count', attempt.answered_count,
    'correct_count', attempt.correct_count,
    'score_percent', attempt.score_percent,
    'item_id', item.id,
    'position', item.position,
    'shown_at', now(),
    'question_text', item.question_snapshot ->> 'question_text',
    'choices', item.choices_snapshot,
    'answered', item.answered_at is not null,
    'selected_choice_ids', coalesce(to_jsonb(item.selected_choice_ids), '[]'::jsonb),
    'is_correct', item.is_correct,
    'correct_choice_ids', case
      when item.answered_at is not null then to_jsonb(item.correct_choice_ids)
      else '[]'::jsonb
    end,
    'explanation', case
      when item.answered_at is not null then item.explanation_snapshot
      else null
    end
  )
  into result
  from public.quiz_attempts attempt
  join public.quiz_attempt_items item on item.attempt_id = attempt.id
  where attempt.id = p_attempt_id
    and attempt.user_id = caller_id
    and item.position = p_position;

  return result;
end;
$$;

revoke all on function public.list_user_profiles() from public;
revoke all on function public.set_user_role(uuid, public.user_role) from public;
revoke all on function public.set_user_approval(uuid, boolean) from public;

grant execute on function public.list_user_profiles() to authenticated;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.set_user_approval(uuid, boolean) to authenticated;
grant execute on function public.get_quiz_attempt_item(uuid, integer) to authenticated;
