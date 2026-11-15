import { Prisma } from '@prisma/client';
import { getAuthenticatedUserId, authorizationErrorResponse } from '@/server/auth/route-utils';
import { requireWorkspaceRole } from '@/server/auth/rbac';
import { prisma } from '@/server/db/prisma';
import { workspaceSearchQuerySchema } from '@/server/validators/sync';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }
  const { id: workspaceId } = await params;
  const parsed = workspaceSearchQuerySchema.safeParse({
    q: new URL(request.url).searchParams.get('q'),
  });
  if (!parsed.success) {
    return Response.json({ error: 'Search query must contain 1–100 characters.' }, { status: 400 });
  }

  try {
    await requireWorkspaceRole({ userId, workspaceId, minimumRole: 'GUEST' });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response !== null) return response;
    throw error;
  }

  const query = parsed.data.q;
  const escapedQuery = query.replace(/[\\%_]/g, '\\$&');
  const pattern = `%${escapedQuery}%`;
  const [pages, blocks] = await Promise.all([
    prisma.page.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
        title: { contains: query, mode: 'insensitive' },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        icon: true,
        isDatabase: true,
        revision: true,
        updatedAt: true,
      },
    }),
    prisma.$queryRaw<
      Array<{
        id: string;
        pageId: string;
        pageTitle: string;
        content: Prisma.JsonValue;
        revision: bigint;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      SELECT b."id", b."pageId", p."title" AS "pageTitle", b."content",
             b."revision", b."updatedAt"
      FROM "Block" b
      INNER JOIN "Page" p ON p."id" = b."pageId"
      WHERE p."workspaceId" = ${workspaceId}
        AND p."deletedAt" IS NULL
        AND b."deletedAt" IS NULL
        AND (p."isPrivate" = false OR p."createdById" = ${userId})
        AND b."content"::text ILIKE ${pattern} ESCAPE '\\'
      ORDER BY b."updatedAt" DESC
      LIMIT 20
    `),
  ]);

  return Response.json({
    results: [
      ...pages.map((page) => ({
        type: 'page' as const,
        id: page.id,
        title: page.title,
        icon: page.icon,
        isDatabase: page.isDatabase,
        revision: page.revision.toString(10),
        updatedAt: page.updatedAt.toISOString(),
      })),
      ...blocks.map((block) => ({
        type: 'block' as const,
        id: block.id,
        pageId: block.pageId,
        title: block.pageTitle,
        snippet: JSON.stringify(block.content).slice(0, 180),
        revision: block.revision.toString(10),
        updatedAt: block.updatedAt.toISOString(),
      })),
    ],
  });
}
