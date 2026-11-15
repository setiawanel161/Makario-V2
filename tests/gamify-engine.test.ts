import { describe, expect, it } from 'vitest';
import {
  awardTemplateCreatorKarma,
  awardXp,
  calculateBuilderTier,
  calculateStreakUpdate,
  getUtcWeekKey,
  recordDailyActivity,
  type BuilderProfileSnapshot,
  type GamificationDatabase,
  type GamificationTransaction,
  type StreakUpdate,
  type XpLedgerEntry,
} from '../src/server/services/gamify-engine';

function makeProfile(userId: string): BuilderProfileSnapshot {
  return {
    userId,
    totalXp: 0,
    tier: 'APPRENTICE_SCRIBE',
    karmaScore: 0,
    currentStreak: 0,
    longestStreak: 0,
    freezeTokens: 1,
    lastActiveDate: null,
    gamificationEnabled: true,
  };
}

class FakeGamificationDatabase implements GamificationDatabase {
  readonly profiles = new Map<string, BuilderProfileSnapshot>();
  readonly ledger = new Map<string, XpLedgerEntry>();

  async transaction<T>(work: (transaction: GamificationTransaction) => Promise<T>): Promise<T> {
    const transaction: GamificationTransaction = {
      getProfile: async (userId) => this.profiles.get(userId) ?? null,
      insertXpLedger: async (entry) => {
        const key = `${entry.userId}:${entry.actionType}:${entry.referenceId}`;
        if (this.ledger.has(key)) {
          return false;
        }
        this.ledger.set(key, entry);
        return true;
      },
      addXp: async (userId, xpDelta) => {
        const existing = this.profiles.get(userId) ?? makeProfile(userId);
        const totalXp = existing.totalXp + xpDelta;
        const updated = { ...existing, totalXp, tier: calculateBuilderTier(totalXp) };
        this.profiles.set(userId, updated);
        return updated;
      },
      incrementKarma: async (userId, amount) => {
        const existing = this.profiles.get(userId) ?? makeProfile(userId);
        const updated = { ...existing, karmaScore: existing.karmaScore + amount };
        this.profiles.set(userId, updated);
        return updated;
      },
      hasWeeklyFreezeUse: async (userId, weekKey) =>
        this.ledger.has(`${userId}:STREAK_FREEZE:${weekKey}`),
      claimWeeklyFreeze: async (userId, weekKey) => {
        const key = `${userId}:STREAK_FREEZE:${weekKey}`;
        if (this.ledger.has(key)) {
          return false;
        }
        this.ledger.set(key, {
          userId,
          workspaceId: null,
          actionType: 'STREAK_FREEZE',
          xpDelta: 0,
          referenceId: weekKey,
        });
        return true;
      },
      saveStreak: async (userId, update: StreakUpdate) => {
        const existing = this.profiles.get(userId) ?? makeProfile(userId);
        const saved = { ...existing, ...update };
        this.profiles.set(userId, saved);
        return saved;
      },
    };
    return work(transaction);
  }
}

describe('gamification engine', () => {
  it('assigns the correct BuilderTier at each XP threshold', () => {
    expect(calculateBuilderTier(0)).toBe('APPRENTICE_SCRIBE');
    expect(calculateBuilderTier(499)).toBe('APPRENTICE_SCRIBE');
    expect(calculateBuilderTier(500)).toBe('SYSTEMS_ARCHITECT');
    expect(calculateBuilderTier(2499)).toBe('SYSTEMS_ARCHITECT');
    expect(calculateBuilderTier(2500)).toBe('GRANDMASTER_WEAVER');
    expect(() => calculateBuilderTier(-1)).toThrow(RangeError);
  });

  it('awards each supported XP amount once and updates the tier', async () => {
    const database = new FakeGamificationDatabase();
    database.profiles.set('user-1', {
      ...makeProfile('user-1'),
      totalXp: 490,
    });

    const input = {
      userId: 'user-1',
      workspaceId: 'workspace-1',
      actionType: 'COMPLETE_TODO' as const,
      referenceId: 'block-1',
    };
    const first = await awardXp(input, database);
    const retry = await awardXp(input, database);

    expect(first).toEqual({
      status: 'awarded',
      xpDelta: 10,
      totalXp: 500,
      tier: 'SYSTEMS_ARCHITECT',
    });
    expect(retry).toEqual({
      status: 'duplicate',
      totalXp: 500,
      tier: 'SYSTEMS_ARCHITECT',
    });
    expect(database.ledger.size).toBe(1);
  });

  it('uses the specified XP reward for each action type', async () => {
    const database = new FakeGamificationDatabase();
    const actions = [
      ['COMPLETE_TODO', 10],
      ['CREATE_PAGE', 15],
      ['CREATE_DATABASE', 25],
      ['PUBLISH_TEMPLATE', 100],
      ['CREATE_WORKSPACE', 50],
    ] as const;

    for (const [actionType, xpDelta] of actions) {
      await expect(
        awardXp(
          {
            userId: 'user-2',
            workspaceId: null,
            actionType,
            referenceId: actionType,
          },
          database,
        ),
      ).resolves.toMatchObject({ status: 'awarded', xpDelta });
    }

    expect(database.profiles.get('user-2')?.totalXp).toBe(200);
  });

  it('does not award XP when gamification is disabled', async () => {
    const database = new FakeGamificationDatabase();
    database.profiles.set('user-1', {
      ...makeProfile('user-1'),
      gamificationEnabled: false,
    });

    await expect(
      awardXp(
        {
          userId: 'user-1',
          workspaceId: null,
          actionType: 'CREATE_PAGE',
          referenceId: 'page-1',
        },
        database,
      ),
    ).resolves.toMatchObject({ status: 'disabled', totalXp: 0 });
    expect(database.ledger.size).toBe(0);
  });

  it('increments the template creator karma score by 25', async () => {
    const database = new FakeGamificationDatabase();

    await expect(awardTemplateCreatorKarma('creator-1', database)).resolves.toEqual({
      karmaScore: 25,
    });
    await expect(awardTemplateCreatorKarma('creator-1', database)).resolves.toEqual({
      karmaScore: 50,
    });
  });

  it('preserves a streak with one freeze token and only permits one use per UTC week', async () => {
    const database = new FakeGamificationDatabase();
    const monday = new Date('2026-01-05T15:00:00.000Z');
    const tuesday = new Date('2026-01-06T15:00:00.000Z');
    const thursday = new Date('2026-01-08T15:00:00.000Z');
    const saturday = new Date('2026-01-10T15:00:00.000Z');

    await recordDailyActivity('user-1', monday, database);
    await recordDailyActivity('user-1', tuesday, database);
    const protectedDay = await recordDailyActivity('user-1', thursday, database);
    const secondGap = await recordDailyActivity('user-1', saturday, database);

    expect(protectedDay).toMatchObject({
      status: 'updated',
      freezeConsumed: true,
      profile: { currentStreak: 3, freezeTokens: 0 },
    });
    expect(secondGap).toMatchObject({
      status: 'updated',
      freezeConsumed: false,
      profile: { currentStreak: 1, freezeTokens: 0 },
    });
    expect(database.ledger.size).toBe(1);
  });

  it('replenishes the weekly freeze on a new UTC week and normalizes dates', async () => {
    const database = new FakeGamificationDatabase();
    const monday = new Date('2026-01-05T23:30:00.000Z');
    const wednesday = new Date('2026-01-07T23:30:00.000Z');
    const nextMonday = new Date('2026-01-12T00:30:00.000Z');

    await recordDailyActivity('user-1', monday, database);
    const frozen = await recordDailyActivity('user-1', wednesday, database);
    const nextWeek = await recordDailyActivity('user-1', nextMonday, database);

    expect(frozen).toMatchObject({ freezeConsumed: true, profile: { freezeTokens: 0 } });
    expect(nextWeek).toMatchObject({
      freezeConsumed: false,
      profile: { currentStreak: 1, freezeTokens: 1 },
    });
    expect(getUtcWeekKey(new Date('2026-01-11T23:59:00.000Z'))).toBe('2026-01-05');
    expect(getUtcWeekKey(nextMonday)).toBe('2026-01-12');
  });

  it('rejects activity dates earlier than the current streak date', () => {
    const previous = {
      currentStreak: 4,
      longestStreak: 4,
      lastActiveDate: new Date('2026-01-10T00:00:00.000Z'),
    };
    expect(() =>
      calculateStreakUpdate(previous, new Date('2026-01-09T23:59:00.000Z'), false),
    ).toThrow(RangeError);
  });
});
