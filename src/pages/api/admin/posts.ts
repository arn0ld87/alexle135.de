import type { APIRoute } from 'astro';
import { createPost, deletePost, updatePost } from '../../../lib/db/repositories';
import { handleUnexpectedError, jsonResponse } from '../../../lib/api/errors';
import { parseJsonBody, parseWithSchema } from '../../../lib/api/parseRequest';
import { withRequestLogging } from '../../../lib/api/logger';
import {
  postCreateSchema,
  postUpdateSchema,
  uuidSchema,
} from '../../../lib/validation/adminSchemas';

export const prerender = false;

const ROUTE = '/api/admin/posts';

const handlePost: APIRoute = async ({ request, locals }) => {
  const parsed = await parseJsonBody(request, postCreateSchema);
  if (!parsed.ok) return parsed.response;

  const authorId = locals.user?.id;
  if (!authorId) {
    return jsonResponse(401, { error: 'Nicht autorisiert.' });
  }

  try {
    const id = await createPost({ ...parsed.data, author_id: authorId });
    return jsonResponse(200, { ok: true, id });
  } catch (error) {
    return handleUnexpectedError(error, { route: ROUTE, method: 'POST' });
  }
};

const handlePut: APIRoute = async ({ request }) => {
  const parsed = await parseJsonBody(request, postUpdateSchema);
  if (!parsed.ok) return parsed.response;

  const { id, ...data } = parsed.data;
  try {
    await updatePost(id, data);
    return jsonResponse(200, { ok: true });
  } catch (error) {
    return handleUnexpectedError(error, { route: ROUTE, method: 'PUT' });
  }
};

const handleDelete: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const parsedId = parseWithSchema(url.searchParams.get('id'), uuidSchema);
  if (!parsedId.ok) return parsedId.response;

  try {
    await deletePost(parsedId.data);
    return jsonResponse(200, { ok: true });
  } catch (error) {
    return handleUnexpectedError(error, { route: ROUTE, method: 'DELETE' });
  }
};

export const POST = withRequestLogging(ROUTE, handlePost);
export const PUT = withRequestLogging(ROUTE, handlePut);
export const DELETE = withRequestLogging(ROUTE, handleDelete);
