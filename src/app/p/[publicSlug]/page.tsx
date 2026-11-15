import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DuplicateTemplateButton } from '@/components/public/duplicate-template-button';
import { filterAndSortRows, type DatabaseViewRow } from '@/lib/database/view-utils';
import { toJsonValue } from '@/lib/editor/block-content-schema';
import { getPublicPageData } from '@/server/services/public-page-service';
import { viewFilterRuleSchema, viewSortRuleSchema } from '@/server/validators/database';

type RouteProps = { params: Promise<{ publicSlug: string }> };

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { publicSlug } = await params;
  const data = await getPublicPageData(publicSlug);
  if (data === null) return { title: 'Page not found' };
  const description =
    data.blocks
      .map((block) => plainText(block.content))
      .filter(Boolean)
      .join(' ')
      .slice(0, 160) || `A shared workspace page: ${data.page.title}`;
  return {
    title: data.page.title,
    description,
    openGraph: { title: data.page.title, description, type: 'article' },
  };
}

function plainText(content: unknown): string {
  if (typeof content !== 'object' || content === null || Array.isArray(content)) return '';
  if ('spans' in content && Array.isArray(content.spans)) {
    return content.spans
      .flatMap((span) =>
        typeof span === 'object' &&
        span !== null &&
        !Array.isArray(span) &&
        'text' in span &&
        typeof span.text === 'string'
          ? [span.text]
          : [],
      )
      .join('');
  }
  if ('code' in content && typeof content.code === 'string') return content.code;
  return '';
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return Array.isArray(value) ? value.map(displayValue).join(', ') : JSON.stringify(value);
}

export default async function PublicPage({ params }: RouteProps): Promise<React.JSX.Element> {
  const { publicSlug } = await params;
  const data = await getPublicPageData(publicSlug);
  if (data === null) notFound();

  const database = data.database;
  const activeView = database?.views[0];
  const databaseRows: DatabaseViewRow[] =
    database?.rows.map((row) => ({
      id: row.id,
      title: row.title,
      orderIndex: row.orderIndex,
      properties: Object.fromEntries(
        row.properties.map((property) => [property.propertyId, toJsonValue(property.value)]),
      ),
    })) ?? [];
  const filters =
    activeView?.filters.flatMap((rule) => {
      const parsed = viewFilterRuleSchema.safeParse(rule);
      return parsed.success ? [parsed.data] : [];
    }) ?? [];
  const sorts =
    activeView?.sorts.flatMap((rule) => {
      const parsed = viewSortRuleSchema.safeParse(rule);
      return parsed.success ? [parsed.data] : [];
    }) ?? [];
  const visiblePropertyIds = activeView?.visibleProperties.filter(
    (id): id is string => typeof id === 'string',
  );
  const visibleProperties =
    database?.properties.filter(
      (property) =>
        visiblePropertyIds === undefined ||
        visiblePropertyIds.length === 0 ||
        visiblePropertyIds.includes(property.id),
    ) ?? [];
  const visibleRows = filterAndSortRows(databaseRows, filters, sorts);

  return (
    <main className="min-h-screen bg-[var(--bg-canvas)] px-6 py-12 text-[var(--ink-primary)]">
      {data.page.coverUrl && /^https?:\/\//i.test(data.page.coverUrl) && (
        <div className="relative mx-auto mb-8 h-44 max-w-5xl overflow-hidden rounded-lg">
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="100vw"
            src={data.page.coverUrl}
            unoptimized
          />
        </div>
      )}
      <article className="mx-auto max-w-[960px]">
        <header className="mb-8 border-b border-[var(--border-hairline)] pb-6">
          <h1 className="flex items-center gap-3 text-[length:var(--text-page-title)] font-bold leading-[var(--leading-page-title)] tracking-[var(--tracking-page-title)]">
            {data.page.icon && <span aria-hidden="true">{data.page.icon}</span>}
            {data.page.title}
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-secondary)]">
            Shared by {data.creator.name ?? 'a Makario creator'}
            {data.creator.karmaScore > 0 && ` · ${data.creator.karmaScore} creator karma`}
          </p>
        </header>

        <div className="space-y-4">
          {data.blocks.map((block) => {
            const text = plainText(block.content);
            if (block.type === 'DIVIDER') {
              return <hr className="border-[var(--border-hairline)]" key={block.id} />;
            }
            if (block.type === 'IMAGE') {
              const content =
                typeof block.content === 'object' &&
                block.content !== null &&
                !Array.isArray(block.content)
                  ? block.content
                  : null;
              const url =
                content && 'url' in content && typeof content.url === 'string'
                  ? content.url
                  : '';
              if (!/^https?:\/\//i.test(url)) return null;
              return (
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
                  {content && 'caption' in content && typeof content.caption === 'string' && (
                    <figcaption className="mt-2 text-sm text-[var(--ink-muted)]">
                      {content.caption}
                    </figcaption>
                  )}
                </figure>
              );
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
            const Tag =
              block.type === 'HEADING_1'
                ? 'h2'
                : block.type === 'HEADING_2'
                  ? 'h3'
                  : block.type === 'HEADING_3'
                    ? 'h4'
                    : 'p';
            return (
              <Tag className={className} key={block.id}>
                {block.type === 'TODO' && (
                  <span aria-hidden="true" className="mr-2">
                    {typeof block.content === 'object' &&
                    block.content !== null &&
                    !Array.isArray(block.content) &&
                    'checked' in block.content &&
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

        {database && (
          <section aria-label="Published database" className="mt-12 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-[var(--border-hairline)] text-[var(--ink-secondary)]">
                  <th className="px-3 py-2 font-medium">Name</th>
                  {visibleProperties.map((property) => (
                    <th className="px-3 py-2 font-medium" key={property.id}>
                      {property.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr className="border-b border-[var(--border-hairline)]" key={row.id}>
                    <th className="px-3 py-2 font-medium">{row.title}</th>
                    {visibleProperties.map((property) => (
                      <td className="px-3 py-2" key={property.id}>
                        {displayValue(row.properties[property.id])}
                      </td>
                    ))}
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td
                      className="px-3 py-8 text-center text-[var(--ink-muted)]"
                      colSpan={visibleProperties.length + 1}
                    >
                      No rows are included in this shared view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {data.children.length > 0 && (
          <nav aria-label="Published sub-pages" className="mt-10 border-t border-[var(--border-hairline)] pt-6">
            <h2 className="mb-3 text-sm font-semibold">More shared pages</h2>
            <ul className="space-y-2">
              {data.children.map((child) => (
                <li key={child.id}>
                  <Link
                    className="text-[var(--accent-primary)] hover:underline"
                    href={`/p/${encodeURIComponent(child.publicSlug)}`}
                  >
                    {child.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {data.page.allowTemplateClone && (
          <footer className="mt-12 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-sidebar)] p-6">
            <h2 className="text-lg font-semibold">Make this workspace your own</h2>
            <p className="mb-4 mt-2 text-sm text-[var(--ink-secondary)]">
              Copy the structure into a workspace you can edit.
            </p>
            <DuplicateTemplateButton pageId={data.page.id} />
          </footer>
        )}
      </article>
    </main>
  );
}
