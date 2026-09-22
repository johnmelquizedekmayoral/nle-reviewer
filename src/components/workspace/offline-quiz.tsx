"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { quizKey, writeLocal } from "@/lib/offline/db";
import type { OfflineAnswer, OfflineQuizPack } from "@/lib/offline/types";

type Props = {
  pack: OfflineQuizPack;
  onComplete: (pack: OfflineQuizPack) => void;
  onExit: () => void;
};

export function OfflineQuiz({ pack: initialPack, onComplete, onExit }: Props) {
  const [pack, setPack] = useState(initialPack);
  const [position, setPosition] = useState(initialPack.current_position ?? 0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const shownAt = useRef(0);
  const item = pack.items[position];
  const existing = useMemo(() => pack.answers?.find((answer) => answer.item_id === item?.id), [item?.id, pack.answers]);

  useEffect(() => { shownAt.current = Date.now(); }, [position]);

  if (!item) return null;
  const selectedId = existing?.selected_choice_id ?? selected;
  const correctId = item.correct_choice_ids[0];
  const isCorrect = selectedId === correctId;
  const answered = Boolean(existing) || revealed;

  async function checkAnswer() {
    if (!selected || answered) return;
    const answer: OfflineAnswer = {
      item_id: item.id,
      selected_choice_id: selected,
      response_time_ms: Math.max(Date.now() - (shownAt.current || Date.now()), 0),
    };
    const nextPack = { ...pack, answers: [...(pack.answers ?? []), answer], current_position: position, needs_sync: true };
    setPack(nextPack);
    setRevealed(true);
    await writeLocal(quizKey(pack.attempt.id), nextPack);
  }

  async function next() {
    if (position === pack.items.length - 1) {
      const completed = { ...pack, current_position: position, needs_sync: true };
      await writeLocal(quizKey(pack.attempt.id), completed);
      onComplete(completed);
      return;
    }
    const nextPosition = position + 1;
    const nextPack = { ...pack, current_position: nextPosition };
    setPack(nextPack);
    setPosition(nextPosition);
    setSelected(null);
    setRevealed(false);
    await writeLocal(quizKey(pack.attempt.id), nextPack);
  }

  const correctCount = pack.answers?.filter((answer) => pack.items.find((candidate) => candidate.id === answer.item_id)?.correct_choice_ids.includes(answer.selected_choice_id)).length ?? 0;
  const progress = Math.round(((position + (answered ? 1 : 0)) / pack.items.length) * 100);

  return (
    <section className="workspace-quiz">
      <header className="quiz-top">
        <div><p className="eyebrow">Offline-ready quiz</p><h1>Question {position + 1} of {pack.items.length}</h1></div>
        <button className="button button-secondary" type="button" onClick={onExit}>Save &amp; exit</button>
      </header>
      <div className="quiz-progress"><span style={{ width: `${progress}%` }} /></div>
      <article className="quiz-card">
        <p className="quiz-position">{correctCount} correct so far</p>
        <h2 className="quiz-question">{item.question_text}</h2>
        <fieldset className="quiz-choices" disabled={answered}>
          <legend className="sr-only">Answer choices</legend>
          {item.choices.map((choice) => {
            const correct = answered && choice.id === correctId;
            const wrong = answered && choice.id === selectedId && !correct;
            return (
              <label className={correct ? "quiz-choice correct" : wrong ? "quiz-choice wrong" : "quiz-choice"} key={choice.id}>
                <input type="radio" name={`answer-${item.id}`} checked={selectedId === choice.id} onChange={() => setSelected(choice.id)} />
                <span className="quiz-choice-label">{choice.label}</span><span>{choice.choice_text}</span>
              </label>
            );
          })}
        </fieldset>
        {!answered ? <button className="button quiz-submit" type="button" disabled={!selected} onClick={checkAnswer}>Check answer</button> : null}
        {answered ? (
          <>
            <section className={`quiz-feedback ${isCorrect ? "success" : "error"}`}>
              <strong>{isCorrect ? "Correct answer" : "Not quite"}</strong><p>{item.explanation || "No explanation was added."}</p>
            </section>
            <div className="quiz-actions"><button className="button" type="button" onClick={next}>{position === pack.items.length - 1 ? "Show results" : "Next question"}</button></div>
          </>
        ) : null}
      </article>
      <p className="offline-note">Answers are stored on this device. The completed result syncs after the result screen appears.</p>
    </section>
  );
}
