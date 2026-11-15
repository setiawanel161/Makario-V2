import { getAuthenticatedUserId, authorizationErrorResponse } from '@/server/auth/route-utils';
import { requireWorkspaceRole } from '@/server/auth/rbac';
import { prisma } from '@/server/db/prisma';
import { z } from 'zod';

const streamQuerySchema = z.object({ workspaceId: z.string().min(1).max(100) });

export async function GET(request: Request): Promise<Response> {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }
  const parsed = streamQuerySchema.safeParse({
    workspaceId: new URL(request.url).searchParams.get('workspaceId'),
  });
  if (!parsed.success) {
    return Response.json({ error: 'A workspace ID is required.' }, { status: 400 });
  }

  try {
    await requireWorkspaceRole({
      userId,
      workspaceId: parsed.data.workspaceId,
      minimumRole: 'GUEST',
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response !== null) return response;
    throw error;
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: parsed.data.workspaceId },
    select: { serverRevision: true },
  });
  if (workspace === null) {
    return Response.json({ error: 'Workspace was not found.' }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let polling = false;
      let lastRevision = workspace.serverRevision;

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        request.signal.removeEventListener('abort', close);
        controller.close();
      };
      const enqueue = (revision: bigint) => {
        controller.enqueue(
          encoder.encode(
            `event: revision\ndata: ${JSON.stringify({ serverRevision: revision.toString(10) })}\n\n`,
          ),
        );
      };

      enqueue(lastRevision);
      const interval = setInterval(() => {
        if (closed || polling) return;
        polling = true;
        void prisma.workspace
          .findUnique({
            where: { id: parsed.data.workspaceId },
            select: { serverRevision: true },
          })
          .then((latest) => {
            if (closed) return;
            if (latest === null) {
              close();
              return;
            }
            if (latest.serverRevision > lastRevision) {
              lastRevision = latest.serverRevision;
              enqueue(lastRevision);
            }
          })
          .catch((error: unknown) => {
            console.error('Workspace revision stream polling failed.', error);
            if (!closed) {
              controller.enqueue(
                encoder.encode('event: error\ndata: {"error":"Revision stream unavailable."}\n\n'),
              );
              close();
            }
          })
          .finally(() => {
            polling = false;
          });
      }, 1000);
      request.signal.addEventListener('abort', close, { once: true });
    },
    cancel() {
      return;
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
