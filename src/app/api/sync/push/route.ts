import { getAuthenticatedUserId, authorizationErrorResponse } from '@/server/auth/route-utils';
import { requireWorkspaceRole } from '@/server/auth/rbac';
import { processSyncBatch, SyncBatchError } from '@/server/services/sync-service';
import { syncPushSchema } from '@/server/validators/sync';

export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return Response.json({ error: 'Authentication is required.' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const parsed = syncPushSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: 'The sync batch is invalid.', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const workspaceId = parsed.data.mutations[0]?.workspaceId;
  if (workspaceId === undefined) {
    return Response.json({ error: 'A sync batch must contain at least one mutation.' }, { status: 400 });
  }
  if (parsed.data.mutations.some((mutation) => mutation.workspaceId !== workspaceId)) {
    return Response.json(
      { error: 'A batch may only contain mutations for one workspace.' },
      { status: 400 },
    );
  }

  try {
    await requireWorkspaceRole({ userId, workspaceId, minimumRole: 'MEMBER' });
    const result = await processSyncBatch({
      userId,
      workspaceId,
      mutations: parsed.data.mutations,
    });
    return Response.json(result);
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse !== null) return authorizationResponse;
    if (error instanceof SyncBatchError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Sync batch could not be applied.', error);
    return Response.json({ error: 'Sync batch could not be applied.' }, { status: 500 });
  }
}
