import type { ApiResponse } from './contracts';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let getToken = () => '';
let unauthorized: (token: string) => void = () => {};
export function setAuthentication(provider: () => string, onUnauthorized: (token: string) => void) {
  getToken = provider;
  unauthorized = onUnauthorized;
}
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(15000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  const headers = new Headers(options.headers);
  if (!headers.has('Authorization') && getToken())
    headers.set('Authorization', 'Bearer ' + getToken());
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const requestToken = (headers.get('Authorization') || '').replace(/^Bearer /, '');
  let response: Response;
  try {
    response = await fetch(base + path, {
      ...options,
      signal,
      headers,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      timeout.aborted ? '请求超时，请稍后重试' : '网络连接失败，请检查后端服务',
      0,
    );
  }
  if (response.status === 401) unauthorized(requestToken);
  let payload: ApiResponse<T>;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('接口返回了非 JSON 内容，请检查 API 地址和代理配置', response.status);
  }
  if (!response.ok || !payload.success) {
    throw new ApiError(
      !payload.success && payload.message ? payload.message : '请求失败（' + response.status + '）',
      response.status,
    );
  }
  return payload.data;
}
