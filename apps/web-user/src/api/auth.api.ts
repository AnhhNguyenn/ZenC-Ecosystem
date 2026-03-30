import { apiClient } from "./axios";

interface ApiEnvelope<T> {
  statusCode: number;
  message: string;
  data: T;
}

export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string;
  role: "LEARNER" | "ADMIN";
  tier: "FREE" | "PRO" | "UNLIMITED";
  status: "ACTIVE" | "LOCKED" | "BANNED";
}

export interface RegisterRequestDto {
  email?: string;
  password?: string;
  isMinor: boolean;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  register: async (data: RegisterRequestDto): Promise<void> => {
    await apiClient.post("/auth/register", data);
  },

  login: async (data: LoginRequestDto): Promise<LoginResponseDto> => {
    const response = await apiClient.post<ApiEnvelope<LoginResponseDto>>("/auth/login", data);
    return response.data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },

  getCurrentUser: async (): Promise<AuthUserDto> => {
    const response = await apiClient.get<ApiEnvelope<AuthUserDto>>("/auth/me");
    return response.data.data;
  },

  updateProfile: async (data: { isMinor: boolean }): Promise<void> => {
    await apiClient.patch("/users/profile", data);
  },
};
