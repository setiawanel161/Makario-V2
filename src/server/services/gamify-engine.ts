import { Prisma, type BuilderTier } from '@prisma/client';
import { prisma } from '../db/prisma';

export const XP_REWARDS = {
  COMPLETE_TODO: 10,
  CREATE_PAGE: 15,
  CREATE_DATABASE: 25,
  PUBLISH_TEMPLATE: 100,
  CREATE_WORKSPACE: 50,
} as const;

export type XpActionType = keyof typeof XP_REWARDS;

const STREAK_FREEZE_ACTION = 'STREAK_FREEZE';

export interface BuilderProfileSnapshot {
  userId: string;
  totalXp: number;
  tier: BuilderTier;
  karmaScore: number;
  currentStreak: number;
  longestStreak: number;
  freezeTokens: number;
  lastActiveDate: Date | null;
  gamificationEnabled: boolean;
}

export interface XpLedgerEntry {
  userId: string;
  workspaceId: string | null;
  actionType: XpActionType | typeof STREAK_FREEZE_ACTION;
  xpDelta: number;
  referenceId: string;
}

export interface StreakUpdate {
  currentStreak: number;
  longestStreak: number;
  freezeTokens: number;
  lastActiveDate: Date;
  freezeConsumed: boolean;
}

export interface GamificationTransaction {
  getProfile(userId: string): Promise<BuilderProfileSnapshot | null>;
  insertXpLedger(entry: XpLedgerEntry): Promise<boolean>;
  addXp(userId: string, xpDelta: number): Promise<BuilderProfileSnapshot>;
  incrementKarma(userId: string, amount: number): Promise<BuilderProfileSnapshot>;
  hasWeeklyFreezeUse(userId: string, weekKey: string): Promise<boolean>;
  claimWeeklyFreeze(userId: string, weekKey: string): Promise<boolean>;
  saveStreak(userId: string, update: StreakUpdate): Promise<BuilderProfileSnapshot>;
}

export interface GamificationDatabase {
  transaction<T>(work: (transaction: GamificationTransaction) => Promise<T>): Promise<T>;
}

function profileSnapshot(profile: {
  userId: string;
  totalXp: number;
  tier: BuilderTier;
  karmaScore: number;
  currentStreak: number;
  longestStreak: number;
  freezeTokens: number;
  lastActiveDate: Date | null;
  gamificationEnabled: boolean;
}): BuilderProfileSnapshot {
  return {
    userId: profile.userId,
    totalXp: profile.totalXp,
    tier: profile.tier,
    karmaScore: profile.karmaScore,
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    freezeTokens: profile.freezeTokens,
    lastActiveDate: profile.lastActiveDate,
    gamificationEnabled: profile.gamificationEnabled,
  };
}

export function calculateBuilderTier(totalXp: number): BuilderTier {
  if (!Number.isInteger(totalXp) || totalXp < 0) {
    throw new RangeError('Total XP must be a non-negative integer.');
  }
  if (totalXp >= 2500) {
    return 'GRANDMASTER_WEAVER';
  }
  if (totalXp >= 500) {
    return 'SYSTEMS_ARCHITECT';
  }
  return 'APPRENTICE_SCRIBE';
}

function utcDay(date: Date): Date {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Activity date must be valid.');
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getUtcWeekKey(date: Date): string {
  const day = utcDay(date);
  const daysSinceMonday = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - daysSinceMonday);
  return day.toISOString().slice(0, 10);
}

export function calculateStreakUpdate(
  profile: Pick<
    BuilderProfileSnapshot,
    'currentStreak' | 'longestStreak' | 'lastActiveDate'
  > | null,
  activityDate: Date,
  freezeUsedThisWeek: boolean,
): StreakUpdate {
  const today = utcDay(activityDate);
  const previousDate = profile?.lastActiveDate ? utcDay(profile.lastActiveDate) : null;
  if (previousDate !== null && today.getTime() < previousDate.getTime()) {
    throw new RangeError('Activity date cannot precede the last recorded activity.');
  }

  const previousStreak = profile?.currentStreak ?? 0;
  const previousLongest = profile?.longestStreak ?? 0;
  const daysSinceActivity =
    previousDate === null
      ? null
      : (today.getTime() - previousDate.getTime()) / 86_400_000;

  let currentStreak = 1;
  let freezeConsumed = false;
  if (daysSinceActivity === 0) {
    currentStreak = previousStreak;
  } else if (daysSinceActivity === 1) {
    currentStreak = previousStreak + 1;
  } else if (daysSinceActivity === 2 && !freezeUsedThisWeek) {
    currentStreak = previousStreak + 1;
    freezeConsumed = true;
  }

  return {
    currentStreak,
    longestStreak: Math.max(previousLongest, currentStreak),
    freezeTokens: freezeUsedThisWeek || freezeConsumed ? 0 : 1,
    lastActiveDate: today,
    freezeConsumed,
  };
}

export function createPrismaGamificationTransaction(
  transaction: Prisma.TransactionClient,
): GamificationTransaction {
  return {
          getProfile: async (userId) => {
            const profile = await transaction.builderProfile.findUnique({ where: { userId } });
            return profile === null ? null : profileSnapshot(profile);
          },
          insertXpLedger: async (entry) => {
            const result = await transaction.xpLedger.createMany({
              data: entry,
              skipDuplicates: true,
            });
            return result.count === 1;
          },
          addXp: async (userId, xpDelta) => {
            const profile = await transaction.builderProfile.upsert({
              where: { userId },
              create: {
                userId,
                totalXp: xpDelta,
                tier: calculateBuilderTier(xpDelta),
              },
              update: { totalXp: { increment: xpDelta } },
            });
            const tier = calculateBuilderTier(profile.totalXp);
            if (tier !== profile.tier) {
              const tierUpdatedProfile = await transaction.builderProfile.update({
                where: { userId },
                data: { tier },
              });
              return profileSnapshot(tierUpdatedProfile);
            }
            return profileSnapshot(profile);
          },
          incrementKarma: async (userId, amount) => {
            const profile = await transaction.builderProfile.upsert({
              where: { userId },
              create: { userId, karmaScore: amount },
              update: { karmaScore: { increment: amount } },
            });
            return profileSnapshot(profile);
          },
          hasWeeklyFreezeUse: async (userId, weekKey) =>
            (await transaction.xpLedger.findUnique({
              where: {
                userId_actionType_referenceId: {
                  userId,
                  actionType: STREAK_FREEZE_ACTION,
                  referenceId: weekKey,
                },
              },
              select: { id: true },
            })) !== null,
          claimWeeklyFreeze: async (userId, weekKey) => {
            const result = await transaction.xpLedger.createMany({
              data: {
                userId,
                workspaceId: null,
                actionType: STREAK_FREEZE_ACTION,
                xpDelta: 0,
                referenceId: weekKey,
              },
              skipDuplicates: true,
            });
            return result.count === 1;
          },
          saveStreak: async (userId, update) => {
            const profile = await transaction.builderProfile.upsert({
              where: { userId },
              create: {
                userId,
                currentStreak: update.currentStreak,
                longestStreak: update.longestStreak,
                freezeTokens: update.freezeTokens,
                lastActiveDate: update.lastActiveDate,
              },
              update: {
                currentStreak: update.currentStreak,
                longestStreak: update.longestStreak,
                freezeTokens: update.freezeTokens,
                lastActiveDate: update.lastActiveDate,
              },
            });
            return profileSnapshot(profile);
          },
  };
}

const prismaGamificationDatabase: GamificationDatabase = {
  transaction: <T>(work: (transaction: GamificationTransaction) => Promise<T>) =>
    prisma.$transaction(
      async (transaction) => work(createPrismaGamificationTransaction(transaction)),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
};

export interface AwardXpInput {
  userId: string;
  workspaceId: string | null;
  actionType: XpActionType;
  referenceId: string;
}

export type AwardXpResult =
  | { status: 'awarded'; xpDelta: number; totalXp: number; tier: BuilderTier }
  | { status: 'duplicate' | 'disabled'; totalXp: number; tier: BuilderTier };

export async function awardXpInTransaction(
  input: AwardXpInput,
  transaction: GamificationTransaction,
): Promise<AwardXpResult> {
  if (input.referenceId.length === 0) {
    throw new RangeError('An idempotency reference is required for XP awards.');
  }

  const profile = await transaction.getProfile(input.userId);
  if (profile?.gamificationEnabled === false) {
    return {
      status: 'disabled',
      totalXp: profile.totalXp,
      tier: profile.tier,
    };
  }

  const xpDelta = XP_REWARDS[input.actionType];
  const inserted = await transaction.insertXpLedger({
    userId: input.userId,
    workspaceId: input.workspaceId,
    actionType: input.actionType,
    xpDelta,
    referenceId: input.referenceId,
  });
  if (!inserted) {
    const currentXp = profile?.totalXp ?? 0;
    return {
      status: 'duplicate',
      totalXp: currentXp,
      tier: profile?.tier ?? calculateBuilderTier(currentXp),
    };
  }

  const updatedProfile = await transaction.addXp(input.userId, xpDelta);
  return {
    status: 'awarded',
    xpDelta,
    totalXp: updatedProfile.totalXp,
    tier: updatedProfile.tier,
  };
}

export async function awardXp(
  input: AwardXpInput,
  database: GamificationDatabase = prismaGamificationDatabase,
): Promise<AwardXpResult> {
  return database.transaction((transaction) => awardXpInTransaction(input, transaction));
}

export async function awardTemplateCreatorKarma(
  creatorUserId: string,
  database: GamificationDatabase = prismaGamificationDatabase,
): Promise<{ karmaScore: number }> {
  return database.transaction(async (transaction) => {
    const profile = await transaction.incrementKarma(creatorUserId, 25);
    return { karmaScore: profile.karmaScore };
  });
}

export async function recordDailyActivity(
  userId: string,
  activityDate = new Date(),
  database: GamificationDatabase = prismaGamificationDatabase,
): Promise<
  | { status: 'updated'; profile: BuilderProfileSnapshot; freezeConsumed: boolean }
  | { status: 'disabled'; profile: BuilderProfileSnapshot }
> {
  const today = utcDay(activityDate);
  const weekKey = getUtcWeekKey(today);

  return database.transaction(async (transaction) => {
    const profile = await transaction.getProfile(userId);
    if (profile?.gamificationEnabled === false) {
      return { status: 'disabled', profile };
    }

    let freezeUsedThisWeek = await transaction.hasWeeklyFreezeUse(userId, weekKey);
    let update = calculateStreakUpdate(profile, today, freezeUsedThisWeek);
    if (update.freezeConsumed) {
      const claimed = await transaction.claimWeeklyFreeze(userId, weekKey);
      if (!claimed) {
        freezeUsedThisWeek = true;
        update = calculateStreakUpdate(profile, today, freezeUsedThisWeek);
      }
    }

    const savedProfile = await transaction.saveStreak(userId, update);
    return {
      status: 'updated',
      profile: savedProfile,
      freezeConsumed: update.freezeConsumed,
    };
  });
}
