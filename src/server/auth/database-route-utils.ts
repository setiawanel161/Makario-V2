import { getAuthenticatedUserId, authorizationErrorResponse } from '@/server/auth/route-utils';
import { requireWorkspaceRole } from '@/server/auth/rbac';
import { prisma } from '@/server/db/prisma';

export async function authorizeDatabasePage(
  pageId: string,
): Promise<
  | { userId: string; workspaceId: string; pageId: string; createdById: string; isPrivate: boolean }
  | Response
> {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const page = await prisma.page.findFirst({
    where: { id: pageId, isDatabase: true, deletedAt: null },
    select: { id: true, workspaceId: true, createdById: true, isPrivate: true },
  });
  if (page === null) {
    return Response.json({ error: 'Database page was not found.' }, { status: 404 });
  }

  try {
    const membership = await requireWorkspaceRole({
      userId,
      workspaceId: page.workspaceId,
      minimumRole: 'MEMBER',
    });
    if (
      page.isPrivate &&
      page.createdById !== userId &&
      membership.role !== 'OWNER' &&
      membership.role !== 'ADMIN'
    ) {
      return Response.json({ error: 'Database page was not found.' }, { status: 404 });
    }
    return {
      userId,
      workspaceId: page.workspaceId,
      pageId: page.id,
      createdById: page.createdById,
      isPrivate: page.isPrivate,
    };
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response !== null) return response;
    throw error;
  }
}

export async function parseRequestBody(request: Request): Promise<
  | { ok: true; value: unknown }
  | { ok: false; response: Response }
> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return {
      ok: false,
      response: Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 }),
    };
  }
}

export function databaseErrorResponse(error: unknown): Response | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error.status === 400 || error.status === 404 || error.status === 409) &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}
