import { Modal } from "@/components/Modal";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function SandboxExitModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const { setPlayer } = useAuthStore();
  const queryClient = useQueryClient();
  const [exiting, setExiting] = useState(false);
  const [error, setError] = useState("");

  const open = activeModal === "sandbox_exit";

  const handleExit = async () => {
    setExiting(true);
    setError("");
    try {
      const result = await api.exitSandbox();
      setPlayer(result.player);
      queryClient.invalidateQueries({ queryKey: ["player"] });
      closeModal();
    } catch (err: any) {
      setError(err.message ?? "Failed to exit sandbox");
    } finally {
      setExiting(false);
    }
  };

  return (
    <Modal open={open} onClose={closeModal} title="EXIT SANDBOX">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 border border-cyber-yellow/30 bg-cyber-yellow/5 rounded">
          <AlertTriangle size={16} className="text-cyber-yellow shrink-0 mt-0.5" />
          <div className="text-xs text-text-secondary space-y-2">
            <p>
              Exiting sandbox mode is <span className="text-cyber-yellow font-semibold">permanent</span>.
              Once you leave, you cannot return.
            </p>
            <p>
              Outside the sandbox, your AI is exposed to PvP combat. Other players can attack you,
              damage your systems, and steal resources.
            </p>
            <p>
              If 3 or more systems reach CORRUPTED status, your AI will die and you must mint a new one.
            </p>
          </div>
        </div>

        {error && (
          <div className="text-cyber-red text-xs">{error}</div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={closeModal}
            className="flex-1 py-2 min-h-[44px] border border-border-default text-text-secondary rounded hover:border-cyber-cyan hover:text-cyber-cyan transition-colors text-sm"
          >
            Stay in Sandbox
          </button>
          <button
            onClick={handleExit}
            disabled={exiting}
            className="flex-1 py-2 min-h-[44px] border border-cyber-red text-cyber-red rounded hover:bg-cyber-red/10 transition-colors disabled:opacity-30 text-sm font-semibold"
          >
            {exiting ? "Exiting..." : "Exit Sandbox"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
