import { PrismaClient, type BuilderTier } from '@prisma/client';

/**
 * Workspace bootstrap catalog. Presets are code-defined because the current
 * Prisma schema intentionally has no persisted WorkspacePreset model. The
 * workspace provisioning flow can consume these definitions in a later phase.
 */
export const SMART_WORKFLOW_PRESETS = {
  Personal: {
    name: 'Personal',
    description: 'A private home for personal notes, projects, and goals.',
    pages: ['Getting Started', 'Projects', 'Journal', 'Goals'],
    databases: [
      { name: 'Tasks', properties: ['Status', 'Due Date', 'Priority'] },
      { name: 'Notes', properties: ['Category', 'Created At'] },
    ],
  },
  Team: {
    name: 'Team',
    description: 'A shared hub for team planning, decisions, and delivery.',
    pages: ['Team Home', 'Projects', 'Meeting Notes', 'Handbook'],
    databases: [
      { name: 'Tasks', properties: ['Status', 'Assignee', 'Due Date', 'Priority'] },
      { name: 'Projects', properties: ['Status', 'Owner', 'Start Date', 'Due Date'] },
      { name: 'Meeting Notes', properties: ['Date', 'Attendees', 'Project'] },
    ],
  },
  School: {
    name: 'School',
    description: 'A study hub for courses, assignments, and class notes.',
    pages: ['School Home', 'Courses', 'Study Notes', 'Study Planner'],
    databases: [
      { name: 'Assignments', properties: ['Status', 'Course', 'Due Date', 'Priority'] },
      { name: 'Courses', properties: ['Instructor', 'Term', 'Room'] },
      { name: 'Study Sessions', properties: ['Date', 'Course', 'Duration'] },
    ],
  },
} as const;

const badges: Array<{
  slug: string;
  name: string;
  description: string;
  icon: string;
  requiredTier: BuilderTier;
}> = [
  {
    slug: 'first-page',
    name: 'First Page',
    description: 'Create your first workspace page.',
    icon: 'file-text',
    requiredTier: 'APPRENTICE_SCRIBE',
  },
  {
    slug: 'task-tender',
    name: 'Task Tender',
    description: 'Complete your first task.',
    icon: 'circle-check',
    requiredTier: 'APPRENTICE_SCRIBE',
  },
  {
    slug: 'database-maker',
    name: 'Database Maker',
    description: 'Create your first relational database.',
    icon: 'table-2',
    requiredTier: 'APPRENTICE_SCRIBE',
  },
  {
    slug: 'systems-architect',
    name: 'Systems Architect',
    description: 'Reach 500 builder XP.',
    icon: 'blocks',
    requiredTier: 'SYSTEMS_ARCHITECT',
  },
  {
    slug: 'template-publisher',
    name: 'Template Publisher',
    description: 'Publish a reusable workspace template.',
    icon: 'send',
    requiredTier: 'SYSTEMS_ARCHITECT',
  },
  {
    slug: 'grandmaster-weaver',
    name: 'Grandmaster Weaver',
    description: 'Reach 2,500 builder XP.',
    icon: 'sparkles',
    requiredTier: 'GRANDMASTER_WEAVER',
  },
];

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.$transaction(
    badges.map((badge) =>
      prisma.achievementBadge.upsert({
        where: { slug: badge.slug },
        update: {
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          requiredTier: badge.requiredTier,
        },
        create: badge,
      }),
    ),
  );

  console.info(`Seeded ${badges.length} achievement badges.`);
  console.info(`Available workflow presets: ${Object.keys(SMART_WORKFLOW_PRESETS).join(', ')}.`);
}

main()
  .catch((error: unknown) => {
    console.error('Prisma seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
