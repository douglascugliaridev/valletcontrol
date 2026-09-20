import type { ErrorResponse } from '@valletcontrol/shared';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

/** Converte caminho relativo da API (ex.: "/api/uploads/x.png") em URL absoluta. */
export function resolveAssetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  if (path.startsWith('/api/uploads/')) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

const TOKEN_KEY = 'valletcontrol.token';
const USER_KEY = 'valletcontrol.user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: Record<string, unknown>): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  readonly status: number;
  readonly domainCode?: string;

  constructor(status: number, message: string, domainCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.domainCode = domainCode;
  }
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
}

function getMessageFromBody(body: ErrorResponse): string {
  if (Array.isArray(body.message)) return body.message.join('. ');
  return body.message ?? 'Erro inesperado.';
}

/** Erros de rede do fetch (servidor fora do ar/inalcançável) caem em TypeError. */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

/** Mensagem amigável para falhas de autenticação, diferenciando rede de erro do servidor. */
export function authErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (isNetworkError(err)) {
    return `Não foi possível conectar ao servidor (${API_ORIGIN}). Verifique se o dispositivo está na mesma rede e se o servidor está rodando.`;
  }
  return fallback;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, headers: extraHeaders, ...rest } = options;

  const isFormData = rest.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(extraHeaders as Record<string, string> | undefined),
  };

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...rest, headers });
  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => null)) as ErrorResponse | T | null;
  if (!res.ok) {
    const errorBody = (body as ErrorResponse | null) ?? {
      statusCode: res.status,
      message: 'Erro inesperado.',
    };
    throw new ApiError(res.status, getMessageFromBody(errorBody), errorBody.domainCode);
  }
  return body as T;
}

export const apiClient = {
  login: (credentials: { email: string; password: string }) =>
    api<{ user: { id: string; name: string; email: string }; tokens: { accessToken: string } }>(
      '/auth/login',
      {
        method: 'POST',
        auth: false,
        body: JSON.stringify(credentials),
      },
    ),
  register: (payload: { name: string; email: string; password: string }) =>
    api<{ user: { id: string; name: string; email: string }; tokens: { accessToken: string } }>(
      '/auth/register',
      {
        method: 'POST',
        auth: false,
        body: JSON.stringify(payload),
      },
    ),
};
