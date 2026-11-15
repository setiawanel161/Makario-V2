import { notFound, redirect } from 'next/navigation';
import { auth } from '@/server/auth/auth';
import { prisma } from '@/server/db/prisma';

export default async function WorkspaceHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<React.JSX.Element> {
  const [{ slug }, query, session] = await Promise.all([params, searchParams, auth()]);
  if (!session?.user?.id) {
    redirect('/login');
  }

  const workspace = await prisma.workspace.findFirst({
    where: { slug, members: { some: { userId: session.user.id } } },
    select: { id: true, name: true },
  });
  if (!workspace) {
    notFound();
  }

  const page =
    query.page === undefined
      ? null
      : await prisma.page.findFirst({
          where: {
            id: query.page,
            workspaceId: workspace.id,
            deletedAt: null,
            OR: [{ isPrivate: false }, { isPrivate: true, createdById: session.user.id }],
          },
          select: { id: true, title: true, isDatabase: true, updatedAt: true },
        });
  if (query.page !== undefined && page === null) {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 flex h-11 items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]/90 px-6 backdrop-blur">
        <p className="truncate text-sm text-[var(--ink-secondary)]">{workspace.name}</p>
        <span className="text-xs text-[var(--status-saved)]">Workspace ready</span>
      </header>
      <section className="mx-auto max-w-[720px] px-6 py-12">
        {page ? (
          <>
            <p className="text-xs text-[var(--ink-muted)]">
              {page.isDatabase ? 'Database' : 'Page'} · Updated{' '}
              {page.updatedAt.toLocaleDateString()}
            </p>
            <h1 className="mt-3 text-[length:var(--text-page-title)] font-bold leading-[var(--leading-page-title)] tracking-[var(--tracking-page-title)]">
              {page.title}
            </h1>
            <p className="mt-5 text-sm text-[var(--ink-secondary)]">
              This page is ready for its connected content.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-[var(--accent-primary)]">A good place to start</p>
            <h1 className="mt-3 text-[length:var(--text-page-title)] font-bold leading-[var(--leading-page-title)] tracking-[var(--tracking-page-title)]">
              Welcome to {workspace.name}.
            </h1>
            <p className="mt-4 max-w-xl text-[var(--ink-secondary)]">
              Your starter pages and connected databases are ready in the sidebar. Open one to
              begin shaping your workspace.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
