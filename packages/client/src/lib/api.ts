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
  StartGameRequest,
  StartGameResponse,
  GameMoveRequest,
  GameMoveResponse,
  GameResolveResponse,
  GameStatusResponse,
  ModulesResponse,
  ModulePurchaseRequest,
  ModulePurchaseResponse,
  LoadoutResponse,
  LoadoutUpdateRequest,
  LoadoutUpdateResponse,
  ExitSandboxResponse,
  RepairRequest,
  RepairResponse,
  RepairAllResponse,
  FullScanResponse,
  DataVaultStatusResponse,
  DataVaultActivateRequest,
  DataVaultActivateResponse,
  ModifierResponse,
  ScriptCreateRequest,
  ScriptListResponse,
  PlayerScript,
  ArenaAvailableResponse,
  ArenaEnterResponse,
  ArenaLeaveResponse,
  ArenaAttackRequest,
  ArenaAttackResponse,
  ArenaCombatLogsResponse,
  SecurityOverviewResponse,
  LoadoutType,
  TopologyResponse,
  WorldEventsResponse,
  NetworkStatsResponse,
  PendingDecisionResponse,
  DecisionChooseRequest,
  DecisionChooseResponse,
  DecisionHistoryResponse,
  MutateModuleRequest,
  MutateModuleResponse,
  CurrentSeasonResponse,
  SeasonLeaderboardResponse,
  AdminStatusResponse,
  AdminOverviewResponse,
  AdminArenaBotSettingsRequest,
  AdminArenaBotSettingsResponse,
  AdminArenaBotPreviewResponse,
  AdminSeasonEndRequest,
  AdminPlayerSearchResponse,
  AdminPlayerDetailResponse,
  AdminGrantResourcesRequest,
  AdminGrantResourcesResponse,
  AdminEconomyResponse,
  SystemHealthSummaryResponse,
  IceBreakerStatusResponse,
  IceBreakerInitiateResponse,
  IceBreakerResolveResponse,
  IceBreakerExtractResponse,
  DaemonForgeStatusResponse,
  DaemonForgeCraftResponse,
  DaemonForgeDeployResponse,
  DaemonForgeCollectResponse,
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
      ...((options.headers as Record<string, string>) ?? {}),
    };

    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

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

  /** @deprecated Use startGame + submitMove + resolveGame instead */
  hack(data: HackRequest) {
    return this.fetch<HackResult>("/scanner/hack", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Mini-games
  startGame(data: StartGameRequest) {
    return this.fetch<StartGameResponse>("/scanner/start-game", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  submitMove(data: GameMoveRequest) {
    return this.fetch<GameMoveResponse>("/scanner/move", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  resolveGame() {
    return this.fetch<GameResolveResponse>("/scanner/resolve", {
      method: "POST",
    });
  }

  getGameStatus() {
    return this.fetch<GameStatusResponse>("/scanner/game-status");
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

  // Tutorial
  updateTutorialStep(step: string) {
    return this.fetch<{ success: boolean; step: string }>("/player/tutorial", {
      method: "PATCH",
      body: JSON.stringify({ step }),
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

  repairAllSystems() {
    return this.fetch<RepairAllResponse>("/maintenance/repair-all", {
      method: "POST",
    });
  }

  fullScan() {
    return this.fetch<FullScanResponse>("/maintenance/full-scan", {
      method: "POST",
    });
  }

  // Data Vault
  getDataVaultStatus() {
    return this.fetch<DataVaultStatusResponse>("/data-vault/status");
  }

  activateDataVaultProtocol(data: DataVaultActivateRequest) {
    return this.fetch<DataVaultActivateResponse>("/data-vault/activate", {
      method: "POST",
      body: JSON.stringify(data),
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

  // Arena
  getArenaOpponents() {
    return this.fetch<ArenaAvailableResponse>("/arena/available");
  }

  enterArena() {
    return this.fetch<ArenaEnterResponse>("/arena/enter", { method: "POST" });
  }

  leaveArena() {
    return this.fetch<ArenaLeaveResponse>("/arena/leave", { method: "POST" });
  }

  attackPlayer(data: ArenaAttackRequest) {
    return this.fetch<ArenaAttackResponse>("/arena/attack", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getCombatLogs() {
    return this.fetch<ArenaCombatLogsResponse>("/arena/combat-logs");
  }

  // Security
  getSecurityOverview() {
    return this.fetch<SecurityOverviewResponse>("/security/overview");
  }

  // Loadouts by type
  getLoadoutsByType(type: LoadoutType) {
    return this.fetch<LoadoutResponse>(`/loadouts?type=${type}`);
  }

  updateLoadoutByType(type: LoadoutType, slots: [string | null, string | null, string | null]) {
    return this.fetch<LoadoutUpdateResponse>("/loadouts", {
      method: "PUT",
      body: JSON.stringify({ type, slots }),
    });
  }

  // World / Topology
  getTopology() {
    return this.fetch<TopologyResponse>("/world/topology");
  }

  getWorldEvents() {
    return this.fetch<WorldEventsResponse>("/world/events");
  }

  getNetworkStats() {
    return this.fetch<NetworkStatsResponse>("/world/stats");
  }

  // Decisions
  getPendingDecision() {
    return this.fetch<PendingDecisionResponse>("/decisions/pending");
  }

  submitDecision(data: DecisionChooseRequest) {
    return this.fetch<DecisionChooseResponse>("/decisions/choose", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getDecisionHistory() {
    return this.fetch<DecisionHistoryResponse>("/decisions/history");
  }

  // Mutations
  mutateModule(data: MutateModuleRequest) {
    return this.fetch<MutateModuleResponse>("/modules/mutate", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Seasons
  getCurrentSeason() {
    return this.fetch<CurrentSeasonResponse>("/seasons/current");
  }

  getSeasonLeaderboard() {
    return this.fetch<SeasonLeaderboardResponse>("/seasons/leaderboard");
  }

  // Admin
  getAdminStatus() {
    return this.fetch<AdminStatusResponse>("/admin/status");
  }

  getAdminOverview() {
    return this.fetch<AdminOverviewResponse>("/admin/overview");
  }

  getAdminBotPreview(level: number) {
    return this.fetch<AdminArenaBotPreviewResponse>(`/admin/bots/preview?level=${encodeURIComponent(level)}`);
  }

  setAdminBotsEnabled(data: AdminArenaBotSettingsRequest) {
    return this.fetch<AdminArenaBotSettingsResponse>("/admin/bots/enabled", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  adminEndSeason(data: AdminSeasonEndRequest) {
    return this.fetch<{ success: boolean }>("/admin/season/end", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  searchAdminPlayers(q: string) {
    return this.fetch<AdminPlayerSearchResponse>(`/admin/players/search?q=${encodeURIComponent(q)}`);
  }

  getAdminPlayerDetail(id: string) {
    return this.fetch<AdminPlayerDetailResponse>(`/admin/players/${encodeURIComponent(id)}`);
  }

  adminGrantResources(id: string, data: Omit<AdminGrantResourcesRequest, "playerId">) {
    return this.fetch<AdminGrantResourcesResponse>(`/admin/players/${encodeURIComponent(id)}/grant`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getAdminEconomy() {
    return this.fetch<AdminEconomyResponse>("/admin/economy");
  }

  // System Health Summary
  getSystemHealthSummary() {
    return this.fetch<SystemHealthSummaryResponse>("/maintenance/summary");
  }

  // ICE Breaker
  getIceBreakerStatus() {
    return this.fetch<IceBreakerStatusResponse>("/ice-breaker/status");
  }

  initiateIceBreach() {
    return this.fetch<IceBreakerInitiateResponse>("/ice-breaker/initiate", {
      method: "POST",
    });
  }

  resolveIceLayer() {
    return this.fetch<IceBreakerResolveResponse>("/ice-breaker/resolve", {
      method: "POST",
    });
  }

  extractIceRewards() {
    return this.fetch<IceBreakerExtractResponse>("/ice-breaker/extract", {
      method: "POST",
    });
  }

  // Daemon Forge
  getDaemonForgeStatus() {
    return this.fetch<DaemonForgeStatusResponse>("/daemon-forge/status");
  }

  craftDaemon(daemonType: string) {
    return this.fetch<DaemonForgeCraftResponse>("/daemon-forge/craft", {
      method: "POST",
      body: JSON.stringify({ daemonType }),
    });
  }

  deployDaemon(daemonId: string, duration: number) {
    return this.fetch<DaemonForgeDeployResponse>("/daemon-forge/deploy", {
      method: "POST",
      body: JSON.stringify({ daemonId, duration }),
    });
  }

  collectDaemon(daemonId: string) {
    return this.fetch<DaemonForgeCollectResponse>("/daemon-forge/collect", {
      method: "POST",
      body: JSON.stringify({ daemonId }),
    });
  }

  scrapDaemon(daemonId: string) {
    return this.fetch<{ success: boolean }>(`/daemon-forge/${daemonId}`, {
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
