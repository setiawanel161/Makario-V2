import { PrismaClient, type BuilderTier } from '@prisma/client';
import { SMART_WORKFLOW_PRESETS } from '../src/server/workspaces/presets';

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
  console.info(
    `Available workflow presets: ${Object.values(SMART_WORKFLOW_PRESETS)
      .map((preset) => preset.name)
      .join(', ')}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Prisma seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
