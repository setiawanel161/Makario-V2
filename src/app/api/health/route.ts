import { prisma } from '@/server/db/prisma';

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Health check could not reach PostgreSQL.', error);
    return Response.json(
      { status: 'error', database: 'unavailable' },
      { status: 503 },
    );
  }
}
