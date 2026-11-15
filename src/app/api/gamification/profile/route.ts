import { z } from 'zod';
import { getAuthenticatedUserId } from '@/server/auth/route-utils';
import { prisma } from '@/server/db/prisma';

const updateProfileSchema = z.object({
  gamificationEnabled: z.boolean(),
});

export async function GET(): Promise<Response> {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const profile = await prisma.builderProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: { user: { include: { userBadges: { include: { badge: true } } } } },
  });
  return Response.json({
    profile: {
      totalXp: profile.totalXp,
      tier: profile.tier,
      karmaScore: profile.karmaScore,
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      freezeTokens: profile.freezeTokens,
      lastActiveDate: profile.lastActiveDate?.toISOString() ?? null,
      gamificationEnabled: profile.gamificationEnabled,
      badges: profile.user.userBadges.map(({ awardedAt, badge }) => ({
        slug: badge.slug,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        requiredTier: badge.requiredTier,
        awardedAt: awardedAt.toISOString(),
      })),
    },
  });
}

export async function PATCH(request: Request): Promise<Response> {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const parsed = updateProfileSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid profile preferences.' }, { status: 400 });
  }

  const profile = await prisma.builderProfile.upsert({
    where: { userId },
    create: { userId, gamificationEnabled: parsed.data.gamificationEnabled },
    update: { gamificationEnabled: parsed.data.gamificationEnabled },
  });
  return Response.json({
    profile: {
      totalXp: profile.totalXp,
      tier: profile.tier,
      gamificationEnabled: profile.gamificationEnabled,
    },
  });
}
