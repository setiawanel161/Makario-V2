import type { WorkspaceRole } from '@prisma/client';
import { prisma } from '@/server/db/prisma';

const ROLE_LEVEL: Record<WorkspaceRole, number> = {
  GUEST: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

export class WorkspaceAuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = 'WorkspaceAuthorizationError';
  }
}

export type WorkspaceRoleLookup = (
  workspaceId: string,
  userId: string,
) => Promise<WorkspaceRole | null>;

const prismaRoleLookup: WorkspaceRoleLookup = async (workspaceId, userId) => {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  return membership?.role ?? null;
};

export async function requireWorkspaceRole(
  input: {
    userId: string | null | undefined;
    workspaceId: string;
    minimumRole: WorkspaceRole;
  },
  lookup: WorkspaceRoleLookup = prismaRoleLookup,
): Promise<{ userId: string; workspaceId: string; role: WorkspaceRole }> {
  if (!input.userId) {
    throw new WorkspaceAuthorizationError('Authentication is required.', 401);
  }

  const role = await lookup(input.workspaceId, input.userId);
  if (role === null || ROLE_LEVEL[role] < ROLE_LEVEL[input.minimumRole]) {
    throw new WorkspaceAuthorizationError('Workspace access is not permitted.', 403);
  }

  return { userId: input.userId, workspaceId: input.workspaceId, role };
}
