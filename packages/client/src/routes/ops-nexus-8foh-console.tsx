import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth";
import { api, ApiError } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import type { AdminOverviewResponse, AdminStatusResponse } from "@singularities/shared";

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

      {error && (
        <div className="text-cyber-red text-xs border border-cyber-red/30 bg-cyber-red/10 rounded px-3 py-2">
          {error}
        </div>
      )}

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
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border-default rounded p-3 bg-bg-secondary/50">
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="text-lg text-text-primary mt-1">{value}</div>
    </div>
  );
}
