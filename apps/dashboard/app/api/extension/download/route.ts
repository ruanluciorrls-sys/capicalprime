import { NextRequest } from 'next/server';

const FORCED_EXTENSION_PUBLIC_ORIGIN =
  (process.env.EXTENSION_FORCE_PUBLIC_ORIGIN || '').trim().replace(/\/+$/, '');
const FORCED_EXTENSION_BACKEND_BASE =
  (
    process.env.EXTENSION_FORCE_BACKEND_BASE_URL ||
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    ''
  ).trim().replace(/\/+$/, '');

function resolvePublicBaseHint(request: NextRequest): string {
  if (FORCED_EXTENSION_PUBLIC_ORIGIN) return FORCED_EXTENSION_PUBLIC_ORIGIN;

  const explicit = request.headers.get('x-extension-public-api-base-url');
  if (explicit) return explicit.trim().replace(/\/+$/, '');

  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`.trim().replace(/\/+$/, '');
  }

  const origin = request.nextUrl.origin;
  return String(origin || '').trim().replace(/\/+$/, '');
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const authorization = request.headers.get('authorization');
  if (!apiKey && !authorization) {
    return new Response(JSON.stringify({ message: 'Autenticacao ausente (X-Api-Key ou Bearer).' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // INTERNAL_API_URL aponta para http://backend:3001 dentro do Docker (service name).
  // Fora do Docker, usa NEXT_PUBLIC_API_URL ou fallback local.
  const backendBase =
    process.env.INTERNAL_API_URL ||
    FORCED_EXTENSION_BACKEND_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    'http://127.0.0.1:3001';
  const publicBaseHint = resolvePublicBaseHint(request);
  const upstreamHeaders: Record<string, string> = {
    'X-Extension-Public-Api-Base-Url': publicBaseHint,
  };
  if (authorization) upstreamHeaders['Authorization'] = authorization;
  if (apiKey) upstreamHeaders['X-Api-Key'] = apiKey;

  const response = await fetch(`${backendBase}/api/v1/extension/download`, {
    headers: upstreamHeaders,
  });

  if (!response.ok) {
    const text = await response.text();
    return new Response(text || JSON.stringify({ message: 'Falha ao baixar extensao.' }), {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
    });
  }

  const file = await response.arrayBuffer();
  return new Response(file, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="capital-prime-extension.zip"',
    },
  });
}
