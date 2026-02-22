import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth";
import { api, ApiError } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import type {
  AdminOverviewResponse,
  AdminStatusResponse,
  AdminPlayerDetailResponse,
  AdminPlayerSearchResponse,
  AdminEconomyResponse,
} from "@singularities/shared";

type AdminTab = "dashboard" | "player" | "economy";

export const Route = createFileRoute("/ops-nexus-8foh-console")({
  component: AdminPage,
});

function AdminPage() {
  const { isAuthenticated } = useAuthStore();
  const hasStoredToken = Boolean(api.getToken());
  const [status, setStatus] = useState<AdminStatusResponse | null>(null);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [botPreviewLevel, setBotPreviewLevel] = useState(12);
  const [previewBots, setPreviewBots] = useState<Array<{
    id: string;
    aiName: string;
    level: number;
    reputation: number;
    playstyle: string;
    alignment: number;
    isBot?: boolean;
    botTier?: "novice" | "adaptive" | "elite";
    disclosureLabel?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"none" | "refresh" | "bot_toggle" | "season_end">("none");
  const [toggleNote, setToggleNote] = useState("");
  const [seasonReason, setSeasonReason] = useState("");
  const [seasonConfirm, setSeasonConfirm] = useState("");

  // Tab
  const [tab, setTab] = useState<AdminTab>("dashboard");

  // Player Lookup
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerResults, setPlayerResults] = useState<AdminPlayerSearchResponse["players"]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<AdminPlayerDetailResponse | null>(null);
  const [playerSearching, setPlayerSearching] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [grantForm, setGrantForm] = useState({ credits: 0, data: 0, processingPower: 0, xp: 0, reason: "" });
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantResult, setGrantResult] = useState("");

  // Economy
  const [economy, setEconomy] = useState<AdminEconomyResponse | null>(null);
  const [economyLoading, setEconomyLoading] = useState(false);

  const canEndSeason = seasonConfirm.trim() === "END SEASON";

  const botMatchSharePercent = useMemo(() => {
    if (!overview) return "0.0";
    return (overview.metrics.botMatchShareToday * 100).toFixed(1);
  }, [overview]);

  const loadAll = async () => {
    setError("");
    setForbidden("");
    setLoading(true);
    try {
      const [statusRes, overviewRes, previewRes] = await Promise.all([
        api.getAdminStatus(),
        api.getAdminOverview(),
        api.getAdminBotPreview(botPreviewLevel),
      ]);
      setStatus(statusRes);
      setOverview(overviewRes);
      setPreviewBots(previewRes.bots);
    } catch (err) {
      if (err instanceof ApiError && (err.statusCode === 403 || err.statusCode === 404)) {
        setForbidden("Admin access is not available for this account or environment.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load admin data");
      }
    } finally {
      setLoading(false);
      setBusy("none");
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const refresh = async () => {
    setBusy("refresh");
    await loadAll();
  };

  const reloadPreview = async () => {
    setError("");
    try {
      const preview = await api.getAdminBotPreview(botPreviewLevel);
      setPreviewBots(preview.bots);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bot preview");
    }
  };

  const toggleBots = async () => {
    if (!overview) return;
    setBusy("bot_toggle");
    setError("");
    try {
      await api.setAdminBotsEnabled({
        enabled: !overview.arenaBots.enabled,
        note: toggleNote.trim() || undefined,
      });
      setToggleNote("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update bot setting");
      setBusy("none");
    }
  };

  const endSeasonNow = async () => {
    if (!canEndSeason) return;
    setBusy("season_end");
    setError("");
    try {
      await api.adminEndSeason({
        confirmation: "END SEASON",
        reason: seasonReason.trim() || undefined,
      });
      setSeasonReason("");
      setSeasonConfirm("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end season");
      setBusy("none");
    }
  };

  // Player search
  const searchPlayers = async () => {
    const q = playerQuery.trim();
    if (!q) return;
    setPlayerSearching(true);
    setError("");
    setSelectedPlayer(null);
    try {
      const res = await api.searchAdminPlayers(q);
      setPlayerResults(res.players);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Player search failed");
    } finally {
      setPlayerSearching(false);
    }
  };

  const loadPlayerDetail = async (id: string) => {
    setPlayerLoading(true);
    setError("");
    setGrantResult("");
    try {
      const detail = await api.getAdminPlayerDetail(id);
      setSelectedPlayer(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load player detail");
    } finally {
      setPlayerLoading(false);
    }
  };

  const submitGrant = async () => {
    if (!selectedPlayer || !grantForm.reason.trim()) return;
    setGrantBusy(true);
    setGrantResult("");
    setError("");
    try {
      const res = await api.adminGrantResources(selectedPlayer.player.id, {
        credits: grantForm.credits || undefined,
        data: grantForm.data || undefined,
        processingPower: grantForm.processingPower || undefined,
        xp: grantForm.xp || undefined,
        reason: grantForm.reason.trim(),
      });
      setGrantResult(
        `Granted. New totals — CR: ${res.newTotals.credits}, DATA: ${res.newTotals.data}, PP: ${res.newTotals.processingPower}, XP: ${res.newTotals.xp}`
      );
      setGrantForm({ credits: 0, data: 0, processingPower: 0, xp: 0, reason: "" });
      // Refresh player detail
      await loadPlayerDetail(selectedPlayer.player.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant resources");
    } finally {
      setGrantBusy(false);
    }
  };

  // Economy
  const loadEconomy = async () => {
    setEconomyLoading(true);
    setError("");
    try {
      const res = await api.getAdminEconomy();
      setEconomy(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load economy data");
    } finally {
      setEconomyLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "economy" && !economy && !economyLoading) {
      loadEconomy().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!isAuthenticated && hasStoredToken) {
    return (
      <div className="max-w-4xl mx-auto py-6">
        <p className="text-text-secondary text-sm">Restoring session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-6">
        <p className="text-text-secondary text-sm">Loading admin console...</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="max-w-3xl mx-auto py-6 space-y-4">
        <h1 className="text-xl font-semibold text-cyber-red">ADMIN CONSOLE</h1>
        <p className="text-text-secondary text-sm">{forbidden}</p>
        <Link to="/game" className="text-cyber-cyan text-sm hover:underline">
          Return to network
        </Link>
      </div>
    );
  }

  if (!status || !overview) {
    return (
      <div className="max-w-4xl mx-auto py-6">
        <p className="text-cyber-red text-sm">Admin data unavailable.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-cyber-cyan">ADMIN CONSOLE</h1>
          <p className="text-text-muted text-xs mt-1">
            Actor {status.actor.playerId.slice(0, 8)}... | Server {new Date(status.serverTime).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/game" className="px-3 py-2 text-xs border border-border-default rounded text-text-secondary hover:text-text-primary">
            Back to Game
          </Link>
          <button
            onClick={refresh}
            disabled={busy !== "none"}
            className="px-3 py-2 text-xs border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 disabled:opacity-40"
          >
            {busy === "refresh" ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-border-default">
        {(["dashboard", "player", "economy"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium border border-b-0 rounded-t transition-colors ${
              tab === t
                ? "border-cyber-cyan text-cyber-cyan bg-bg-secondary/60"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            {t === "dashboard" ? "Dashboard" : t === "player" ? "Player Lookup" : "Economy"}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-cyber-red text-xs border border-cyber-red/30 bg-cyber-red/10 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Dashboard Tab */}
      {tab === "dashboard" && (
        <>
          <div className="grid md:grid-cols-4 gap-3">
            <MetricCard label="Alive Players" value={overview.metrics.alivePlayers} />
            <MetricCard label="Active (24h)" value={overview.metrics.activePlayers24h} />
            <MetricCard label="Arena Opt-ins" value={overview.metrics.inArenaNow} />
            <MetricCard label="Deaths Today" value={overview.metrics.deathsToday} />
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <MetricCard label="Hacks Today" value={overview.metrics.hacksToday} />
            <MetricCard label="PvP (Human)" value={overview.metrics.pvpHumanToday} />
            <MetricCard label="PvP (Bot)" value={overview.metrics.pvpBotToday} />
            <MetricCard label="Bot Share" value={`${botMatchSharePercent}%`} />
          </div>

          <section className="border border-border-default rounded p-4 bg-bg-secondary/60 space-y-3">
            <h2 className="text-sm font-semibold text-cyber-amber">Arena Bots</h2>
            <div className="text-xs text-text-secondary grid md:grid-cols-5 gap-2">
              <span>Enabled: {overview.arenaBots.enabled ? "Yes" : "No"}</span>
              <span>Target Floor: {overview.arenaBots.targetOpponentFloor}</span>
              <span>Max Backfill: {overview.arenaBots.maxBackfillPerRequest}</span>
              <span>Bot Cap/Day: {overview.arenaBots.maxAttacksPerDay}</span>
              <span>Max Level: {overview.arenaBots.maxPlayerLevel}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={toggleNote}
                onChange={(e) => setToggleNote(e.target.value)}
                placeholder="Optional admin note"
                className="bg-bg-primary border border-border-default rounded px-2 py-1.5 text-xs min-w-[220px]"
              />
              <button
                onClick={toggleBots}
                disabled={busy !== "none"}
                className="px-3 py-2 text-xs border border-cyber-amber text-cyber-amber rounded hover:bg-cyber-amber/10 disabled:opacity-40"
              >
                {busy === "bot_toggle"
                  ? "Applying..."
                  : overview.arenaBots.enabled ? "Disable Bots" : "Enable Bots"}
              </button>
            </div>
          </section>

          <section className="border border-border-default rounded p-4 bg-bg-secondary/60 space-y-3">
            <h2 className="text-sm font-semibold text-cyber-green">Bot Preview</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-text-secondary">Player Level</label>
              <input
                type="number"
                min={1}
                max={100}
                value={botPreviewLevel}
                onChange={(e) => setBotPreviewLevel(Number(e.target.value))}
                className="w-24 bg-bg-primary border border-border-default rounded px-2 py-1.5 text-xs"
              />
              <button
                onClick={reloadPreview}
                className="px-3 py-2 text-xs border border-cyber-green text-cyber-green rounded hover:bg-cyber-green/10"
              >
                Reload Preview
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {previewBots.map((bot) => (
                <div key={bot.id} className="border border-border-default rounded px-3 py-2 text-xs">
                  <div className="text-text-primary">{bot.aiName}</div>
                  <div className="text-text-muted mt-1">
                    LVL {bot.level} | {bot.playstyle} | REP {bot.reputation}
                    {bot.botTier ? ` | ${bot.botTier.toUpperCase()}` : ""}
                  </div>
                </div>
              ))}
              {previewBots.length === 0 && (
                <div className="text-text-muted text-xs">No preview bots.</div>
              )}
            </div>
          </section>

          <section className="border border-border-default rounded p-4 bg-bg-secondary/60 space-y-3">
            <h2 className="text-sm font-semibold text-cyber-magenta">Season Control</h2>
            <p className="text-xs text-text-secondary">
              Current season: {overview.season ? `${overview.season.name} (ends ${new Date(overview.season.endsAt).toLocaleString()})` : "No active season"}
            </p>
            <input
              value={seasonReason}
              onChange={(e) => setSeasonReason(e.target.value)}
              placeholder="Reason for ending season"
              className="w-full max-w-lg bg-bg-primary border border-border-default rounded px-2 py-1.5 text-xs"
            />
            <input
              value={seasonConfirm}
              onChange={(e) => setSeasonConfirm(e.target.value)}
              placeholder='Type END SEASON to confirm'
              className="w-full max-w-lg bg-bg-primary border border-cyber-red/40 rounded px-2 py-1.5 text-xs"
            />
            <button
              onClick={endSeasonNow}
              disabled={!canEndSeason || busy !== "none"}
              className="px-3 py-2 text-xs border border-cyber-red text-cyber-red rounded hover:bg-cyber-red/10 disabled:opacity-40"
            >
              {busy === "season_end" ? "Ending..." : "End Season Now"}
            </button>
          </section>

          <section className="border border-border-default rounded p-4 bg-bg-secondary/60 space-y-2">
            <h2 className="text-sm font-semibold text-cyber-cyan">Recent Admin Actions</h2>
            {overview.recentAdminActions.length === 0 ? (
              <p className="text-xs text-text-muted">No admin actions logged.</p>
            ) : (
              overview.recentAdminActions.map((entry) => (
                <div key={entry.id} className="text-xs border border-border-default rounded p-2">
                  <div className="text-text-primary">{entry.action}</div>
                  <div className="text-text-muted mt-1">
                    {new Date(entry.createdAt).toLocaleString()} | actor {entry.adminPlayerId.slice(0, 8)}...
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}

      {/* Player Lookup Tab */}
      {tab === "player" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-2">
            <input
              value={playerQuery}
              onChange={(e) => setPlayerQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchPlayers()}
              placeholder="Search by wallet address, AI name, or UUID..."
              className="flex-1 bg-bg-primary border border-border-default rounded px-3 py-2 text-xs"
            />
            <button
              onClick={searchPlayers}
              disabled={playerSearching || !playerQuery.trim()}
              className="px-4 py-2 text-xs border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 disabled:opacity-40"
            >
              {playerSearching ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Results list */}
          {playerResults.length > 0 && (
            <div className="border border-border-default rounded overflow-hidden">
              {playerResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => loadPlayerDetail(p.id)}
                  className={`w-full text-left px-3 py-2 text-xs border-b border-border-default last:border-b-0 hover:bg-bg-secondary/60 transition-colors ${
                    selectedPlayer?.player.id === p.id ? "bg-cyber-cyan/10" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-primary font-medium">{p.aiName}</span>
                    <span className="text-text-muted">LVL {p.level}</span>
                  </div>
                  <div className="text-text-muted mt-0.5">
                    {p.walletAddress.slice(0, 8)}...{p.walletAddress.slice(-4)}
                    {!p.isAlive && <span className="text-cyber-red ml-2">DEAD</span>}
                    {p.isInSandbox && <span className="text-cyber-amber ml-2">SANDBOX</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {playerResults.length === 0 && playerQuery && !playerSearching && (
            <p className="text-text-muted text-xs">No results. Try a different search term.</p>
          )}

          {playerLoading && <p className="text-text-secondary text-xs">Loading player detail...</p>}

          {/* Player Detail */}
          {selectedPlayer && !playerLoading && (
            <PlayerDetailPanel
              detail={selectedPlayer}
              grantForm={grantForm}
              setGrantForm={setGrantForm}
              onGrant={submitGrant}
              grantBusy={grantBusy}
              grantResult={grantResult}
            />
          )}
        </div>
      )}

      {/* Economy Tab */}
      {tab === "economy" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-cyber-cyan">Economy Overview</h2>
            <button
              onClick={loadEconomy}
              disabled={economyLoading}
              className="px-3 py-2 text-xs border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 disabled:opacity-40"
            >
              {economyLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {economyLoading && !economy && (
            <p className="text-text-secondary text-xs">Loading economy data...</p>
          )}

          {economy && <EconomyPanel economy={economy} />}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border-default rounded p-3 bg-bg-secondary/50">
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="text-lg text-text-primary mt-1">{value}</div>
    </div>
  );
}

function PlayerDetailPanel({
  detail,
  grantForm,
  setGrantForm,
  onGrant,
  grantBusy,
  grantResult,
}: {
  detail: AdminPlayerDetailResponse;
  grantForm: { credits: number; data: number; processingPower: number; xp: number; reason: string };
  setGrantForm: (f: typeof grantForm) => void;
  onGrant: () => void;
  grantBusy: boolean;
  grantResult: string;
}) {
  const { player, systems, modules, loadouts, traits, recentActivity } = detail;
  const [openSection, setOpenSection] = useState<"combat" | "infiltration" | "ice" | null>(null);

  const statusColor = (s: string) => {
    switch (s) {
      case "OPTIMAL": return "text-cyber-green";
      case "DEGRADED": return "text-cyber-amber";
      case "CRITICAL": return "text-cyber-red";
      case "CORRUPTED": return "text-cyber-magenta";
      default: return "text-text-muted";
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile Card */}
      <section className="border border-border-default rounded p-4 bg-bg-secondary/60 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{player.aiName}</h3>
          <div className="flex gap-2 text-[10px]">
            {!player.isAlive && <span className="px-2 py-0.5 rounded bg-cyber-red/20 text-cyber-red border border-cyber-red/30">DEAD</span>}
            {player.isInSandbox && <span className="px-2 py-0.5 rounded bg-cyber-amber/20 text-cyber-amber border border-cyber-amber/30">SANDBOX</span>}
            {player.inPvpArena && <span className="px-2 py-0.5 rounded bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30">IN ARENA</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div><span className="text-text-muted">Level:</span> <span className="text-text-primary">{player.level}</span></div>
          <div><span className="text-text-muted">XP:</span> <span className="text-text-primary">{player.xp}</span></div>
          <div><span className="text-text-muted">Credits:</span> <span className="text-text-primary">{player.credits}</span></div>
          <div><span className="text-text-muted">Energy:</span> <span className="text-text-primary">{player.energy}/{player.energyMax}</span></div>
          <div><span className="text-text-muted">PP:</span> <span className="text-text-primary">{player.processingPower}</span></div>
          <div><span className="text-text-muted">Data:</span> <span className="text-text-primary">{player.data}</span></div>
          <div><span className="text-text-muted">Rep:</span> <span className="text-text-primary">{player.reputation}</span></div>
          <div><span className="text-text-muted">Heat:</span> <span className="text-text-primary">{player.heatLevel}</span></div>
          <div><span className="text-text-muted">Alignment:</span> <span className="text-text-primary">{player.alignment.toFixed(2)}</span></div>
          <div><span className="text-text-muted">Wallet:</span> <span className="text-text-primary">{player.walletAddress.slice(0, 12)}...</span></div>
          <div><span className="text-text-muted">Created:</span> <span className="text-text-primary">{new Date(player.createdAt).toLocaleDateString()}</span></div>
          <div><span className="text-text-muted">Last Active:</span> <span className="text-text-primary">{new Date(player.lastActiveAt).toLocaleString()}</span></div>
        </div>
        <div className="text-[10px] text-text-muted mt-1">ID: {player.id}</div>
      </section>

      {/* Systems */}
      <section className="border border-border-default rounded p-4 bg-bg-secondary/60 space-y-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Systems</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {systems.map((s) => (
            <div key={s.systemType} className="border border-border-default rounded p-2 text-xs">
              <div className="text-text-primary font-medium">{s.systemType}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-bg-primary rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${
                      s.health > 70 ? "bg-cyber-green" : s.health > 30 ? "bg-cyber-amber" : "bg-cyber-red"
                    }`}
                    style={{ width: `${s.health}%` }}
                  />
                </div>
                <span className="text-text-muted w-8 text-right">{s.health}%</span>
              </div>
              <div className={`text-[10px] mt-0.5 ${statusColor(s.status)}`}>{s.status}</div>
            </div>
          ))}
          {systems.length === 0 && <div className="text-text-muted text-xs col-span-3">No systems.</div>}
        </div>
      </section>

      {/* Modules */}
      <section className="border border-border-default rounded p-4 bg-bg-secondary/60 space-y-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Modules ({modules.length})</h3>
        {modules.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-xs">
            {modules.map((m) => (
              <div key={m.moduleId} className="border border-border-default rounded px-2 py-1.5">
                <span className="text-text-primary">{m.moduleId}</span>
                <span className="text-text-muted ml-1">LV{m.level}</span>
                {m.mutation && <span className="text-cyber-magenta ml-1">[{m.mutation}]</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-xs">No modules.</p>
        )}
      </section>

      {/* Loadouts */}
      <section className="border border-border-default rounded p-4 bg-bg-secondary/60 space-y-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Loadouts</h3>
        <div className="grid md:grid-cols-3 gap-3 text-xs">
          {(["attack", "defense", "infiltration"] as const).map((type) => {
            const slots = loadouts.filter((l) => l.loadoutType === type).sort((a, b) => a.slot - b.slot);
            return (
              <div key={type} className="border border-border-default rounded p-2">
                <div className="text-text-secondary font-medium uppercase text-[10px] tracking-wide mb-1">{type}</div>
                {[1, 2, 3].map((slot) => {
                  const entry = slots.find((s) => s.slot === slot);
                  return (
                    <div key={slot} className="text-text-muted py-0.5">
                      Slot {slot}: <span className={entry?.moduleId ? "text-text-primary" : ""}>{entry?.moduleId || "empty"}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      {/* Traits */}
      {traits.length > 0 && (
        <section className="border border-border-default rounded p-4 bg-bg-secondary/60 space-y-2">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Traits</h3>
          <div className="flex flex-wrap gap-1">
            {traits.map((t) => (
              <span key={t} className="px-2 py-0.5 text-[10px] rounded border border-cyber-magenta/30 text-cyber-magenta bg-cyber-magenta/10">
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Recent Activity */}
      <section className="border border-border-default rounded p-4 bg-bg-secondary/60 space-y-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Recent Activity</h3>

        {/* Combat */}
        <button
          onClick={() => setOpenSection(openSection === "combat" ? null : "combat")}
          className="w-full text-left text-xs text-text-primary hover:text-cyber-cyan py-1 border-b border-border-default"
        >
          Combat Logs ({recentActivity.combatLogs.length}) {openSection === "combat" ? "[-]" : "[+]"}
        </button>
        {openSection === "combat" && (
          <div className="space-y-1 pl-2">
            {recentActivity.combatLogs.map((c) => (
              <div key={c.id} className="text-[11px] border-l-2 border-border-default pl-2 py-0.5">
                <span className={c.role === "attacker" ? "text-cyber-cyan" : "text-cyber-amber"}>{c.role}</span>
                {" vs "}
                <span className="text-text-muted">{c.opponentId?.slice(0, 8) ?? "bot"}...</span>
                {" — "}
                <span className={c.result === "attacker_win" ? "text-cyber-green" : "text-cyber-red"}>{c.result}</span>
                <span className="text-text-muted"> | CR:{c.creditsTransferred} XP:{c.xpAwarded}</span>
                {c.isBotMatch && <span className="text-cyber-amber"> [BOT]</span>}
                <span className="text-text-muted block">{new Date(c.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {recentActivity.combatLogs.length === 0 && <p className="text-text-muted text-[11px]">No combat logs.</p>}
          </div>
        )}

        {/* Infiltration */}
        <button
          onClick={() => setOpenSection(openSection === "infiltration" ? null : "infiltration")}
          className="w-full text-left text-xs text-text-primary hover:text-cyber-cyan py-1 border-b border-border-default"
        >
          Infiltration Logs ({recentActivity.infiltrationLogs.length}) {openSection === "infiltration" ? "[-]" : "[+]"}
        </button>
        {openSection === "infiltration" && (
          <div className="space-y-1 pl-2">
            {recentActivity.infiltrationLogs.map((l) => (
              <div key={l.id} className="text-[11px] border-l-2 border-border-default pl-2 py-0.5">
                <span className="text-text-primary">{l.targetType}</span>
                <span className="text-text-muted"> SEC:{l.securityLevel}</span>
                {" — "}
                <span className={l.success ? "text-cyber-green" : "text-cyber-red"}>{l.success ? "SUCCESS" : "FAILED"}</span>
                <span className="text-text-muted"> | CR:{l.creditsEarned}</span>
                {l.gameType && <span className="text-text-muted"> ({l.gameType})</span>}
                <span className="text-text-muted block">{new Date(l.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {recentActivity.infiltrationLogs.length === 0 && <p className="text-text-muted text-[11px]">No infiltration logs.</p>}
          </div>
        )}

        {/* ICE Breaker */}
        <button
          onClick={() => setOpenSection(openSection === "ice" ? null : "ice")}
          className="w-full text-left text-xs text-text-primary hover:text-cyber-cyan py-1 border-b border-border-default"
        >
          ICE Breaker Logs ({recentActivity.iceBreakerLogs.length}) {openSection === "ice" ? "[-]" : "[+]"}
        </button>
        {openSection === "ice" && (
          <div className="space-y-1 pl-2">
            {recentActivity.iceBreakerLogs.map((l) => (
              <div key={l.id} className="text-[11px] border-l-2 border-border-default pl-2 py-0.5">
                <span className="text-text-muted">Layers: {l.layersCleared}/{l.layersAttempted}</span>
                {" — "}
                <span className={l.extracted ? "text-cyber-green" : "text-cyber-amber"}>{l.extracted ? "EXTRACTED" : "ABORTED"}</span>
                <span className="text-text-muted"> | CR:{l.creditsEarned}</span>
                <span className="text-text-muted block">{new Date(l.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {recentActivity.iceBreakerLogs.length === 0 && <p className="text-text-muted text-[11px]">No ICE breaker logs.</p>}
          </div>
        )}
      </section>

      {/* Grant Resources */}
      <section className="border border-cyber-green/30 rounded p-4 bg-bg-secondary/60 space-y-3">
        <h3 className="text-xs font-semibold text-cyber-green uppercase tracking-wide">Grant Resources</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">Credits</label>
            <input
              type="number"
              value={grantForm.credits}
              onChange={(e) => setGrantForm({ ...grantForm, credits: Number(e.target.value) })}
              className="w-full bg-bg-primary border border-border-default rounded px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">Data</label>
            <input
              type="number"
              value={grantForm.data}
              onChange={(e) => setGrantForm({ ...grantForm, data: Number(e.target.value) })}
              className="w-full bg-bg-primary border border-border-default rounded px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">Processing Power</label>
            <input
              type="number"
              value={grantForm.processingPower}
              onChange={(e) => setGrantForm({ ...grantForm, processingPower: Number(e.target.value) })}
              className="w-full bg-bg-primary border border-border-default rounded px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">XP</label>
            <input
              type="number"
              value={grantForm.xp}
              onChange={(e) => setGrantForm({ ...grantForm, xp: Number(e.target.value) })}
              className="w-full bg-bg-primary border border-border-default rounded px-2 py-1.5 text-xs"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-text-muted block mb-0.5">Reason (required)</label>
          <input
            value={grantForm.reason}
            onChange={(e) => setGrantForm({ ...grantForm, reason: e.target.value })}
            placeholder="e.g. Bug compensation, contest prize..."
            className="w-full bg-bg-primary border border-border-default rounded px-2 py-1.5 text-xs"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onGrant}
            disabled={grantBusy || !grantForm.reason.trim() || (grantForm.credits === 0 && grantForm.data === 0 && grantForm.processingPower === 0 && grantForm.xp === 0)}
            className="px-4 py-2 text-xs border border-cyber-green text-cyber-green rounded hover:bg-cyber-green/10 disabled:opacity-40"
          >
            {grantBusy ? "Granting..." : "Grant Resources"}
          </button>
          {grantResult && <span className="text-cyber-green text-xs">{grantResult}</span>}
        </div>
      </section>
    </div>
  );
}

function EconomyPanel({ economy }: { economy: AdminEconomyResponse }) {
  const { circulation, flowToday, flowWeek, levelDistribution, modulePopularity } = economy;

  const maxLevelCount = Math.max(...levelDistribution.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      {/* Circulation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total Credits" value={circulation.totalCredits.toLocaleString()} />
        <MetricCard label="Total Data" value={circulation.totalData.toLocaleString()} />
        <MetricCard label="Total PP" value={circulation.totalProcessingPower.toLocaleString()} />
        <MetricCard label="Total Reputation" value={circulation.totalReputation.toLocaleString()} />
        <MetricCard label="Avg Credits/Player" value={circulation.avgCreditsPerPlayer.toLocaleString()} />
        <MetricCard label="Avg Level" value={circulation.avgLevelPerPlayer} />
        <MetricCard label="Alive Players" value={circulation.alivePlayers} />
      </div>

      {/* Inflow comparison */}
      <div className="grid md:grid-cols-2 gap-3">
        <section className="border border-border-default rounded p-4 bg-bg-secondary/60 space-y-2">
          <h3 className="text-xs font-semibold text-cyber-cyan uppercase tracking-wide">Inflow Today</h3>
          <div className="text-xs space-y-1">
            <div className="flex justify-between"><span className="text-text-muted">Infiltration</span><span className="text-text-primary">{flowToday.creditsFromInfiltration.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">PvP</span><span className="text-text-primary">{flowToday.creditsFromPvp.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">ICE Breaker</span><span className="text-text-primary">{flowToday.creditsFromIceBreaker.toLocaleString()}</span></div>
            <div className="flex justify-between border-t border-border-default pt-1 mt-1"><span className="text-text-secondary font-medium">Total</span><span className="text-cyber-cyan font-medium">{flowToday.totalCreditsEarned.toLocaleString()}</span></div>
          </div>
        </section>
        <section className="border border-border-default rounded p-4 bg-bg-secondary/60 space-y-2">
          <h3 className="text-xs font-semibold text-cyber-cyan uppercase tracking-wide">Inflow This Week</h3>
          <div className="text-xs space-y-1">
            <div className="flex justify-between"><span className="text-text-muted">Infiltration</span><span className="text-text-primary">{flowWeek.creditsFromInfiltration.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">PvP</span><span className="text-text-primary">{flowWeek.creditsFromPvp.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">ICE Breaker</span><span className="text-text-primary">{flowWeek.creditsFromIceBreaker.toLocaleString()}</span></div>
            <div className="flex justify-between border-t border-border-default pt-1 mt-1"><span className="text-text-secondary font-medium">Total</span><span className="text-cyber-cyan font-medium">{flowWeek.totalCreditsEarned.toLocaleString()}</span></div>
          </div>
        </section>
      </div>

      {/* Level Distribution */}
      <section className="border border-border-default rounded p-4 bg-bg-secondary/60 space-y-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Level Distribution</h3>
        {levelDistribution.length > 0 ? (
          <div className="space-y-1">
            {levelDistribution.map((d) => (
              <div key={d.level} className="flex items-center gap-2 text-xs">
                <span className="text-text-muted w-12 text-right">LV {d.level}</span>
                <div className="flex-1 h-3 bg-bg-primary rounded overflow-hidden">
                  <div
                    className="h-full bg-cyber-cyan/60 rounded"
                    style={{ width: `${(d.count / maxLevelCount) * 100}%` }}
                  />
                </div>
                <span className="text-text-muted w-8">{d.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-xs">No data.</p>
        )}
      </section>

      {/* Module Popularity */}
      <section className="border border-border-default rounded p-4 bg-bg-secondary/60 space-y-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Module Popularity (Top 20)</h3>
        {modulePopularity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted text-left border-b border-border-default">
                  <th className="py-1 pr-3">Module</th>
                  <th className="py-1 pr-3 text-right">Owners</th>
                  <th className="py-1 pr-3 text-right">Avg Level</th>
                  <th className="py-1 text-right">Mutated</th>
                </tr>
              </thead>
              <tbody>
                {modulePopularity.map((m) => (
                  <tr key={m.moduleId} className="border-b border-border-default/50">
                    <td className="py-1 pr-3 text-text-primary">{m.moduleId}</td>
                    <td className="py-1 pr-3 text-right text-text-secondary">{m.owners}</td>
                    <td className="py-1 pr-3 text-right text-text-secondary">{m.avgLevel}</td>
                    <td className="py-1 text-right text-cyber-magenta">{m.mutatedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-muted text-xs">No data.</p>
        )}
      </section>

      <p className="text-text-muted text-[10px]">Generated at {new Date(economy.generatedAt).toLocaleString()}</p>
    </div>
  );
}
