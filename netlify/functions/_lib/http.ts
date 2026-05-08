export type NetlifyEvent = {
  body: string | null;
  headers?: Record<string, string | undefined>;
  httpMethod: string;
  rawBody?: string;
};

export type NetlifyResponse = {
  body: string;
  headers: Record<string, string>;
  isBase64Encoded?: boolean;
  statusCode: number;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};

export function jsonResponse(body: unknown, statusCode = 200): NetlifyResponse {
  return {
    body: JSON.stringify(body),
    headers: jsonHeaders,
    statusCode
  };
}

export function errorResponse(message: string, statusCode = 400): NetlifyResponse {
  return jsonResponse({ error: message }, statusCode);
}

export function requireMethod(event: NetlifyEvent, method: string): NetlifyResponse | null {
  if (event.httpMethod.toUpperCase() !== method.toUpperCase()) {
    return errorResponse("Method not allowed.", 405);
  }

  return null;
}

export function parseJsonBody<T>(event: NetlifyEvent): T | null {
  if (!event.body) {
    return null;
  }

  try {
    return JSON.parse(event.body) as T;
  } catch {
    return null;
  }
}
