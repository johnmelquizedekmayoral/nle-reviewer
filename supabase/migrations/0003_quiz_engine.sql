-- Secure learner quiz creation, answering, and per-question statistics.

create or replace function public.get_quiz_categories()
returns table (
  category_id uuid,
  category_path text,
  question_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with recursive category_paths as (
    select c.id, c.parent_id, c.name, c.name::text as path
    from public.categories c
    where c.parent_id is null and not c.is_archived

    union all

    select c.id, c.parent_id, c.name, (parent.path || ' / ' || c.name)::text
    from public.categories c
    join category_paths parent on parent.id = c.parent_id
    where not c.is_archived
  ),
  descendants as (
    select c.id as ancestor_id, c.id as descendant_id
    from public.categories c
    where not c.is_archived

    union all

    select d.ancestor_id, child.id
    from descendants d
    join public.categories child on child.parent_id = d.descendant_id
    where not child.is_archived
  )
  select
    path.id as category_id,
    path.path as category_path,
    count(q.id) as question_count
  from category_paths path
  join descendants d on d.ancestor_id = path.id
  join public.questions q
    on q.category_id = d.descendant_id
   and q.status = 'published'
  group by path.id, path.path
  having count(q.id) > 0
  order by path.path;
$$;

create or replace function public.create_quiz_attempt(
  p_category_id uuid,
  p_question_count integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  new_attempt_id uuid;
  question_record record;
  choices_json jsonb;
  correct_ids uuid[];
  selected_total integer;
  item_position integer := 0;
begin
  if caller_id is null then
    raise exception 'Authentication required.';
  end if;

  if exists (
    select 1 from public.profiles
    where id = caller_id and is_blocked
  ) then
    raise exception 'This account is blocked.';
  end if;

  if p_question_count < 1 or p_question_count > 100 then
    raise exception 'Question count must be between 1 and 100.';
  end if;

  if not exists (
    select 1 from public.categories
    where id = p_category_id and not is_archived
  ) then
    raise exception 'Category not found.';
  end if;

  with recursive selected_categories as (
    select id from public.categories
    where id = p_category_id and not is_archived

    union all

    select child.id
    from public.categories child
    join selected_categories parent on child.parent_id = parent.id
    where not child.is_archived
  )
  select least(count(q.id), p_question_count)::integer
  into selected_total
  from public.questions q
  where q.category_id in (select id from selected_categories)
    and q.status = 'published';

  if selected_total = 0 then
    raise exception 'No visible questions are available in this category.';
  end if;

  insert into public.quiz_attempts (
    user_id,
    mode,
    status,
    title,
    configuration,
    total_questions
  )
  select
    caller_id,
    'instant',
    'active',
    c.name,
    jsonb_build_object(
      'category_id', p_category_id,
      'requested_questions', p_question_count,
      'shuffle_questions', true,
      'shuffle_choices', true
    ),
    selected_total
  from public.categories c
  where c.id = p_category_id
  returning id into new_attempt_id;

  for question_record in
    with recursive selected_categories as (
      select id from public.categories
      where id = p_category_id and not is_archived

      union all

      select child.id
      from public.categories child
      join selected_categories parent on child.parent_id = parent.id
      where not child.is_archived
    )
    select q.*
    from public.questions q
    where q.category_id in (select id from selected_categories)
      and q.status = 'published'
    order by random()
    limit selected_total
  loop
    item_position := item_position + 1;

    select jsonb_agg(
      jsonb_build_object(
        'id', shuffled.id,
        'label', chr(64 + shuffled.display_order::integer),
        'choice_text', shuffled.choice_text
      )
      order by shuffled.display_order
    )
    into choices_json
    from (
      select
        choice.id,
        choice.choice_text,
        row_number() over (order by random()) as display_order
      from public.question_choices choice
      where choice.question_id = question_record.id
    ) shuffled;

    select array_agg(choice.id order by choice.id)
    into correct_ids
    from public.question_choices choice
    where choice.question_id = question_record.id
      and choice.is_correct;

    if jsonb_array_length(coalesce(choices_json, '[]'::jsonb)) <> 4
       or coalesce(array_length(correct_ids, 1), 0) <> 1 then
      raise exception 'Question % must have four choices and one correct answer.', question_record.id;
    end if;

    insert into public.quiz_attempt_items (
      attempt_id,
      question_id,
      position,
      question_snapshot,
      choices_snapshot,
      correct_choice_ids,
      explanation_snapshot
    )
    values (
      new_attempt_id,
      question_record.id,
      item_position,
      jsonb_build_object(
        'question_text', question_record.question_text,
        'category_id', question_record.category_id,
        'source', question_record.source
      ),
      choices_json,
      correct_ids,
      question_record.explanation
    );
  end loop;

  return new_attempt_id;
end;
$$;

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
  if caller_id is null then
    raise exception 'Authentication required.';
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
    'correct_choice_ids',
      case when item.answered_at is not null
        then to_jsonb(item.correct_choice_ids)
        else '[]'::jsonb
      end,
    'explanation',
      case when item.answered_at is not null
        then item.explanation_snapshot
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

create or replace function public.submit_quiz_answer(
  p_attempt_id uuid,
  p_item_id uuid,
  p_selected_choice_id uuid,
  p_response_time_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  item_record record;
  answer_is_correct boolean;
  new_answered_count integer;
  new_correct_count integer;
  total_count integer;
  attempt_finished boolean;
begin
  if caller_id is null then
    raise exception 'Authentication required.';
  end if;

  select item.*, attempt.total_questions, attempt.answered_count,
         attempt.status as attempt_status
  into item_record
  from public.quiz_attempt_items item
  join public.quiz_attempts attempt on attempt.id = item.attempt_id
  where item.id = p_item_id
    and item.attempt_id = p_attempt_id
    and attempt.user_id = caller_id
  for update of item, attempt;

  if not found then
    raise exception 'Quiz question not found.';
  end if;
  if item_record.attempt_status <> 'active' then
    raise exception 'This quiz is already completed.';
  end if;
  if item_record.answered_at is not null then
    raise exception 'This question has already been answered.';
  end if;
  if item_record.position <> item_record.answered_count + 1 then
    raise exception 'Answer the quiz questions in order.';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(item_record.choices_snapshot) choice
    where (choice ->> 'id')::uuid = p_selected_choice_id
  ) then
    raise exception 'Selected choice is invalid.';
  end if;

  answer_is_correct := p_selected_choice_id = any(item_record.correct_choice_ids);

  update public.quiz_attempt_items
  set selected_choice_ids = array[p_selected_choice_id],
      is_correct = answer_is_correct,
      response_time_ms = greatest(coalesce(p_response_time_ms, 0), 0),
      answered_at = now()
  where id = p_item_id;

  update public.quiz_attempts
  set answered_count = answered_count + 1,
      correct_count = correct_count + case when answer_is_correct then 1 else 0 end,
      score_percent = round(
        ((correct_count + case when answer_is_correct then 1 else 0 end)::numeric * 100)
        / total_questions,
        2
      ),
      status = case
        when answered_count + 1 >= total_questions then 'submitted'::public.attempt_status
        else status
      end,
      submitted_at = case
        when answered_count + 1 >= total_questions then now()
        else submitted_at
      end,
      duration_ms = case
        when answered_count + 1 >= total_questions
          then floor(extract(epoch from (now() - started_at)) * 1000)::bigint
        else duration_ms
      end
  where id = p_attempt_id
  returning answered_count, correct_count, total_questions,
            status = 'submitted' into new_answered_count, new_correct_count,
            total_count, attempt_finished;

  if item_record.question_id is not null then
    insert into public.user_question_stats (
      user_id,
      question_id,
      first_seen_at,
      last_seen_at,
      times_seen,
      times_correct,
      times_wrong,
      total_response_time_ms,
      last_result_correct,
      current_correct_streak
    )
    values (
      caller_id,
      item_record.question_id,
      now(),
      now(),
      1,
      case when answer_is_correct then 1 else 0 end,
      case when answer_is_correct then 0 else 1 end,
      greatest(coalesce(p_response_time_ms, 0), 0),
      answer_is_correct,
      case when answer_is_correct then 1 else 0 end
    )
    on conflict (user_id, question_id) do update
    set last_seen_at = excluded.last_seen_at,
        times_seen = public.user_question_stats.times_seen + 1,
        times_correct = public.user_question_stats.times_correct + excluded.times_correct,
        times_wrong = public.user_question_stats.times_wrong + excluded.times_wrong,
        total_response_time_ms = public.user_question_stats.total_response_time_ms
          + excluded.total_response_time_ms,
        last_result_correct = excluded.last_result_correct,
        current_correct_streak = case
          when excluded.last_result_correct
            then public.user_question_stats.current_correct_streak + 1
          else 0
        end;
  end if;

  return jsonb_build_object(
    'is_correct', answer_is_correct,
    'answered_count', new_answered_count,
    'correct_count', new_correct_count,
    'total_questions', total_count,
    'finished', attempt_finished
  );
end;
$$;

revoke all on function public.get_quiz_categories() from public;
revoke all on function public.create_quiz_attempt(uuid, integer) from public;
revoke all on function public.get_quiz_attempt_item(uuid, integer) from public;
revoke all on function public.submit_quiz_answer(uuid, uuid, uuid, integer) from public;

grant execute on function public.get_quiz_categories() to authenticated;
grant execute on function public.create_quiz_attempt(uuid, integer) to authenticated;
grant execute on function public.get_quiz_attempt_item(uuid, integer) to authenticated;
grant execute on function public.submit_quiz_answer(uuid, uuid, uuid, integer) to authenticated;
