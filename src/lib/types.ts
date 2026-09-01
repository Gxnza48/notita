export interface Subject {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: number;
}

export interface SubjectOverview {
  subject: Subject;
  note_count: number;
  concept_count: number;
  question_count: number;
  task_count: number;
}

export interface Note {
  id: string;
  subject_id: string;
  title: string;
  content: string;
  content_text: string;
  concept_count: number;
  pinned: boolean;
  created_at: number;
  updated_at: number;
}

export interface NoteSummary {
  id: string;
  subject_id: string;
  subject_name: string;
  title: string;
  updated_at: number;
  created_at: number;
  pinned: boolean;
}

export interface MarkerInput {
  text: string;
  done: boolean;
}

export interface SaveNotePayload {
  id: string;
  title: string;
  content: string;
  content_text: string;
  concept_count: number;
  tasks: MarkerInput[];
  questions: MarkerInput[];
  important: MarkerInput[];
}

export interface SearchHit {
  note_id: string;
  subject_id: string;
  subject_name: string;
  title: string;
  snippet: string;
  updated_at: number;
}

export interface WpmRecord {
  wpm: number;
  note_id: string | null;
  subject_name: string | null;
  recorded_at: number;
}

export interface SessionStats {
  average: number;
  peak: number;
  samples: number;
  total_chars: number;
}

export type ThemePreference = "system" | "dark" | "light";
