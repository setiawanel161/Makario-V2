import { prisma } from '@/server/db/prisma';
import { z } from 'zod';
import { propertyConfigSchema, viewFilterRuleSchema, viewSortRuleSchema } from '@/server/validators/database';

export async function getPublicPageData(publicSlug: string) {
  const page = await prisma.page.findFirst({
    where: {
      publicSlug,
      isPublished: true,
      isPrivate: false,
      deletedAt: null,
    },
    select: {
      id: true,
      workspaceId: true,
      title: true,
      icon: true,
      coverUrl: true,
      fontFamily: true,
      isFullWidth: true,
      isDatabase: true,
      publicSlug: true,
      allowTemplateClone: true,
      revision: true,
      createdBy: {
        select: {
          name: true,
          builderProfile: { select: { karmaScore: true } },
        },
      },
      blocks: {
        where: { deletedAt: null },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, type: true, content: true, orderIndex: true, revision: true },
      },
    },
  });
  if (page === null) return null;

  const [properties, views, rows] = page.isDatabase
    ? await Promise.all([
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
            isDatabase: false,
            isPrivate: false,
            deletedAt: null,
          },
          orderBy: { orderIndex: 'asc' },
          take: 5000,
          select: {
            id: true,
            title: true,
            icon: true,
            orderIndex: true,
            revision: true,
            rowPropertyValues: {
              orderBy: { updatedAt: 'asc' },
              select: {
                id: true,
                propertyId: true,
                value: true,
                revision: true,
                updatedAt: true,
              },
            },
          },
        }),
      ])
    : [[], [], []];

  const children: Array<{ id: string; title: string; publicSlug: string }> = [];
  let parentIds = [page.id];
  const seen = new Set(parentIds);
  for (let depth = 0; depth < 10 && parentIds.length > 0; depth += 1) {
    const level = await prisma.page.findMany({
      where: {
      workspaceId: page.workspaceId,
        parentPageId: { in: parentIds },
        isPublished: true,
        isPrivate: false,
        deletedAt: null,
        publicSlug: { not: null },
      },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, title: true, publicSlug: true },
    });
    const freshPages = level.filter((child) => !seen.has(child.id));
    for (const child of freshPages) {
      seen.add(child.id);
      if (child.publicSlug !== null) {
        children.push({ id: child.id, title: child.title, publicSlug: child.publicSlug });
      }
    }
    parentIds = freshPages.map((child) => child.id);
  }

  return {
    page: {
      id: page.id,
      title: page.title,
      icon: page.icon,
      coverUrl: page.coverUrl,
      fontFamily: page.fontFamily,
      isFullWidth: page.isFullWidth,
      isDatabase: page.isDatabase,
      publicSlug: page.publicSlug,
      allowTemplateClone: page.allowTemplateClone,
      revision: page.revision.toString(10),
    },
    creator: {
      name: page.createdBy.name,
      karmaScore: page.createdBy.builderProfile?.karmaScore ?? 0,
    },
    blocks: page.blocks.map((block) => ({
      ...block,
      revision: block.revision.toString(10),
    })),
    database: page.isDatabase
      ? {
          properties: properties.map((property) => ({
            ...property,
            config: propertyConfigSchema.parse(property.config),
            revision: property.revision.toString(10),
          })),
          views: views.map((view) => ({
            ...view,
            filters: viewFilterRuleSchema.array().parse(view.filters),
            sorts: viewSortRuleSchema.array().parse(view.sorts),
            visibleProperties: z.string().array().parse(view.visibleProperties),
            revision: view.revision.toString(10),
          })),
          rows: rows.map((row) => ({
            ...row,
            revision: row.revision.toString(10),
            properties: row.rowPropertyValues.map((value) => ({
              ...value,
              revision: value.revision.toString(10),
              updatedAt: value.updatedAt.toISOString(),
            })),
          })),
        }
      : null,
    children,
  };
}
