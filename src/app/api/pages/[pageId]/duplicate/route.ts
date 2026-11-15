import { z } from 'zod';
import { getAuthenticatedUserId, authorizationErrorResponse } from '@/server/auth/route-utils';
import { requireWorkspaceRole } from '@/server/auth/rbac';
import { prisma } from '@/server/db/prisma';
import { cloneTemplateTree, TemplateCloneError } from '@/server/services/template-cloner';

const duplicateSchema = z.object({
  workspaceId: z.string().min(1).max(100),
  parentPageId: z.string().min(1).max(100).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> },
): Promise<Response> {
  const { pageId } = await params;
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
  const parsed = duplicateSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: 'A destination workspace is required.', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const source = await prisma.page.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      workspaceId: true,
      createdById: true,
      isPrivate: true,
      isPublished: true,
      allowTemplateClone: true,
      deletedAt: true,
    },
  });
  if (source === null || source.deletedAt !== null) {
    return Response.json({ error: 'Template page was not found.' }, { status: 404 });
  }

  const publicTemplate =
    source.isPublished && source.allowTemplateClone && !source.isPrivate;
  if (!publicTemplate) {
    try {
      const membership = await requireWorkspaceRole({
        userId,
        workspaceId: source.workspaceId,
        minimumRole: 'MEMBER',
      });
      if (
        source.isPrivate &&
        source.createdById !== userId &&
        membership.role !== 'OWNER' &&
        membership.role !== 'ADMIN'
      ) {
        return Response.json({ error: 'Template page was not found.' }, { status: 404 });
      }
    } catch (error) {
      const response = authorizationErrorResponse(error);
      if (response !== null) return response;
      throw error;
    }
  }

  try {
    await requireWorkspaceRole({
      userId,
      workspaceId: parsed.data.workspaceId,
      minimumRole: 'MEMBER',
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response !== null) return response;
    throw error;
  }

  if (parsed.data.parentPageId) {
    const parent = await prisma.page.findFirst({
      where: {
        id: parsed.data.parentPageId,
        workspaceId: parsed.data.workspaceId,
        deletedAt: null,
        OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
      },
      select: { id: true },
    });
    if (parent === null) {
      return Response.json({ error: 'Destination parent page was not found.' }, { status: 404 });
    }
  }

  try {
    const clone = await cloneTemplateTree({
      sourcePageId: pageId,
      targetWorkspaceId: parsed.data.workspaceId,
      targetParentPageId: parsed.data.parentPageId,
      userId,
      awardCreatorKarma: publicTemplate,
    });
    return Response.json(clone, { status: 201 });
  } catch (error) {
    if (error instanceof TemplateCloneError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('Template could not be duplicated.', error);
    return Response.json({ error: 'Template could not be duplicated.' }, { status: 500 });
  }
}
