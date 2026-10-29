export type SubjectId = "econ" | "business" | "sociology";

export interface Definition {
  term: string;
  definition: string;
}

export interface DiagramCheck {
  name: string;
  checklist: string[];
}

export interface KeyStudy {
  name: string;
  point: string;
}

export interface Formula {
  name: string;
  formula: string;
  tip?: string;
}

export interface EssayPlan {
  marks: number;
  /** Command word and tariff, e.g. "Evaluate (25)". */
  label: string;
  question: string;
  structure: string[];
  evaluation: string[];
}

export interface PracticeQuestion {
  marks: number;
  question: string;
  /** Worked answer, for calculation questions only. */
  answer?: string;
}

export interface TeachCard {
  topicId: string;
  summary: string[];
  definitions: Definition[];
  diagrams?: DiagramCheck[];
  formulas?: Formula[];
  studies?: KeyStudy[];
  essays: EssayPlan[];
  mistakes: string[];
  practice: PracticeQuestion[];
}

export interface QuestionType {
  marks: number;
  command: string;
  minutes: number;
  howToHit: string;
}

export interface ExamTechnique {
  subjectId: SubjectId;
  paper: string;
  timing: string;
  questionTypes: QuestionType[];
}
