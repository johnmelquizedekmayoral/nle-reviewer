-- Return answer feedback and the next question in one direct client RPC.

create or replace function public.submit_quiz_answer_fast(
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
  summary jsonb;
  answered_item record;
  next_item jsonb := null;
  next_position integer;
  score numeric;
begin
  summary := public.submit_quiz_answer(p_attempt_id, p_item_id, p_selected_choice_id, p_response_time_ms);

  select item.position, item.correct_choice_ids, item.explanation_snapshot
  into answered_item
  from public.quiz_attempt_items item
  where item.id = p_item_id and item.attempt_id = p_attempt_id;

  score := round(
    ((summary ->> 'correct_count')::numeric * 100)
    / greatest((summary ->> 'total_questions')::integer, 1),
    2
  );

  if not (summary ->> 'finished')::boolean then
    next_position := answered_item.position + 1;
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
      'answered', false,
      'selected_choice_ids', '[]'::jsonb,
      'is_correct', null,
      'correct_choice_ids', '[]'::jsonb,
      'explanation', null
    )
    into next_item
    from public.quiz_attempts attempt
    join public.quiz_attempt_items item on item.attempt_id = attempt.id
    where attempt.id = p_attempt_id
      and attempt.user_id = (select auth.uid())
      and item.position = next_position;
  end if;

  return summary || jsonb_build_object(
    'selected_choice_ids', jsonb_build_array(p_selected_choice_id),
    'correct_choice_ids', to_jsonb(answered_item.correct_choice_ids),
    'explanation', answered_item.explanation_snapshot,
    'score_percent', score,
    'next_item', next_item
  );
end;
$$;

revoke all on function public.submit_quiz_answer_fast(uuid, uuid, uuid, integer) from public;
grant execute on function public.submit_quiz_answer_fast(uuid, uuid, uuid, integer) to authenticated;

