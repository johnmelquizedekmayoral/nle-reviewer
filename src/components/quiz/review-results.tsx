"use client";

import { useState } from "react";

type Choice = { id: string; label: string; choice_text: string };

export type ReviewItem = {
  id: string;
  position: number;
  questionText: string;
  choices: Choice[];
  correctChoiceIds: string[];
  selectedChoiceIds: string[];
  explanation: string;
  isCorrect: boolean;
};

type Filter = "all" | "correct" | "wrong";

export function ReviewResults({ items }: { items: ReviewItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = {
    all: items.length,
    correct: items.filter((item) => item.isCorrect).length,
    wrong: items.filter((item) => !item.isCorrect).length,
  };
  const visibleItems = filter === "all"
    ? items
    : items.filter((item) => filter === "correct" ? item.isCorrect : !item.isCorrect);

  return (
    <>
      <div className="review-filters" role="group" aria-label="Filter quiz results">
        {(["all", "correct", "wrong"] as const).map((value) => (
          <button
            className={filter === value ? "active" : ""}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            key={value}
          >
            <span>{value}</span>
            <strong>{counts[value]}</strong>
          </button>
        ))}
      </div>

      <section className="review-list" aria-live="polite">
        {visibleItems.map((item) => {
          const selectedId = item.selectedChoiceIds[0];
          const correctId = item.correctChoiceIds[0];

          return (
            <article className={`review-card ${item.isCorrect ? "correct" : "wrong"}`} key={item.id}>
              <div className="review-card-head">
                <span>Question {item.position}</span>
                <strong>{item.isCorrect ? "Correct" : "Wrong"}</strong>
              </div>
              <h2>{item.questionText}</h2>

              <div className="review-choices">
                {item.choices.map((choice) => {
                  const isCorrectChoice = choice.id === correctId;
                  const isSelected = choice.id === selectedId;
                  return (
                    <div
                      className={`review-choice ${isCorrectChoice ? "correct" : ""} ${
                        isSelected && !isCorrectChoice ? "wrong" : ""
                      }`}
                      key={choice.id}
                    >
                      <span>{choice.label}</span>
                      <p>{choice.choice_text}</p>
                      {isCorrectChoice ? <strong>Correct answer</strong> : null}
                      {isSelected && !isCorrectChoice ? <strong>Your answer</strong> : null}
                    </div>
                  );
                })}
              </div>

              <div className="review-explanation">
                <strong>Explanation</strong>
                <p>{item.explanation || "No explanation was added for this question."}</p>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}

