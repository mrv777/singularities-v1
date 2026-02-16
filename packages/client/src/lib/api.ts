import type {
  AuthChallengeRequest,
  AuthChallengeResponse,
  AuthVerifyRequest,
  AuthVerifyResponse,
  PlayerResponse,
  HealthResponse,
} from "@singularities/shared";

const API_BASE = "/api";

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem("auth_token", token);
    } else {
      localStorage.removeItem("auth_token");
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem("auth_token");
    }
    return this.token;
  }

  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: "Unknown",
        message: response.statusText,
      }));
      throw new ApiError(response.status, error.message ?? "Request failed");
    }

    return response.json() as Promise<T>;
  }

  // Health
  health() {
    return this.fetch<HealthResponse>("/health");
  }

  // Auth
  authChallenge(data: AuthChallengeRequest) {
    return this.fetch<AuthChallengeResponse>("/auth/challenge", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  authVerify(data: AuthVerifyRequest) {
    return this.fetch<AuthVerifyResponse>("/auth/verify", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Player
  getMe() {
    return this.fetch<PlayerResponse>("/player/me");
  }
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = new ApiClient();
