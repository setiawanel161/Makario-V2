import { notFound } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import Image from 'next/image';
import { prisma } from '@/server/db/prisma';

function blockText(content: Prisma.JsonValue): string {
  if (typeof content !== 'object' || content === null || Array.isArray(content)) return '';
  if (Array.isArray(content.spans)) {
    return content.spans
      .flatMap((span) =>
        typeof span === 'object' && span !== null && !Array.isArray(span) &&
        typeof span.text === 'string'
          ? [span.text]
          : [],
      )
      .join('');
  }
  if (typeof content.code === 'string') return content.code;
  return '';
}

export default async function PublicPage({
  params,
}: {
  params: Promise<{ publicSlug: string }>;
}): Promise<React.JSX.Element> {
  const { publicSlug } = await params;
  const page = await prisma.page.findFirst({
    where: {
      publicSlug,
      isPublished: true,
      isPrivate: false,
      deletedAt: null,
    },
    select: {
      title: true,
      icon: true,
      blocks: {
        where: { deletedAt: null },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, type: true, content: true },
      },
    },
  });
  if (page === null) notFound();

  return (
    <main className="min-h-screen bg-[var(--bg-canvas)] px-6 py-16 text-[var(--ink-primary)]">
      <article className="mx-auto max-w-[720px]">
        <h1 className="mb-10 flex items-center gap-3 text-[length:var(--text-page-title)] font-bold leading-[var(--leading-page-title)] tracking-[var(--tracking-page-title)]">
          {page.icon && <span aria-hidden="true">{page.icon}</span>}
          {page.title}
        </h1>
        <div className="space-y-3">
          {page.blocks.map((block) => {
            const text = blockText(block.content);
            if (block.type === 'DIVIDER') {
              return <hr key={block.id} className="border-[var(--border-hairline)]" />;
            }
            if (block.type === 'IMAGE') {
              const url =
                typeof block.content === 'object' &&
                block.content !== null &&
                !Array.isArray(block.content) &&
                typeof block.content.url === 'string' &&
                /^https?:\/\//i.test(block.content.url)
                  ? block.content.url
                  : null;
              return url ? (
                <figure key={block.id}>
                  <Image
                    alt=""
                    className="max-h-[70vh] w-full rounded-lg object-contain"
                    height={900}
                    sizes="100vw"
                    src={url}
                    unoptimized
                    width={1200}
                  />
                  {typeof block.content === 'object' &&
                    block.content !== null &&
                    !Array.isArray(block.content) &&
                    typeof block.content.caption === 'string' && (
                      <figcaption className="mt-2 text-sm text-[var(--ink-muted)]">
                        {block.content.caption}
                      </figcaption>
                    )}
                </figure>
              ) : null;
            }
            const className =
              block.type === 'HEADING_1'
                ? 'text-3xl font-semibold'
                : block.type === 'HEADING_2'
                  ? 'text-2xl font-semibold'
                  : block.type === 'HEADING_3'
                    ? 'text-xl font-semibold'
                    : block.type === 'CODE'
                      ? 'overflow-x-auto rounded-md bg-[var(--bg-sidebar)] p-3 font-mono text-sm'
                      : 'whitespace-pre-wrap';
            const Tag = block.type === 'HEADING_1' ? 'h2' : block.type === 'HEADING_2' ? 'h3' : block.type === 'HEADING_3' ? 'h4' : 'p';
            return (
              <Tag key={block.id} className={className}>
                {block.type === 'TODO' && (
                  <span aria-hidden="true" className="mr-2">
                    {typeof block.content === 'object' &&
                    block.content !== null &&
                    !Array.isArray(block.content) &&
                    block.content.checked === true
                      ? '☑'
                      : '☐'}
                  </span>
                )}
                {text}
              </Tag>
            );
          })}
        </div>
      </article>
    </main>
  );
}
