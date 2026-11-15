import { getAuthenticatedUserId, authorizationErrorResponse } from '@/server/auth/route-utils';
import { requireWorkspaceRole } from '@/server/auth/rbac';
import { prisma } from '@/server/db/prisma';
import { syncPullQuerySchema } from '@/server/validators/sync';

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = syncPullQuerySchema.safeParse({
    workspaceId: url.searchParams.get('workspaceId'),
    sinceRevision: url.searchParams.get('sinceRevision') ?? '0',
  });
  if (!parsed.success) {
    return Response.json({ error: 'Invalid workspace or revision query.' }, { status: 400 });
  }

  try {
    await requireWorkspaceRole({
      userId,
      workspaceId: parsed.data.workspaceId,
      minimumRole: 'GUEST',
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response !== null) return response;
    throw error;
  }

  const sinceRevision = BigInt(parsed.data.sinceRevision);
  const workspace = await prisma.workspace.findUnique({
    where: { id: parsed.data.workspaceId },
    select: { serverRevision: true },
  });
  if (workspace === null) {
    return Response.json({ error: 'Workspace was not found.' }, { status: 404 });
  }

  const workspaceId = parsed.data.workspaceId;
  const [pages, blocks, properties, rowProperties, views] = await Promise.all([
    prisma.page.findMany({
      where: {
        workspaceId,
        revision: { gt: sinceRevision },
        OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
      },
      orderBy: { revision: 'asc' },
    }),
    prisma.block.findMany({
      where: {
        page: {
          workspaceId,
          OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
        },
        revision: { gt: sinceRevision },
      },
      orderBy: { revision: 'asc' },
    }),
    prisma.databaseProperty.findMany({
      where: {
        databasePage: {
          workspaceId,
          OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
        },
        revision: { gt: sinceRevision },
      },
      orderBy: { revision: 'asc' },
    }),
    prisma.databaseRowProperty.findMany({
      where: {
        rowPage: {
          workspaceId,
          OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
        },
        property: {
          databasePage: {
            workspaceId,
            OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
          },
        },
        revision: { gt: sinceRevision },
      },
      orderBy: { revision: 'asc' },
    }),
    prisma.databaseView.findMany({
      where: {
        databasePage: {
          workspaceId,
          OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
        },
        revision: { gt: sinceRevision },
      },
      orderBy: { revision: 'asc' },
    }),
  ]);

  return Response.json({
    serverRevision: workspace.serverRevision.toString(10),
    pages: pages.map((page) => ({
      ...page,
      revision: page.revision.toString(10),
      fieldTimestamps: page.fieldTimestamps,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
      deletedAt: page.deletedAt?.toISOString() ?? null,
    })),
    blocks: blocks.map((block) => ({
      ...block,
      revision: block.revision.toString(10),
      fieldTimestamps: block.fieldTimestamps,
      createdAt: block.createdAt.toISOString(),
      updatedAt: block.updatedAt.toISOString(),
      deletedAt: block.deletedAt?.toISOString() ?? null,
    })),
    properties: properties.map((property) => ({
      ...property,
      revision: property.revision.toString(10),
      fieldTimestamps: property.fieldTimestamps,
      createdAt: property.createdAt.toISOString(),
      updatedAt: property.updatedAt.toISOString(),
    })),
    rowProperties: rowProperties.map((property) => ({
      ...property,
      revision: property.revision.toString(10),
      fieldTimestamps: property.fieldTimestamps,
      updatedAt: property.updatedAt.toISOString(),
    })),
    views: views.map((view) => ({
      ...view,
      revision: view.revision.toString(10),
      fieldTimestamps: view.fieldTimestamps,
      createdAt: view.createdAt.toISOString(),
      updatedAt: view.updatedAt.toISOString(),
    })),
  });
}
