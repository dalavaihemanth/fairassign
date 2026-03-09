export type FacultyPriority = 'normal' | 'reduced' | 'exempt';

export interface Faculty {
  id: string;
  name: string;
  department: string;
  maxDuties: number;
  priority: FacultyPriority;
}

export type Session = 'AM' | 'PM';

export interface ExamSlot {
  id: string;
  date: string; // YYYY-MM-DD
  session: Session;
  required: number;
}

export interface Unavailability {
  id: string;
  facultyId: string;
  date: string;
  session: Session;
}

export interface Assignment {
  id: string;
  facultyId: string;
  slotId: string;
}

export interface ScheduleConstraints {
  avoidSameDayDouble: boolean;
  respectMaxDuties: boolean;
}

export interface SavedSchedule {
  id: string;
  name: string;
  assignments: Assignment[];
  createdAt: string;
}

export type ExamStatus = 'active' | 'archived';

export interface Examination {
  id: string;
  name: string;
  status: ExamStatus;
  createdAt: string;
  slots: ExamSlot[];
  assignments: Assignment[];
  constraints: ScheduleConstraints;
  savedSchedules: SavedSchedule[];
  publishedAssignments: Assignment[];
  pinnedKeys: string[]; // serialized Set
  lockedTotals: [string, number][]; // serialized Map
  facultyGaps: [string, number][]; // serialized Map
}

export function getSlotKey(date: string, session: Session): string {
  return `${date}_${session}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}
