import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth/auth';
import { prisma } from '@/server/db/prisma';
import { WorkspaceSidebar } from '@/components/workspaces/workspace-sidebar';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id, workspace: { slug } },
    select: { workspace: { select: { id: true, name: true, slug: true } } },
  });
  if (!membership) {
    const firstWorkspace = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
      orderBy: { joinedAt: 'asc' },
      select: { workspace: { select: { slug: true } } },
    });
    redirect(firstWorkspace ? `/${firstWorkspace.workspace.slug}` : '/onboarding');
  }

  const [memberships, profile] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      orderBy: { joinedAt: 'asc' },
      select: { workspace: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.builderProfile.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id },
      update: {},
      select: {
        totalXp: true,
        tier: true,
        currentStreak: true,
        gamificationEnabled: true,
      },
    }),
  ]);

  return (
    <div className="flex min-h-screen bg-[var(--bg-canvas)]">
      <WorkspaceSidebar
        workspace={membership.workspace}
        workspaces={memberships.map(({ workspace }) => workspace)}
        builderStatus={profile}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
