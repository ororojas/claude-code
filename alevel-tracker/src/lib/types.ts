import type { SubjectId } from "@/content/types";

export type { SubjectId };
export type Rag = "red" | "amber" | "green";
export type BlockKind = "content" | "timed_paper" | "marking" | "mop_up" | "recall" | "exam";
export type PaperKind = "past_paper" | "specimen" | "as_paper";

export interface Subject {
  id: SubjectId;
  name: string;
  board: string;
  spec_code: string;
  paper_label: string;
  duration_minutes: number;
  max_marks: number;
  colour: string;
  sort_order: number;
}

export interface Topic {
  id: string;
  subject_id: SubjectId;
  section: string;
  spec_ref: string;
  title: string;
  exam_focus: string | null;
  est_hours: number;
  sort_order: number;
}

export interface PastPaper {
  id: string;
  subject_id: SubjectId;
  kind: PaperKind;
  series: string;
  year: number;
  component: string;
  title: string;
  max_marks: number;
  duration_minutes: number;
  qp_url: string | null;
  ms_url: string | null;
  source_url: string;
  notes: string | null;
  sort_order: number;
}

export interface GradeBoundaryRow {
  subject_id: SubjectId;
  user_id: string | null;
  grade: string;
  min_percent: number;
  source: string | null;
}

export interface UserSubject {
  subject_id: SubjectId;
  target_grade: string;
  target_hours: number;
  target_papers: number;
  exam_date: string;
  exam_session: "AM" | "PM" | null;
}

export interface TopicProgress {
  topic_id: string;
  status: Rag;
  percent_complete: number;
  notes: string | null;
  updated_at: string;
}

export interface ScheduleItem {
  id: string;
  day: string;
  start_time: string;
  end_time: string;
  subject_id: SubjectId | null;
  kind: BlockKind;
  title: string;
  detail: string | null;
  topic_ids: string[];
  past_paper_id: string | null;
  completed_at: string | null;
}

export interface StudySession {
  id: string;
  subject_id: SubjectId;
  topic_id: string | null;
  schedule_item_id: string | null;
  studied_on: string;
  minutes: number;
  note: string | null;
}

export interface PaperAttempt {
  id: string;
  subject_id: SubjectId;
  past_paper_id: string | null;
  title: string;
  sat_on: string;
  marks_scored: number;
  max_marks: number;
  timed: boolean;
  minutes_taken: number | null;
  lost_knowledge: number;
  lost_timing: number;
  lost_structure: number;
  lost_other: number;
  reflection: string | null;
  weak_topic_ids: string[];
  created_at: string;
}
