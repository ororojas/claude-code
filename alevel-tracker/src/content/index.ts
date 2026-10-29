import { businessCards, businessTechnique } from "./business";
import { econCards, econTechnique } from "./econ";
import { sociologyCards, sociologyTechnique } from "./sociology";
import type { ExamTechnique, SubjectId, TeachCard } from "./types";

const cards = new Map<string, TeachCard>(
  [...econCards, ...businessCards, ...sociologyCards].map((c) => [c.topicId, c]),
);

const techniques: Record<SubjectId, ExamTechnique> = {
  econ: econTechnique,
  business: businessTechnique,
  sociology: sociologyTechnique,
};

export function teachCard(topicId: string): TeachCard | undefined {
  return cards.get(topicId);
}

export function examTechnique(subjectId: string): ExamTechnique | undefined {
  return techniques[subjectId as SubjectId];
}

export function allTeachCards(): TeachCard[] {
  return [...cards.values()];
}

export type * from "./types";
