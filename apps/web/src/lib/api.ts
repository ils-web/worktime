export class ApiError extends Error {
  status: number;
  errorCode?: string;

  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Always include httpOnly session cookie
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Handle Trial Expired globally (Section 1.4 & 4.2.1)
  if (response.status === 403) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      // ignore
    }

    if (errorData.errorCode === 'TRIAL_EXPIRED') {
      window.dispatchEvent(new CustomEvent('trial-expired'));
      throw new ApiError('Срок действия пробного периода истек', 403, 'TRIAL_EXPIRED');
    }

    throw new ApiError(errorData.error || 'Доступ запрещен', 403, errorData.errorCode);
  }

  // Handle Unauthorized globally
  if (response.status === 401) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      // ignore
    }
    // Only redirect if not already on login page
    if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/w/')) {
      window.location.href = '/login';
    }
    throw new ApiError(errorData.error || 'Сессия истекла', 401);
  }

  if (!response.ok) {
    let errorMsg = 'Ошибка запроса';
    let errorCode: string | undefined;
    try {
      const err = await response.json();
      errorMsg = err.error || errorMsg;
      errorCode = err.errorCode;
    } catch {
      // ignore
    }
    throw new ApiError(errorMsg, response.status, errorCode);
  }

  // If response is file blob/attachment, handle separately
  const contentType = response.headers.get('content-type');
  if (contentType && (contentType.includes('application/pdf') || contentType.includes('text/csv'))) {
    return (await response.blob()) as unknown as T;
  }

  return await response.json();
}
