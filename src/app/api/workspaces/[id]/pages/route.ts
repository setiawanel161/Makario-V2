import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { generateKeyBetween } from '@/lib/fractional-index';
import { getAuthenticatedUserId, authorizationErrorResponse } from '@/server/auth/route-utils';
import { requireWorkspaceRole } from '@/server/auth/rbac';
import { prisma } from '@/server/db/prisma';

const createPageSchema = z.object({
  title: z.string().trim().min(1).max(200).default('Untitled'),
  parentPageId: z.string().min(1).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }
  const { id: workspaceId } = await params;
  try {
    await requireWorkspaceRole({ userId, workspaceId, minimumRole: 'MEMBER' });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response !== null) {
      return response;
    }
    throw error;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const parsed = createPageSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid page details.' }, { status: 400 });
  }

  const parentPageId = parsed.data.parentPageId ?? null;
  if (parentPageId !== null) {
    const parent = await prisma.page.findFirst({
      where: {
        id: parentPageId,
        workspaceId,
        deletedAt: null,
        OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
      },
      select: { id: true },
    });
    if (parent === null) {
      return Response.json({ error: 'Parent page was not found.' }, { status: 404 });
    }
  }

  try {
    const page = await prisma.$transaction(
      async (transaction) => {
        const [workspace, sibling] = await Promise.all([
          transaction.workspace.findUnique({
            where: { id: workspaceId },
            select: { serverRevision: true },
          }),
          transaction.page.findFirst({
            where: { workspaceId, parentPageId, deletedAt: null },
            orderBy: { orderIndex: 'desc' },
            select: { orderIndex: true },
          }),
        ]);
        if (workspace === null) return null;
        const orderIndex = generateKeyBetween(sibling?.orderIndex ?? null, null);
        const revision = workspace.serverRevision + BigInt(1);
        const now = new Date().toISOString();
        const createdPage = await transaction.page.create({
          data: {
            workspaceId,
            createdById: userId,
            parentPageId,
            title: parsed.data.title,
            orderIndex,
            revision,
            fieldTimestamps: {
              title: now,
              parentPageId: now,
              orderIndex: now,
            },
          },
          select: {
            id: true,
            workspaceId: true,
            parentPageId: true,
            title: true,
            orderIndex: true,
            isDatabase: true,
            isFavorite: true,
            isPrivate: true,
            revision: true,
            updatedAt: true,
          },
        });
        await transaction.workspace.update({
          where: { id: workspaceId },
          data: { serverRevision: revision },
        });
        return createdPage;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (page === null) {
      return Response.json({ error: 'Workspace was not found.' }, { status: 404 });
    }

    return Response.json(
      {
        page: {
          ...page,
          revision: page.revision.toString(10),
          updatedAt: page.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Workspace page could not be created.', error);
    return Response.json({ error: 'Workspace page could not be created.' }, { status: 500 });
  }
}
