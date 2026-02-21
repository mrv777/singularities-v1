import { useGameStore } from "@/stores/game";
import { useUIStore } from "@/stores/ui";
import { MODULE_MAP } from "@singularities/shared";

export function LoadoutPreview() {
  const loadout = useGameStore((s) => s.loadout);
  const ownedModules = useGameStore((s) => s.ownedModules);
  const openModal = useUIStore((s) => s.openModal);

  let totalPower = 0;
  const slots = [1, 2, 3].map((slot) => {
    const entry = loadout.find((l) => l.slot === slot);
    if (!entry?.moduleId) return { slot, module: null, level: 0 };
    const def = MODULE_MAP[entry.moduleId];
    const owned = ownedModules.find((m) => m.moduleId === entry.moduleId);
    const level = owned?.level ?? 1;
    totalPower += level * 5;
    return { slot, module: def, level };
  });

  return (
    <div className="border border-border-default bg-bg-secondary rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-secondary text-xs">LOADOUT</span>
        <div className="flex items-center gap-2">
          <span className="text-cyber-cyan text-xs">
            Power: {totalPower}
          </span>
          <button
            onClick={() => openModal("security_center")}
            className="text-[10px] text-text-muted hover:text-cyber-cyan transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        {slots.map((s) => (
          <div
            key={s.slot}
            className="flex-1 border border-border-default rounded p-2 text-center text-[10px]"
          >
            {s.module ? (
              <>
                <div className="text-text-primary truncate">{s.module.name}</div>
                <div className="text-text-muted">LV {s.level}</div>
              </>
            ) : (
              <div className="text-text-muted">Empty</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
