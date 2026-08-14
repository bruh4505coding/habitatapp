export type TaskStatus = 'to_do' | 'in_progress' | 'blocked' | 'completed' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export const TASK_STATUSES: TaskStatus[] = [
  'to_do',
  'in_progress',
  'blocked',
  'completed',
  'archived',
];

export const OPEN_TASK_STATUSES: TaskStatus[] = [
  'to_do',
  'in_progress',
  'blocked',
];

export const TASK_PRIORITIES: TaskPriority[] = [
  'low',
  'medium',
  'high',
  'urgent',
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: 'To Do',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
  archived: 'Archived',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  to_do: '#78909c',
  in_progress: '#1976d2',
  blocked: '#e53935',
  completed: '#43a047',
  archived: '#9e9e9e',
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: '#78909c',
  medium: '#5c6bc0',
  high: '#fb8c00',
  urgent: '#e53935',
};

export function isTaskStatus(value: string | null | undefined): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

export function isTaskPriority(value: string | null | undefined): value is TaskPriority {
  return TASK_PRIORITIES.includes(value as TaskPriority);
}

export type StewardTask = {
  id: string;
  steward_group_id: string;
  habitat_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type StewardTaskRow = StewardTask & {
  habitats?: { name: string; habitat_code: string | null } | null;
  assignee?: { username: string } | null;
  creator?: { username: string } | null;
};

export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return '—';
  const [year, month, day] = dueDate.split('-');
  if (!year || !month || !day) return dueDate;
  return `${month}/${day}/${year}`;
}
