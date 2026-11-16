import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { authorizationErrorResponse, getAuthenticatedUserId } from '@/server/auth/route-utils';
import { requireWorkspaceRole } from '@/server/auth/rbac';
import { prisma } from '@/server/db/prisma';

const publishSchema = z.object({
  isPublished: z.boolean(),
  allowTemplateClone: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> },
): Promise<Response> {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }
  const { pageId } = await params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const parsed = publishSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: 'A publish state is required.' }, { status: 400 });
  }

  const page = await prisma.page.findFirst({
    where: { id: pageId, deletedAt: null, isPrivate: false },
    select: {
      id: true,
      workspaceId: true,
      createdById: true,
      isPublished: true,
      publicSlug: true,
      allowTemplateClone: true,
    },
  });
  if (page === null) {
    return Response.json({ error: 'Page was not found or cannot be published.' }, { status: 404 });
  }

  try {
    const membership = await requireWorkspaceRole({
      userId,
      workspaceId: page.workspaceId,
      minimumRole: 'MEMBER',
    });
    if (
      page.createdById !== userId &&
      membership.role !== 'OWNER' &&
      membership.role !== 'ADMIN'
    ) {
      return Response.json({ error: 'Only the page creator or a workspace admin can publish this page.' }, { status: 403 });
    }

    const allowTemplateClone = parsed.data.allowTemplateClone ?? page.allowTemplateClone;
    if (
      page.isPublished === parsed.data.isPublished &&
      page.allowTemplateClone === allowTemplateClone
    ) {
      return Response.json({
        isPublished: page.isPublished,
        publicSlug: page.publicSlug,
        allowTemplateClone: page.allowTemplateClone,
      });
    }

    const publicSlug = parsed.data.isPublished
      ? page.publicSlug ?? crypto.randomUUID().replaceAll('-', '')
      : page.publicSlug;
    const now = new Date();
    const result = await prisma.$transaction(
      async (transaction) => {
        const [current, workspace] = await Promise.all([
          transaction.page.findUnique({
            where: { id: page.id },
            select: {
              revision: true,
              fieldTimestamps: true,
              isPrivate: true,
              isPublished: true,
              allowTemplateClone: true,
            },
          }),
          transaction.workspace.findUnique({
            where: { id: page.workspaceId },
            select: { serverRevision: true },
          }),
        ]);
        if (current === null || workspace === null) {
          throw new Error('The page or workspace no longer exists.');
        }
        if (
          current.isPrivate ||
          current.isPublished !== page.isPublished
        ) {
          throw new Error('Page publication state changed while the request was being processed.');
        }

        const fieldTimestamps =
          typeof current.fieldTimestamps === 'object' &&
          current.fieldTimestamps !== null &&
          !Array.isArray(current.fieldTimestamps)
            ? { ...current.fieldTimestamps }
            : {};
        fieldTimestamps.isPublished = now.toISOString();
        fieldTimestamps.publicSlug = now.toISOString();
        fieldTimestamps.allowTemplateClone = now.toISOString();

        const revision = workspace.serverRevision + BigInt(1);
        const updated = await transaction.page.updateMany({
          where: {
            id: page.id,
            revision: current.revision,
            deletedAt: null,
            isPrivate: false,
            isPublished: page.isPublished,
            allowTemplateClone: page.allowTemplateClone,
          },
          data: {
            isPublished: parsed.data.isPublished,
            publicSlug,
            allowTemplateClone,
            revision,
            fieldTimestamps,
          },
        });
        if (updated.count !== 1) {
          throw new Error('The page changed while publication was being updated.');
        }
        await transaction.workspace.update({
          where: { id: page.workspaceId },
          data: { serverRevision: revision },
        });
        return {
          isPublished: parsed.data.isPublished,
          publicSlug,
          allowTemplateClone,
          revision: revision.toString(10),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return Response.json(result);
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse !== null) return authorizationResponse;
    console.error('Page publication could not be updated.', error);
    return Response.json({ error: 'Page publication could not be updated.' }, { status: 500 });
  }
}
