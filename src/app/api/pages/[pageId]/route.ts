import { getAuthenticatedUserId, authorizationErrorResponse } from '@/server/auth/route-utils';
import { requireWorkspaceRole } from '@/server/auth/rbac';
import { prisma } from '@/server/db/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> },
): Promise<Response> {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }
  const { pageId } = await params;
  const page = await prisma.page.findFirst({
    where: {
      id: pageId,
      deletedAt: null,
      OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
    },
    select: {
      id: true,
      workspaceId: true,
      parentPageId: true,
      createdById: true,
      title: true,
      icon: true,
      coverUrl: true,
      fontFamily: true,
      isFullWidth: true,
      orderIndex: true,
      isDatabase: true,
      isFavorite: true,
      isPrivate: true,
      isPublished: true,
      publicSlug: true,
      revision: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (page === null) {
    return Response.json({ error: 'Page was not found.' }, { status: 404 });
  }

  try {
    await requireWorkspaceRole({
      userId,
      workspaceId: page.workspaceId,
      minimumRole: 'GUEST',
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response !== null) return response;
    throw error;
  }

  const [blocks, properties, views, rows] = await Promise.all([
    prisma.block.findMany({
      where: { pageId, deletedAt: null },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        pageId: true,
        parentBlockId: true,
        type: true,
        content: true,
        orderIndex: true,
        revision: true,
        updatedAt: true,
      },
    }),
    page.isDatabase
      ? prisma.databaseProperty.findMany({
          where: { databasePageId: pageId },
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            databasePageId: true,
            name: true,
            type: true,
            config: true,
            orderIndex: true,
            revision: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
    page.isDatabase
      ? prisma.databaseView.findMany({
          where: { databasePageId: pageId },
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            databasePageId: true,
            name: true,
            layout: true,
            filters: true,
            sorts: true,
            visibleProperties: true,
            groupByPropertyId: true,
            orderIndex: true,
            revision: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
    page.isDatabase
      ? prisma.page.findMany({
          where: {
            workspaceId: page.workspaceId,
            parentPageId: pageId,
            deletedAt: null,
            OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
          },
          orderBy: { orderIndex: 'asc' },
          take: 5000,
          select: {
            id: true,
            workspaceId: true,
            parentPageId: true,
            title: true,
            icon: true,
            orderIndex: true,
            isDatabase: true,
            isFavorite: true,
            isPrivate: true,
            revision: true,
            updatedAt: true,
            rowPropertyValues: {
              orderBy: { updatedAt: 'asc' },
              select: {
                id: true,
                rowPageId: true,
                propertyId: true,
                value: true,
                revision: true,
                updatedAt: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  return Response.json({
    page: {
      ...page,
      revision: page.revision.toString(10),
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
    },
    blocks: blocks.map((block) => ({
      ...block,
      revision: block.revision.toString(10),
      updatedAt: block.updatedAt.toISOString(),
    })),
    database: page.isDatabase
      ? {
          properties: properties.map((property) => ({
            ...property,
            revision: property.revision.toString(10),
            updatedAt: property.updatedAt.toISOString(),
          })),
          views: views.map((view) => ({
            ...view,
            revision: view.revision.toString(10),
            updatedAt: view.updatedAt.toISOString(),
          })),
          rows: rows.map((row) => ({
            ...row,
            revision: row.revision.toString(10),
            updatedAt: row.updatedAt.toISOString(),
            properties: row.rowPropertyValues.map((value) => ({
              ...value,
              revision: value.revision.toString(10),
              updatedAt: value.updatedAt.toISOString(),
            })),
          })),
        }
      : null,
  });
}
