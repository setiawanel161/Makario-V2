import { auth } from './auth';
import { WorkspaceAuthorizationError } from './rbac';

export async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export function authorizationErrorResponse(error: unknown): Response | null {
  if (!(error instanceof WorkspaceAuthorizationError)) {
    return null;
  }
  return Response.json({ error: error.message }, { status: error.status });
}
