export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super(typeof data === 'object' && data !== null && 'message' in data
      ? String((data as Record<string, unknown>).message)
      : `Request failed with status ${status}`);
    this.status = status;
    this.data = data;
  }
}

let isRefreshing = false;
let isRedirecting = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (reason: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
}

async function refreshToken(): Promise<string> {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    throw new ApiError(res.status, await res.json().catch(() => null));
  }

  const data = await res.json();
  const newToken = data.access_token;
  localStorage.setItem('access_token', newToken);
  return newToken;
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<{ data: T; status: number }> {
  const fullUrl = url.startsWith('/') ? `/api${url}` : `/api/${url}`;
  const token = localStorage.getItem('access_token');

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
  }

  const init: RequestInit = {
    method,
    headers,
    credentials: 'include',
  };
  if (body !== undefined && body !== null) {
    init.body = JSON.stringify(body);
  }

  let res = await fetch(fullUrl, init);

  // Avoid infinite refresh loops on auth endpoints
  if (
    res.status === 401 &&
    !url.includes('/auth/refresh') &&
    !url.includes('/auth/login')
  ) {
    if (isRefreshing) {
      const newToken = await new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      });
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(fullUrl, { ...init, headers });
    } else {
      isRefreshing = true;
      try {
        const newToken = await refreshToken();
        processQueue(null, newToken);
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(fullUrl, { ...init, headers });
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('auth_user');
        if (!isRedirecting) {
          isRedirecting = true;
          window.location.href = '/login?message=Session+expired';
        }
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    if (!res.ok) throw new ApiError(res.status, null);
    return { data: null as T, status: res.status };
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, data);
  }

  return { data: data as T, status: res.status };
}

const apiClient = {
  get: <T = unknown>(url: string) => request<T>('GET', url),
  post: <T = unknown>(url: string, body?: unknown) => request<T>('POST', url, body),
  put: <T = unknown>(url: string, body?: unknown) => request<T>('PUT', url, body),
  patch: <T = unknown>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  delete: <T = unknown>(url: string) => request<T>('DELETE', url),
};

export default apiClient;
