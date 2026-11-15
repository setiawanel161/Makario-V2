import {
  authorizeDatabasePage,
  databaseErrorResponse,
  parseRequestBody,
} from '@/server/auth/database-route-utils';
import {
  createDatabaseView,
  deleteDatabaseView,
  updateDatabaseView,
} from '@/server/services/database-service';
import {
  createViewSchema,
  deleteViewSchema,
  updateViewSchema,
} from '@/server/validators/database';

type RouteContext = { params: Promise<{ pageId: string }> };

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const { pageId } = await params;
  const authorization = await authorizeDatabasePage(pageId);
  if (authorization instanceof Response) return authorization;
  const body = await parseRequestBody(request);
  if (!body.ok) return body.response;
  const parsed = createViewSchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid database view.', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const view = await createDatabaseView({ pageId, ...parsed.data });
    return Response.json({ view }, { status: 201 });
  } catch (error) {
    const response = databaseErrorResponse(error);
    if (response !== null) return response;
    console.error('Database view could not be created.', error);
    return Response.json({ error: 'Database view could not be created.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  const { pageId } = await params;
  const authorization = await authorizeDatabasePage(pageId);
  if (authorization instanceof Response) return authorization;
  const body = await parseRequestBody(request);
  if (!body.ok) return body.response;
  const parsed = updateViewSchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid database view update.', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const view = await updateDatabaseView({ pageId, ...parsed.data });
    return Response.json({ view });
  } catch (error) {
    const response = databaseErrorResponse(error);
    if (response !== null) return response;
    console.error('Database view could not be updated.', error);
    return Response.json({ error: 'Database view could not be updated.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext): Promise<Response> {
  const { pageId } = await params;
  const authorization = await authorizeDatabasePage(pageId);
  if (authorization instanceof Response) return authorization;
  const body = await parseRequestBody(request);
  if (!body.ok) return body.response;
  const parsed = deleteViewSchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json({ error: 'A view id is required.' }, { status: 400 });
  }

  try {
    return Response.json(await deleteDatabaseView({ pageId, ...parsed.data }));
  } catch (error) {
    const response = databaseErrorResponse(error);
    if (response !== null) return response;
    console.error('Database view could not be deleted.', error);
    return Response.json({ error: 'Database view could not be deleted.' }, { status: 500 });
  }
}
