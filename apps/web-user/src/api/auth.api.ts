import { apiClient } from "./axios";

// Using explicit DTO typing conforming to OpenAPI practices
export interface LoginRequestDto {
  email: string;
  password?: string; // Optional if using magic links/OTP later
}

export interface LoginResponseDto {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
  accessToken: string;
}

export const authApi = {
  login: async (data: LoginRequestDto): Promise<LoginResponseDto> => {
    const response = await apiClient.post<LoginResponseDto>("/auth/login", data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },

  getCurrentUser: async (): Promise<LoginResponseDto["user"]> => {
    const response = await apiClient.get<LoginResponseDto["user"]>("/auth/me");
    return response.data;
  },
};
