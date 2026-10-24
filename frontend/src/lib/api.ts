const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ew_token');
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ew_token', token);
  }
}

export function removeToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ew_token');
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T; error?: string }> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: data as T,
        error: (data as any)?.message || `Lỗi yêu cầu: mã ${res.status}`,
      };
    }

    return {
      ok: true,
      status: res.status,
      data: data as T,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null as unknown as T,
      error: err instanceof Error ? err.message : 'Không thể kết nối đến Backend API',
    };
  }
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: any; tokens: { accessToken: string; refreshToken: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string, fullName: string, roleName?: string) =>
      request<{ user: any; tokens: { accessToken: string; refreshToken: string } }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName, roleName }),
      }),
    me: () => request<any>('/auth/me'),
  },

  resources: {
    list: (query: { search?: string; type?: string; status?: string; minCapacity?: number; page?: number; limit?: number } = {}) => {
      const params = new URLSearchParams();
      if (query.search) params.set('search', query.search);
      if (query.type) params.set('type', query.type);
      if (query.status) params.set('status', query.status);
      if (query.minCapacity) params.set('minCapacity', String(query.minCapacity));
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));
      return request<{ data: any[]; meta: any }>(`/resources?${params.toString()}`);
    },
    create: (body: any) =>
      request<any>('/resources', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<any>(`/resources/${id}`, {
        method: 'DELETE',
      }),
  },

  bookings: {
    list: (query: { resourceId?: string; status?: string; page?: number; limit?: number } = {}) => {
      const params = new URLSearchParams();
      if (query.resourceId) params.set('resourceId', query.resourceId);
      if (query.status) params.set('status', query.status);
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));
      return request<{ data: any[]; meta: any }>(`/bookings?${params.toString()}`);
    },
    create: (body: { resourceId: string; startTime: string; endTime: string; title?: string; notes?: string }) =>
      request<any>('/bookings', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    cancel: (id: string) =>
      request<any>(`/bookings/${id}/cancel`, {
        method: 'PATCH',
      }),
  },

  ai: {
    parseIntent: (prompt: string) =>
      request<{
        success: boolean;
        prompt: string;
        engine: string;
        extracted: any;
        matchedResource: any;
        bookingPayload: any;
        message: string;
      }>('/ai/parse-intent', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      }),
  },
};
