import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db/prisma', () => ({
  prisma: {
    page: { findFirst: vi.fn(), findMany: vi.fn() },
    databaseProperty: { findMany: vi.fn() },
    databaseView: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/server/db/prisma';
import { getPublicPageData } from '@/server/services/public-page-service';

describe('public page data isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not return unpublished or private pages', async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce(null);

    expect(await getPublicPageData('unavailable')).toBeNull();
    expect(prisma.page.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          publicSlug: 'unavailable',
          isPublished: true,
          isPrivate: false,
          deletedAt: null,
        },
      }),
    );
    expect(prisma.page.findMany).not.toHaveBeenCalled();
  });

  it('limits shared child pages to the public page workspace and excludes private rows', async () => {
    vi.mocked(prisma.page.findFirst).mockResolvedValueOnce({
      id: 'public-page',
      workspaceId: 'public-workspace',
      title: 'Published',
      icon: null,
      coverUrl: null,
      fontFamily: 'sans',
      isFullWidth: false,
      isDatabase: false,
      publicSlug: 'published',
      allowTemplateClone: false,
      revision: BigInt(12),
      createdBy: { name: 'Creator', builderProfile: { karmaScore: 3 } },
      blocks: [],
    } as never);
    vi.mocked(prisma.page.findMany).mockResolvedValue([]);

    const result = await getPublicPageData('published');

    expect(result?.page.revision).toBe('12');
    expect(result).not.toHaveProperty('comments');
    expect(prisma.page.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'public-workspace',
          parentPageId: { in: ['public-page'] },
          isPublished: true,
          isPrivate: false,
          deletedAt: null,
        }),
      }),
    );
  });
});
