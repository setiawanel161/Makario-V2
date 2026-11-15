import { redirect } from 'next/navigation';
import { auth } from '@/server/auth/auth';
import { prisma } from '@/server/db/prisma';
import { WorkspaceOnboarding } from '@/components/workspaces/workspace-onboarding';

export default async function OnboardingPage(): Promise<React.JSX.Element> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const firstWorkspace = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: 'asc' },
    select: { workspace: { select: { slug: true } } },
  });
  if (firstWorkspace) {
    redirect(`/${firstWorkspace.workspace.slug}`);
  }

  return <WorkspaceOnboarding />;
}
