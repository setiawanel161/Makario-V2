export interface WorkflowDatabasePreset {
  name: string;
  properties: readonly string[];
}

export interface SmartWorkflowPreset {
  key: 'PERSONAL' | 'TEAM' | 'SCHOOL';
  name: string;
  description: string;
  pages: readonly string[];
  databases: readonly WorkflowDatabasePreset[];
}

export type SmartWorkflowPresetKey = SmartWorkflowPreset['key'];

export const SMART_WORKFLOW_PRESETS: Record<
  SmartWorkflowPreset['key'],
  SmartWorkflowPreset
> = {
  PERSONAL: {
    key: 'PERSONAL',
    name: 'Personal',
    description: 'A private home for personal notes, projects, and goals.',
    pages: ['Getting Started', 'Projects', 'Journal', 'Goals'],
    databases: [
      { name: 'Tasks', properties: ['Status', 'Due Date', 'Priority'] },
      { name: 'Notes', properties: ['Category', 'Created At'] },
    ],
  },
  TEAM: {
    key: 'TEAM',
    name: 'Team',
    description: 'A shared hub for team planning, decisions, and delivery.',
    pages: ['Team Home', 'Projects', 'Meeting Notes', 'Handbook'],
    databases: [
      { name: 'Tasks', properties: ['Status', 'Assignee', 'Due Date', 'Priority'] },
      { name: 'Projects', properties: ['Status', 'Owner', 'Start Date', 'Due Date'] },
      { name: 'Meeting Notes', properties: ['Date', 'Attendees', 'Project'] },
    ],
  },
  SCHOOL: {
    key: 'SCHOOL',
    name: 'School',
    description: 'A study hub for courses, assignments, and class notes.',
    pages: ['School Home', 'Courses', 'Study Notes', 'Study Planner'],
    databases: [
      { name: 'Assignments', properties: ['Status', 'Course', 'Due Date', 'Priority'] },
      { name: 'Courses', properties: ['Instructor', 'Term', 'Room'] },
      { name: 'Study Sessions', properties: ['Date', 'Course', 'Duration'] },
    ],
  },
};

export const SMART_WORKFLOW_PRESET_KEYS = ['PERSONAL', 'TEAM', 'SCHOOL'] as const;
