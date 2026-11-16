import { notFound, redirect } from 'next/navigation';
import { auth } from '@/server/auth/auth';
import { prisma } from '@/server/db/prisma';
import { blockContentPayloadSchema } from '@/lib/editor/block-content-schema';
import { toJsonValue } from '@/lib/editor/block-content-schema';
import { PageEditor } from '@/components/editor/page-editor';
import type { EditorBlock } from '@/components/editor/editor-utils';
import type { EditorPageData } from '@/components/editor/page-editor';
import type { DatabaseData } from '@/components/database/database-types';
import {
  propertyConfigSchema,
  viewFilterRuleSchema,
  viewSortRuleSchema,
} from '@/server/validators/database';

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
      allowTemplateClone: true,
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
    allowTemplateClone: page.allowTemplateClone,
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

  let initialDatabaseData: DatabaseData | null = null;
  if (page.isDatabase) {
    const [properties, views, rows] = await Promise.all([
      prisma.databaseProperty.findMany({
        where: { databasePageId: page.id },
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          name: true,
          type: true,
          config: true,
          orderIndex: true,
          revision: true,
        },
      }),
      prisma.databaseView.findMany({
        where: { databasePageId: page.id },
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          name: true,
          layout: true,
          filters: true,
          sorts: true,
          visibleProperties: true,
          groupByPropertyId: true,
          orderIndex: true,
          revision: true,
        },
      }),
      prisma.page.findMany({
        where: {
          workspaceId: page.workspaceId,
          parentPageId: page.id,
          deletedAt: null,
          OR: [{ isPrivate: false }, { isPrivate: true, createdById: session.user.id }],
        },
        orderBy: { orderIndex: 'asc' },
        take: 5000,
        select: {
          id: true,
          title: true,
          icon: true,
          coverUrl: true,
          orderIndex: true,
          revision: true,
          rowPropertyValues: {
            select: { id: true, propertyId: true, value: true },
          },
        },
      }),
    ]);

    initialDatabaseData = {
      properties: properties.map((property) => ({
        ...property,
        config: propertyConfigSchema.parse(property.config),
        revision: property.revision.toString(10),
      })),
      views: views.map((view) => ({
        ...view,
        filters: viewFilterRuleSchema.array().parse(view.filters),
        sorts: viewSortRuleSchema.array().parse(view.sorts),
        visibleProperties: Array.isArray(view.visibleProperties)
          ? view.visibleProperties.filter((value): value is string => typeof value === 'string')
          : [],
        revision: view.revision.toString(10),
      })),
      rows: rows.map((row) => ({
        ...row,
        revision: row.revision.toString(10),
        properties: Object.fromEntries(
          row.rowPropertyValues.map((value) => [value.propertyId, toJsonValue(value.value)]),
        ),
        propertyValueIds: Object.fromEntries(
          row.rowPropertyValues.map((value) => [value.propertyId, value.id]),
        ),
      })),
    };
  }

  return (
    <PageEditor
      initialDatabaseData={initialDatabaseData}
      initialPage={initialPage}
      initialBlocks={initialBlocks}
    />
  );
}
