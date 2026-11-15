import { describe, expect, it } from 'vitest';
import type { WorkspaceRole } from '@prisma/client';
import {
  requireWorkspaceRole,
  type WorkspaceRoleLookup,
} from '../src/server/auth/rbac';

describe('workspace RBAC', () => {
  it('requires an authenticated user and returns 401 when absent', async () => {
    await expect(
      requireWorkspaceRole({ userId: null, workspaceId: 'ws-1', minimumRole: 'GUEST' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('checks membership and enforces the full role hierarchy', async () => {
    const memberships = new Map<string, WorkspaceRole>([
      ['ws-1:user-owner', 'OWNER'],
      ['ws-1:user-admin', 'ADMIN'],
      ['ws-1:user-member', 'MEMBER'],
      ['ws-1:user-guest', 'GUEST'],
    ] as const);
    const lookup: WorkspaceRoleLookup = async (workspaceId, userId) =>
      memberships.get(`${workspaceId}:${userId}`) ?? null;

    await expect(
      requireWorkspaceRole(
        { userId: 'user-admin', workspaceId: 'ws-1', minimumRole: 'MEMBER' },
        lookup,
      ),
    ).resolves.toMatchObject({ role: 'ADMIN' });
    await expect(
      requireWorkspaceRole(
        { userId: 'user-member', workspaceId: 'ws-1', minimumRole: 'ADMIN' },
        lookup,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      requireWorkspaceRole(
        { userId: 'user-owner', workspaceId: 'ws-1', minimumRole: 'OWNER' },
        lookup,
      ),
    ).resolves.toMatchObject({ role: 'OWNER' });
  });

  it('does not disclose or grant access to another tenant', async () => {
    const lookup: WorkspaceRoleLookup = async (workspaceId, userId) =>
      workspaceId === 'ws-owned' && userId === 'user-1' ? 'MEMBER' : null;

    await expect(
      requireWorkspaceRole(
        { userId: 'user-1', workspaceId: 'ws-other', minimumRole: 'GUEST' },
        lookup,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
