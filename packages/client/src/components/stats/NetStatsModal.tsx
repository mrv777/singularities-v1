import { Modal } from "@/components/Modal";
import { useUIStore } from "@/stores/ui";
import { usePlayer } from "@/hooks/usePlayer";
import { TRAIT_MAP } from "@singularities/shared";
import { ALL_MODULES } from "@singularities/shared";

export function NetStatsModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const { data } = usePlayer();

  const open = activeModal === "network_stats";
  if (!open || !data) return null;

  const { player, modules, traits, passiveIncome } = data;

  const alignmentLabel =
    player.alignment > 0.3
      ? "Benevolent"
      : player.alignment < -0.3
        ? "Domination"
        : "Neutral";

  const alignmentColor =
    player.alignment > 0.3
      ? "text-cyber-green"
      : player.alignment < -0.3
        ? "text-cyber-red"
        : "text-text-secondary";

  return (
    <Modal open={open} onClose={closeModal} title="NETWORK STATS">
      <div className="space-y-5">
        {/* Core Stats */}
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
            Core Stats
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="Level" value={player.level} />
            <Stat label="XP" value={`${player.xp} / ${player.level * 550}`} />
            <Stat label="Credits" value={player.credits} color="text-cyber-green" />
            <Stat label="Data" value={player.data} color="text-cyber-cyan" />
            <Stat label="Processing Power" value={player.processingPower} color="text-cyber-magenta" />
            <Stat label="Reputation" value={player.reputation} />
            <Stat label="Alignment" value={alignmentLabel} color={alignmentColor} />
            <Stat label="Heat Level" value={player.heatLevel} color={player.heatLevel > 50 ? "text-cyber-red" : "text-text-primary"} />
          </div>
        </section>

        {/* Status */}
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
            Status
          </h3>
          <div className="flex flex-wrap gap-2 text-xs">
            {player.isInSandbox ? (
              <Badge label="SANDBOX" color="border-cyber-amber text-cyber-amber" />
            ) : (
              <Badge label="LIVE" color="border-cyber-green text-cyber-green" />
            )}
            {player.inPvpArena && (
              <Badge label="IN ARENA" color="border-cyber-red text-cyber-red" />
            )}
            {player.isAlive ? (
              <Badge label="ALIVE" color="border-cyber-green text-cyber-green" />
            ) : (
              <Badge label="DEAD" color="border-cyber-red text-cyber-red" />
            )}
          </div>
        </section>

        {/* Installed Modules */}
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
            Installed Modules ({modules.length})
          </h3>
          {modules.length === 0 ? (
            <p className="text-text-muted text-xs">No modules installed.</p>
          ) : (
            <div className="space-y-1">
              {modules.map((m) => {
                const def = ALL_MODULES.find((mod) => mod.id === m.moduleId);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-xs border border-border-default rounded px-2 py-1.5"
                  >
                    <span className="text-text-primary">
                      {def?.name ?? m.moduleId}
                    </span>
                    <span className="text-cyber-cyan">LVL {m.level}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Genetic Traits */}
        {traits.length > 0 && (
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
              Genetic Traits
            </h3>
            <div className="space-y-1">
              {traits.map((t) => {
                const def = TRAIT_MAP[t.traitId];
                if (!def) return null;
                return (
                  <div
                    key={t.id}
                    className="border border-border-default rounded px-2 py-1.5 text-xs"
                  >
                    <div className="text-cyber-magenta font-semibold">
                      {def.name}
                    </div>
                    <div className="text-text-muted text-[10px]">
                      {def.description}
                    </div>
                    <div className="flex gap-3 mt-0.5 text-[10px]">
                      <span className="text-cyber-green">
                        +{Math.round(def.positive.modifier * 100)}% {def.positive.stat}
                      </span>
                      <span className="text-cyber-red">
                        {Math.round(def.negative.modifier * 100)}% {def.negative.stat}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Passive Income */}
        {passiveIncome && (
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
              Passive Income (per cycle)
            </h3>
            <div className="flex gap-4 text-xs">
              <span className="text-cyber-green">+{passiveIncome.credits} CR</span>
              <span className="text-cyber-cyan">+{passiveIncome.data} DATA</span>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="border border-border-default rounded px-2 py-1.5">
      <div className="text-text-muted text-[10px]">{label}</div>
      <div className={`font-semibold ${color ?? "text-text-primary"}`}>{value}</div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`border rounded px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {label}
    </span>
  );
}
