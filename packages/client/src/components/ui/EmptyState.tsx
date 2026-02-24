import type { ReactNode } from "react";
import { CyberButton } from "./CyberButton";

interface EmptyStateProps {
  icon: ReactNode;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ icon, message, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <div className="text-text-muted animate-pulse">
        {icon}
      </div>
      <div className="text-text-muted text-xs font-mono text-center">
        <span className="text-cyber-cyan">&gt;_</span> {message}
      </div>
      {ctaLabel && onCta && (
        <CyberButton size="sm" onClick={onCta}>
          {ctaLabel}
        </CyberButton>
      )}
    </div>
  );
}
