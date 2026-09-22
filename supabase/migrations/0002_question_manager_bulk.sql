-- Atomic bulk creation and question editing for Question Manager.

create or replace function public.bulk_create_questions(
  p_category_id uuid,
  p_status public.question_status,
  p_questions jsonb
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  question_record jsonb;
  choice_record jsonb;
  new_question_id uuid;
  imported_count integer := 0;
  correct_count integer;
begin
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then
    raise exception 'Questions must be a non-empty JSON array.';
  end if;

  for question_record in select value from jsonb_array_elements(p_questions)
  loop
    if jsonb_array_length(question_record -> 'choices') <> 4 then
      raise exception 'Every question must contain exactly four choices.';
    end if;

    select count(*)
    into correct_count
    from jsonb_array_elements(question_record -> 'choices') choice
    where coalesce((choice ->> 'is_correct')::boolean, false);

    if correct_count <> 1 then
      raise exception 'Every question must contain exactly one correct answer.';
    end if;

    insert into public.questions (
      category_id,
      question_text,
      explanation,
      source,
      status,
      created_by
    )
    values (
      p_category_id,
      trim(question_record ->> 'question_text'),
      trim(question_record ->> 'explanation'),
      nullif(trim(question_record ->> 'source'), ''),
      p_status,
      (select auth.uid())
    )
    returning id into new_question_id;

    for choice_record in select value from jsonb_array_elements(question_record -> 'choices')
    loop
      insert into public.question_choices (
        question_id,
        label,
        choice_text,
        is_correct,
        sort_order
      )
      values (
        new_question_id,
        choice_record ->> 'label',
        trim(choice_record ->> 'choice_text'),
        (choice_record ->> 'is_correct')::boolean,
        (choice_record ->> 'sort_order')::integer
      );
    end loop;

    imported_count := imported_count + 1;
  end loop;

  return imported_count;
end;
$$;

create or replace function public.update_question_with_choices(
  p_question_id uuid,
  p_category_id uuid,
  p_question_text text,
  p_explanation text,
  p_source text,
  p_status public.question_status,
  p_choices jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  choice_record jsonb;
  correct_count integer;
begin
  if jsonb_array_length(p_choices) <> 4 then
    raise exception 'Every question must contain exactly four choices.';
  end if;

  select count(*)
  into correct_count
  from jsonb_array_elements(p_choices) choice
  where coalesce((choice ->> 'is_correct')::boolean, false);

  if correct_count <> 1 then
    raise exception 'Every question must contain exactly one correct answer.';
  end if;

  update public.questions
  set category_id = p_category_id,
      question_text = trim(p_question_text),
      explanation = trim(p_explanation),
      source = nullif(trim(p_source), ''),
      status = p_status
  where id = p_question_id;

  if not found then
    raise exception 'Question not found.';
  end if;

  delete from public.question_choices where question_id = p_question_id;

  for choice_record in select value from jsonb_array_elements(p_choices)
  loop
    insert into public.question_choices (
      question_id,
      label,
      choice_text,
      is_correct,
      sort_order
    )
    values (
      p_question_id,
      choice_record ->> 'label',
      trim(choice_record ->> 'choice_text'),
      (choice_record ->> 'is_correct')::boolean,
      (choice_record ->> 'sort_order')::integer
    );
  end loop;
end;
$$;

revoke all on function public.bulk_create_questions(uuid, public.question_status, jsonb) from public;
revoke all on function public.update_question_with_choices(uuid, uuid, text, text, text, public.question_status, jsonb) from public;
grant execute on function public.bulk_create_questions(uuid, public.question_status, jsonb) to authenticated;
grant execute on function public.update_question_with_choices(uuid, uuid, text, text, text, public.question_status, jsonb) to authenticated;
