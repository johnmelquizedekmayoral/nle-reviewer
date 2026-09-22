export type ParsedBulkQuestion = {
  number: number;
  questionText: string;
  choices: Array<{
    label: "A" | "B" | "C" | "D";
    choiceText: string;
    isCorrect: boolean;
    sortOrder: number;
  }>;
  explanation: string;
};

type ActiveField = "question" | "A" | "B" | "C" | "D" | "explanation";

type WorkingQuestion = {
  number: number;
  question: string;
  A: string;
  B: string;
  C: string;
  D: string;
  answer: string;
  explanation: string;
  sawExplanation: boolean;
  activeField: ActiveField;
};

const labels = ["A", "B", "C", "D"] as const;

function append(target: string, value: string) {
  if (!target) return value.trim();
  if (!value.trim()) return `${target}\n`;
  return `${target}\n${value.trim()}`;
}

function canStartNextQuestion(current: WorkingQuestion, number: number) {
  return (
    number === current.number + 1 &&
    current.sawExplanation &&
    labels.every((label) => current[label].trim()) &&
    labels.includes(current.answer.toUpperCase() as (typeof labels)[number])
  );
}

function finish(current: WorkingQuestion): ParsedBulkQuestion {
  const missing: string[] = [];
  if (!current.question.trim()) missing.push("question text");
  labels.forEach((label) => {
    if (!current[label].trim()) missing.push(`choice ${label}`);
  });
  if (!labels.includes(current.answer.toUpperCase() as (typeof labels)[number])) {
    missing.push("a valid Answer: A, B, C, or D line");
  }
  if (!current.sawExplanation || !current.explanation.trim()) missing.push("explanation");

  if (missing.length) {
    throw new Error(`Question ${current.number} is missing ${missing.join(", ")}.`);
  }

  const answer = current.answer.toUpperCase();
  return {
    number: current.number,
    questionText: current.question.trim(),
    choices: labels.map((label, index) => ({
      label,
      choiceText: current[label].trim(),
      isCorrect: label === answer,
      sortOrder: index,
    })),
    explanation: current.explanation.trim(),
  };
}

export function parseBulkQuestions(input: string): ParsedBulkQuestion[] {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const parsed: ParsedBulkQuestion[] = [];
  let current: WorkingQuestion | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const questionMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);

    if (
      questionMatch &&
      (!current || canStartNextQuestion(current, Number(questionMatch[1])))
    ) {
      if (current) parsed.push(finish(current));
      current = {
        number: Number(questionMatch[1]),
        question: questionMatch[2].trim(),
        A: "",
        B: "",
        C: "",
        D: "",
        answer: "",
        explanation: "",
        sawExplanation: false,
        activeField: "question",
      };
      continue;
    }

    if (!current) {
      if (!line.trim()) continue;
      throw new Error("The first question must start with a number followed by a period, such as 1.");
    }

    const choiceMatch = line.match(/^\s*([A-D])\.\s*(.*)$/i);
    if (choiceMatch) {
      const label = choiceMatch[1].toUpperCase() as (typeof labels)[number];
      current.activeField = label;
      current[label] = choiceMatch[2].trim();
      continue;
    }

    const answerMatch = line.match(/^\s*Answer:\s*([A-D])\s*$/i);
    if (answerMatch) {
      current.answer = answerMatch[1].toUpperCase();
      continue;
    }

    const explanationMatch = line.match(/^\s*Explanation:\s*(.*)$/i);
    if (explanationMatch) {
      current.activeField = "explanation";
      current.sawExplanation = true;
      current.explanation = explanationMatch[1].trim();
      continue;
    }

    current[current.activeField] = append(current[current.activeField], line);
  }

  if (current) parsed.push(finish(current));
  if (!parsed.length) throw new Error("No valid questions were found.");

  return parsed;
}
