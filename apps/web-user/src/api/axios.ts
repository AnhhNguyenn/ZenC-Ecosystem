import axios from "axios";

type BrowserWindow = Window &
  typeof globalThis & {
    __ZENC_ACCESS_TOKEN__?: string | null;
    __ZENC_REFRESH_PROMISE__?: Promise<string> | null;
  };

const getBrowserWindow = (): BrowserWindow | null =>
  typeof window === "undefined" ? null : (window as BrowserWindow);

const getDefaultGatewayOrigin = (): string => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    return "http://localhost:3000";
  }

  const { protocol, hostname } = browserWindow.location;
  return `${protocol}//${hostname}:3000`;
};

const normalizeApiBaseUrl = (rawBase: string): string => {
  const normalizedBase = rawBase.replace(/\/+$/, "");

  if (/\/api\/v\d+$/i.test(normalizedBase)) {
    return normalizedBase;
  }

  if (/\/api$/i.test(normalizedBase)) {
    return `${normalizedBase}/v1`;
  }

  return `${normalizedBase}/api/v1`;
};

export const resolveApiBaseUrl = (): string => {
  const configuredBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  const rawBase =
    configuredBase && configuredBase.length > 0
      ? configuredBase
      : getDefaultGatewayOrigin();

  return normalizeApiBaseUrl(rawBase);
};

const extractAccessToken = (payload: unknown): string => {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object" &&
    "accessToken" in payload.data &&
    typeof payload.data.accessToken === "string"
  ) {
    return payload.data.accessToken;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "accessToken" in payload &&
    typeof payload.accessToken === "string"
  ) {
    return payload.accessToken;
  }

  throw new Error("Refresh response did not include an access token");
};

export const setAccessToken = (token: string | null) => {
  const browserWindow = getBrowserWindow();
  if (browserWindow) {
    browserWindow.__ZENC_ACCESS_TOKEN__ = token;
  }
};

const getAccessToken = (): string | null => {
  const browserWindow = getBrowserWindow();
  return browserWindow?.__ZENC_ACCESS_TOKEN__ ?? null;
};

const refreshAccessToken = async (): Promise<string> => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) {
    throw new Error("Token refresh is only supported in the browser");
  }

  if (!browserWindow.__ZENC_REFRESH_PROMISE__) {
    browserWindow.__ZENC_REFRESH_PROMISE__ = axios
      .post(
        `${resolveApiBaseUrl()}/auth/refresh`,
        {},
        { withCredentials: true }
      )
      .then((response) => {
        const accessToken = extractAccessToken(response.data);
        setAccessToken(accessToken);
        return accessToken;
      })
      .finally(() => {
        browserWindow.__ZENC_REFRESH_PROMISE__ = null;
      });
  }

  return browserWindow.__ZENC_REFRESH_PROMISE__;
};

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = (error.config ?? {}) as typeof error.config & {
      _retry?: boolean;
      headers?: Record<string, string>;
    };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      typeof window !== "undefined"
    ) {
      originalRequest._retry = true;
      try {
        const accessToken = await refreshAccessToken();
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
