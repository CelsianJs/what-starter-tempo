export class JsonBodyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'JsonBodyError';
    this.status = status;
  }
}

function parseContentLength(request) {
  const header = request.headers.get('content-length');
  if (!header) return null;
  const bytes = Number(header);
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : null;
}

export async function readBoundedJson(request, maxBytes) {
  const contentLength = parseContentLength(request);
  if (contentLength !== null && contentLength > maxBytes) {
    throw new JsonBodyError('Request body is too large.', 413);
  }

  if (!request.body) return {};

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new JsonBodyError('Request body is too large.', 413);
      }
      chunks.push(chunk);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(body);
    return JSON.parse(text || '{}');
  } catch {
    throw new JsonBodyError('Request body must be valid JSON.', 400);
  }
}
