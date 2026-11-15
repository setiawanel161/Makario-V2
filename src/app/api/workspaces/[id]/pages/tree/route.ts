import { getAuthenticatedUserId, authorizationErrorResponse } from '@/server/auth/route-utils';
import { requireWorkspaceRole } from '@/server/auth/rbac';
import { prisma } from '@/server/db/prisma';

interface PageTreeItem {
  id: string;
  title: string;
  icon: string | null;
  parentPageId: string | null;
  orderIndex: string;
  isDatabase: boolean;
  isFavorite: boolean;
  isPrivate: boolean;
  revision: string;
  children: PageTreeItem[];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }
  const { id: workspaceId } = await params;

  try {
    await requireWorkspaceRole({ userId, workspaceId, minimumRole: 'GUEST' });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response !== null) {
      return response;
    }
    throw error;
  }

  const pages = await prisma.page.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      OR: [{ isPrivate: false }, { isPrivate: true, createdById: userId }],
    },
    orderBy: [{ parentPageId: 'asc' }, { orderIndex: 'asc' }],
    select: {
      id: true,
      title: true,
      icon: true,
      parentPageId: true,
      orderIndex: true,
      isDatabase: true,
      isFavorite: true,
      isPrivate: true,
      revision: true,
    },
  });

  const nodes = new Map<string, PageTreeItem>();
  for (const page of pages) {
    nodes.set(page.id, {
      ...page,
      revision: page.revision.toString(10),
      children: [],
    });
  }

  const roots: PageTreeItem[] = [];
  for (const page of pages) {
    const node = nodes.get(page.id);
    if (!node) {
      continue;
    }
    const parent = page.parentPageId === null ? undefined : nodes.get(page.parentPageId);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return Response.json({ pages: roots });
}
