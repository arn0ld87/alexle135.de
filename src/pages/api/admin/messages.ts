import type { APIRoute } from 'astro';
import {
  deleteContactMessage,
  listContactMessages,
  setContactMessageStatus,
  setContactMessageHandled,
} from '../../../lib/db/repositories';
import { handleUnexpectedError, jsonResponse } from '../../../lib/api/errors';
import { parseJsonBody, parseWithSchema } from '../../../lib/api/parseRequest';
import { withRequestLogging } from '../../../lib/api/logger';
import {
  contactMessageStatusSchema,
  patchMessageSchema,
  uuidSchema,
} from '../../../lib/validation/adminSchemas';

export const prerender = false;

const ROUTE = '/api/admin/messages';

const handleGet: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const onlyUnhandled = url.searchParams.get('unhandled') === '1';
  const rawStatus = contactMessageStatusSchema.safeParse(url.searchParams.get('status'));
  const status = rawStatus.success ? rawStatus.data : undefined;

  try {
    const items = await listContactMessages({ onlyUnhandled, status });
    return jsonResponse(200, { items });
  } catch (error) {
    return handleUnexpectedError(error, { route: ROUTE, method: 'GET' });
  }
};

const handlePatch: APIRoute = async ({ request }) => {
  const parsed = await parseJsonBody(request, patchMessageSchema);
  if (!parsed.ok) return parsed.response;

  const { id, handled, status } = parsed.data;
  try {
    if (status !== undefined) {
      await setContactMessageStatus(id, status);
    } else {
      await setContactMessageHandled(id, handled ?? true);
    }
    return jsonResponse(200, { ok: true });
  } catch (error) {
    return handleUnexpectedError(error, { route: ROUTE, method: 'PATCH' });
  }
};

const handleDelete: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const parsedId = parseWithSchema(url.searchParams.get('id'), uuidSchema);
  if (!parsedId.ok) return parsedId.response;

  try {
    await deleteContactMessage(parsedId.data);
    return jsonResponse(200, { ok: true });
  } catch (error) {
    return handleUnexpectedError(error, { route: ROUTE, method: 'DELETE' });
  }
};

export const GET = withRequestLogging(ROUTE, handleGet);
export const PATCH = withRequestLogging(ROUTE, handlePatch);
export const DELETE = withRequestLogging(ROUTE, handleDelete);
