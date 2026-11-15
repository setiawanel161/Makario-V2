import { z } from 'zod';
import { getPublicPageData } from '@/server/services/public-page-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const parsed = z.string().trim().min(1).max(200).safeParse(slug);
  if (!parsed.success) {
    return Response.json({ error: 'Public page was not found.' }, { status: 404 });
  }

  const page = await getPublicPageData(parsed.data);
  if (page === null) {
    return Response.json({ error: 'Public page was not found.' }, { status: 404 });
  }
  return Response.json(page, {
    headers: { 'cache-control': 'private, no-store' },
  });
}
