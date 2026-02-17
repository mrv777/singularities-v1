import { Modal } from "../Modal";
import { useUIStore } from "@/stores/ui";
import { ScriptCard } from "./ScriptCard";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import {
  SCRIPT_TRIGGERS,
  SCRIPT_ACTIONS,
  MAX_SCRIPTS,
  MAX_ACTIVE_SCRIPTS,
} from "@singularities/shared";
import type { PlayerScript } from "@singularities/shared";
import { Plus } from "lucide-react";

export function ScriptManagerModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const open = activeModal === "script_manager";

  const [scripts, setScripts] = useState<PlayerScript[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [trigger, setTrigger] = useState(SCRIPT_TRIGGERS[0].id);
  const [action, setAction] = useState(SCRIPT_ACTIONS[0].id);
  const [creating, setCreating] = useState(false);

  const loadScripts = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.getScripts();
      setScripts(result.scripts);
    } catch (err: any) {
      setError(err.message || "Failed to load scripts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadScripts();
      setShowCreate(false);
    }
  }, [open]);

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const script = await api.createScript({ triggerCondition: trigger, action });
      setScripts((prev) => [script, ...prev]);
      setShowCreate(false);
    } catch (err: any) {
      setError(err.message || "Failed to create script");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string) => {
    setToggling(id);
    setError("");
    try {
      const updated = await api.activateScript(id);
      setScripts((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err: any) {
      setError(err.message || "Failed to toggle script");
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setError("");
    try {
      await api.deleteScript(id);
      setScripts((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      setError(err.message || "Failed to delete script");
    } finally {
      setDeleting(null);
    }
  };

  const activeCount = scripts.filter((s) => s.isActive).length;

  return (
    <Modal open={open} onClose={closeModal} title="SCRIPT MANAGER" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Stats */}
        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span>
            Scripts: {scripts.length}/{MAX_SCRIPTS} | Active: {activeCount}/{MAX_ACTIVE_SCRIPTS}
          </span>
          <button
            onClick={() => setShowCreate(!showCreate)}
            disabled={scripts.length >= MAX_SCRIPTS}
            className="flex items-center gap-1 min-h-[44px] text-cyber-cyan hover:text-cyber-cyan/80 transition-colors disabled:opacity-30"
          >
            <Plus size={10} />
            New Script
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="border border-cyber-cyan/20 rounded-lg p-3 bg-bg-surface space-y-3">
            <div>
              <label className="text-text-muted text-[10px] uppercase tracking-wider block mb-1">
                Trigger
              </label>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className="w-full bg-bg-primary border border-border-default rounded px-2 py-1.5 min-h-[44px] text-xs text-text-primary"
              >
                {SCRIPT_TRIGGERS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} — {t.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-text-muted text-[10px] uppercase tracking-wider block mb-1">
                Action
              </label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full bg-bg-primary border border-border-default rounded px-2 py-1.5 min-h-[44px] text-xs text-text-primary"
              >
                {SCRIPT_ACTIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {a.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 py-1.5 min-h-[44px] text-xs border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30"
              >
                {creating ? "Creating..." : "Create Script"}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 min-h-[44px] text-xs border border-border-default text-text-muted rounded hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="text-cyber-red text-xs p-2 border border-cyber-red/20 rounded">
            {error}
          </div>
        )}

        {/* Script list */}
        {loading && scripts.length === 0 ? (
          <div className="text-text-muted text-sm text-center py-8">Loading scripts...</div>
        ) : scripts.length === 0 ? (
          <div className="text-text-muted text-sm text-center py-8">
            No scripts created. Scripts automate actions based on triggers.
          </div>
        ) : (
          <div className="space-y-2">
            {scripts.map((script) => (
              <ScriptCard
                key={script.id}
                script={script}
                onToggle={handleToggle}
                onDelete={handleDelete}
                toggling={toggling === script.id}
                deleting={deleting === script.id}
              />
            ))}
          </div>
        )}

        <div className="text-text-muted text-[10px] pt-2 border-t border-border-default">
          Scripts run every 15 minutes. Automated actions operate at 65% efficiency with 50% energy cost.
        </div>
      </div>
    </Modal>
  );
}
