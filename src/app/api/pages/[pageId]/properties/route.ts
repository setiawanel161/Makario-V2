import {
  authorizeDatabasePage,
  databaseErrorResponse,
  parseRequestBody,
} from '@/server/auth/database-route-utils';
import {
  createDatabaseProperty,
  deleteDatabaseProperty,
  updateDatabaseProperty,
} from '@/server/services/database-service';
import {
  createPropertySchema,
  deletePropertySchema,
  updatePropertySchema,
} from '@/server/validators/database';

type RouteContext = { params: Promise<{ pageId: string }> };

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const { pageId } = await params;
  const authorization = await authorizeDatabasePage(pageId);
  if (authorization instanceof Response) return authorization;
  const body = await parseRequestBody(request);
  if (!body.ok) return body.response;
  const parsed = createPropertySchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid database property.', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const property = await createDatabaseProperty({ pageId, ...parsed.data });
    return Response.json({ property }, { status: 201 });
  } catch (error) {
    const response = databaseErrorResponse(error);
    if (response !== null) return response;
    console.error('Database property could not be created.', error);
    return Response.json({ error: 'Database property could not be created.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  const { pageId } = await params;
  const authorization = await authorizeDatabasePage(pageId);
  if (authorization instanceof Response) return authorization;
  const body = await parseRequestBody(request);
  if (!body.ok) return body.response;
  const parsed = updatePropertySchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid database property update.', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const property = await updateDatabaseProperty({ pageId, ...parsed.data });
    return Response.json({ property });
  } catch (error) {
    const response = databaseErrorResponse(error);
    if (response !== null) return response;
    console.error('Database property could not be updated.', error);
    return Response.json({ error: 'Database property could not be updated.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext): Promise<Response> {
  const { pageId } = await params;
  const authorization = await authorizeDatabasePage(pageId);
  if (authorization instanceof Response) return authorization;
  const body = await parseRequestBody(request);
  if (!body.ok) return body.response;
  const parsed = deletePropertySchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json({ error: 'A property id is required.' }, { status: 400 });
  }

  try {
    return Response.json(await deleteDatabaseProperty({ pageId, ...parsed.data }));
  } catch (error) {
    const response = databaseErrorResponse(error);
    if (response !== null) return response;
    console.error('Database property could not be deleted.', error);
    return Response.json({ error: 'Database property could not be deleted.' }, { status: 500 });
  }
}
