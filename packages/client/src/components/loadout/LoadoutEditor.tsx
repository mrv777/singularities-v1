import { Modal } from "@/components/Modal";
import { ModuleSlotPicker } from "@/components/loadout/ModuleSlotPicker";
import { useUIStore } from "@/stores/ui";
import { useGameStore } from "@/stores/game";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";

export function LoadoutEditor() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const { loadout, ownedModules, setLoadout, setOwnedModules } = useGameStore();
  const [editSlots, setEditSlots] = useState<(string | null)[]>([null, null, null]);
  const [saving, setSaving] = useState(false);

  const open = activeModal === "loadout_editor";

  useEffect(() => {
    if (open) {
      api.getLoadoutsByType("infiltration").then((r) => {
        setLoadout(r.loadout);
        const slots = [1, 2, 3].map((s) => {
          const entry = r.loadout.find((l) => l.slot === s);
          return entry?.moduleId ?? null;
        });
        setEditSlots(slots);
      }).catch(() => {});
      api.getModules().then((r) => setOwnedModules(r.owned)).catch(() => {});
    }
  }, [open, setLoadout, setOwnedModules]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await api.updateLoadouts({
        slots: editSlots as [string | null, string | null, string | null],
      });
      setLoadout(result.loadout);
      closeModal();
    } catch (err: any) {
      console.error("Save failed:", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSlotChange = (slotIndex: number, moduleId: string | null) => {
    const updated = [...editSlots];
    updated[slotIndex] = moduleId;
    setEditSlots(updated);
  };

  return (
    <Modal open={open} onClose={closeModal} title="LOADOUT EDITOR">
      <div className="space-y-4">
        <p className="text-text-secondary text-xs">
          Assign modules to your infiltration loadout. 3 slots available.
        </p>

        {[0, 1, 2].map((i) => {
          const disabledModuleIds = new Set(
            editSlots.filter((id, j) => j !== i && id != null) as string[]
          );
          return (
            <ModuleSlotPicker
              key={i}
              slotIndex={i}
              selectedModuleId={editSlots[i]}
              ownedModules={ownedModules}
              onChange={(moduleId) => handleSlotChange(i, moduleId)}
              label="SLOT"
              disabledModuleIds={disabledModuleIds}
            />
          );
        })}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 min-h-[44px] border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 text-sm"
        >
          {saving ? "Saving..." : "Save Loadout"}
        </button>
      </div>
    </Modal>
  );
}
