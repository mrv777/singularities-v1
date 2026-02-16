import type {
  AuthChallengeRequest,
  AuthChallengeResponse,
  AuthVerifyRequest,
  AuthVerifyResponse,
  PlayerResponse,
  HealthResponse,
  RegisterRequest,
  RegisterResponse,
  ScanResponse,
  HackRequest,
  HackResult,
  ModulesResponse,
  ModulePurchaseRequest,
  ModulePurchaseResponse,
  LoadoutResponse,
  LoadoutUpdateRequest,
  LoadoutUpdateResponse,
  ExitSandboxResponse,
  RepairRequest,
  RepairResponse,
  FullScanResponse,
  ModifierResponse,
  ScriptCreateRequest,
  ScriptListResponse,
  PlayerScript,
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

  // Registration
  register(data: RegisterRequest) {
    return this.fetch<RegisterResponse>("/players/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Scanner
  scan() {
    return this.fetch<ScanResponse>("/scanner/scan", { method: "POST" });
  }

  hack(data: HackRequest) {
    return this.fetch<HackResult>("/scanner/hack", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Modules
  getModules() {
    return this.fetch<ModulesResponse>("/modules");
  }

  purchaseModule(data: ModulePurchaseRequest) {
    return this.fetch<ModulePurchaseResponse>("/modules/purchase", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Loadouts
  getLoadouts() {
    return this.fetch<LoadoutResponse>("/loadouts");
  }

  updateLoadouts(data: LoadoutUpdateRequest) {
    return this.fetch<LoadoutUpdateResponse>("/loadouts", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // Sandbox
  exitSandbox() {
    return this.fetch<ExitSandboxResponse>("/players/exit-sandbox", {
      method: "POST",
    });
  }

  // Maintenance
  repairSystem(data: RepairRequest) {
    return this.fetch<RepairResponse>("/maintenance/repair", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  fullScan() {
    return this.fetch<FullScanResponse>("/maintenance/full-scan", {
      method: "POST",
    });
  }

  // Modifiers
  getTodayModifier() {
    return this.fetch<ModifierResponse>("/modifiers/today");
  }

  // Scripts
  getScripts() {
    return this.fetch<ScriptListResponse>("/scripts");
  }

  createScript(data: ScriptCreateRequest) {
    return this.fetch<PlayerScript>("/scripts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  activateScript(scriptId: string) {
    return this.fetch<PlayerScript>(`/scripts/${scriptId}/activate`, {
      method: "PUT",
    });
  }

  deleteScript(scriptId: string) {
    return this.fetch<{ success: boolean }>(`/scripts/${scriptId}`, {
      method: "DELETE",
    });
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
