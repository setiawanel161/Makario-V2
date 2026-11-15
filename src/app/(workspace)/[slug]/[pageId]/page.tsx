import { notFound, redirect } from 'next/navigation';
import { auth } from '@/server/auth/auth';
import { prisma } from '@/server/db/prisma';
import { blockContentPayloadSchema } from '@/lib/editor/block-content-schema';
import { PageEditor } from '@/components/editor/page-editor';
import type { EditorBlock } from '@/components/editor/editor-utils';
import type { EditorPageData } from '@/components/editor/page-editor';

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string; pageId: string }>;
}): Promise<React.JSX.Element> {
  const [{ slug, pageId }, session] = await Promise.all([params, auth()]);
  if (!session?.user?.id) redirect('/login');

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id, workspace: { slug } },
    select: { workspaceId: true },
  });
  if (membership === null) notFound();

  const page = await prisma.page.findFirst({
    where: {
      id: pageId,
      workspaceId: membership.workspaceId,
      deletedAt: null,
      OR: [{ isPrivate: false }, { isPrivate: true, createdById: session.user.id }],
    },
    select: {
      id: true,
      workspaceId: true,
      parentPageId: true,
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
      updatedAt: true,
      blocks: {
        where: { deletedAt: null },
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          type: true,
          content: true,
          parentBlockId: true,
          orderIndex: true,
          revision: true,
        },
      },
    },
  });
  if (page === null) notFound();

  const initialPage: EditorPageData = {
    id: page.id,
    workspaceId: page.workspaceId,
    parentPageId: page.parentPageId,
    title: page.title,
    icon: page.icon,
    coverUrl: page.coverUrl,
    fontFamily: page.fontFamily,
    isFullWidth: page.isFullWidth,
    orderIndex: page.orderIndex,
    isDatabase: page.isDatabase,
    isFavorite: page.isFavorite,
    isPrivate: page.isPrivate,
    isPublished: page.isPublished,
    publicSlug: page.publicSlug,
    revision: page.revision.toString(10),
    updatedAt: page.updatedAt.toISOString(),
  };
  const initialBlocks: EditorBlock[] = page.blocks.map((block) => {
    const content = blockContentPayloadSchema.safeParse(block.content);
    if (!content.success) {
      throw new Error(`Block ${block.id} has invalid stored content.`);
    }
    return {
      id: block.id,
      type: block.type,
      content: content.data,
      parentBlockId: block.parentBlockId,
      orderIndex: block.orderIndex,
      revision: block.revision.toString(10),
    };
  });

  return <PageEditor initialPage={initialPage} initialBlocks={initialBlocks} />;
}
