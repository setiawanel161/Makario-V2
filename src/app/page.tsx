import { redirect } from 'next/navigation';
import { auth } from '@/server/auth/auth';
import { prisma } from '@/server/db/prisma';

export default async function HomePage(): Promise<never> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: 'asc' },
    select: { workspace: { select: { slug: true } } },
  });
  redirect(membership ? `/${membership.workspace.slug}` : '/onboarding');
}
