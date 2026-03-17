import axios from "axios";

// Standardizing memory token storage to prevent XSS attacks while keeping access
let memoryAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  memoryAccessToken = token;
};

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
  withCredentials: true, // This allows the HttpOnly refresh token cookie to be sent automatically
});

// Attach memory Access Token to every request
apiClient.interceptors.request.use((config) => {
  if (memoryAccessToken && config.headers) {
    config.headers.Authorization = `Bearer ${memoryAccessToken}`;
  }
  return config;
});

// Intercept 401s to trigger automatic refresh via HttpOnly cookie
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Avoid infinite refresh loops using `_retry`
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshUrl = `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
        }/auth/refresh`;
        
        // This request relies solely on the HttpOnly cookie being present
        const res = await axios.post(
          refreshUrl,
          {},
          { withCredentials: true }
        );
        
        const { accessToken } = res.data;
        // Store new access token in memory
        setAccessToken(accessToken);
        
        // Retry the original failing request with the new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh token is expired or invalid. Force logout sequence.
        setAccessToken(null);
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
