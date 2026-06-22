import type { Timestamp } from 'firebase/firestore';

export interface Task {
  id: string;
  label: string;
  dueText?: string;
  url?: string;
}

export interface Section {
  id: string;
  title: string;
  tasks: Task[];
}

export interface CountryOption {
  id: string;
  label: string;
}

export interface Questionnaire {
  version: string;
  country: string;
  type: 'checkin' | 'checkout';
  sections: Section[];
}

export type LogEventType =
  | 'created'
  | 'task_checked'
  | 'task_unchecked'
  | 'all_unchecked'
  | 'note_added'
  | 'note_edited'
  | 'note_deleted'
  | 'deletion_requested'
  | 'deletion_cancelled'
  | 'custom_task_added'
  | 'custom_task_edited'
  | 'custom_task_deleted';

export interface LogEvent {
  type: LogEventType;
  actor: string;
  timestamp: Timestamp;
  taskId?: string;
  noteId?: string;
  noteText?: string;
  customTaskId?: string;
  customTaskLabel?: string;
  customTaskSectionId?: string | null;
}

export interface ChecklistDoc {
  name: string;
  country: string;
  type: 'checkin' | 'checkout';
  questionnaireVersion: string;
  createdAt: Timestamp;
  pendingDeletion: Timestamp | null;
  log: LogEvent[];
}

export interface DerivedNote {
  noteId: string;
  text: string;
  actor: string;
  addedAt: Timestamp;
  editedAt?: Timestamp;
}

export interface DerivedTaskState {
  checked: boolean;
  notes: DerivedNote[];
}

export interface DerivedCustomTask {
  id: string;
  label: string;
  sectionId: string | null;
  actor: string;
  createdAt: Timestamp;
}

export interface LocalChecklistRef {
  id: string;
  name: string;
  country: string;
  countryLabel: string;
  type: 'checkin' | 'checkout';
  createdAt: number;
  pendingDeletionAt?: number;
}

export type ChecklistType = 'checkin' | 'checkout';
