import { z } from 'zod';
import { getAuthenticatedUserId } from '@/server/auth/route-utils';
import { prisma } from '@/server/db/prisma';
import { createWorkspaceWithPreset } from '@/server/services/workspace-service';

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  presetKey: z.enum(['PERSONAL', 'TEAM', 'SCHOOL']),
});

export async function GET(): Promise<Response> {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
    select: {
      role: true,
      joinedAt: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          serverRevision: true,
          createdAt: true,
        },
      },
    },
  });

  return Response.json({
    workspaces: memberships.map(({ role, joinedAt, workspace }) => ({
      ...workspace,
      serverRevision: workspace.serverRevision.toString(10),
      createdAt: workspace.createdAt.toISOString(),
      role,
      joinedAt: joinedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request): Promise<Response> {
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
  const parsed = createWorkspaceSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid workspace details.', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await createWorkspaceWithPreset({
      ownerId: userId,
      ...parsed.data,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error('Workspace provisioning failed.', error);
    return Response.json({ error: 'Unable to create the workspace.' }, { status: 500 });
  }
}
