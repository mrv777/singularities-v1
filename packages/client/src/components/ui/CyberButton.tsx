import { forwardRef, type ButtonHTMLAttributes } from "react";
import { useUITier } from "@/hooks/useUITier";

type Variant = "primary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface CyberButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const sizeClasses: Record<Size, string> = {
  sm: "text-xs py-1.5 px-3",
  md: "text-sm py-2.5 px-4",
  lg: "text-base py-3 px-6",
};

const variantClasses: Record<Variant, string> = {
  primary:
    "border-cyber-cyan text-cyber-cyan hover:bg-cyber-cyan/10",
  danger:
    "border-cyber-red text-cyber-red hover:bg-cyber-red/10",
  ghost:
    "border-transparent text-text-secondary hover:bg-white/5 hover:text-text-primary",
};

const glowByTier: Record<number, Record<Variant, string>> = {
  1: { primary: "", danger: "", ghost: "" },
  2: {
    primary: "hover:shadow-[0_0_8px_color-mix(in_srgb,var(--color-cyber-cyan)_20%,transparent)]",
    danger: "hover:shadow-[0_0_8px_color-mix(in_srgb,var(--color-cyber-red)_20%,transparent)]",
    ghost: "",
  },
  3: {
    primary: "hover:shadow-[0_0_12px_color-mix(in_srgb,var(--color-cyber-cyan)_30%,transparent)]",
    danger: "hover:shadow-[0_0_12px_color-mix(in_srgb,var(--color-cyber-red)_30%,transparent)]",
    ghost: "",
  },
};

export const CyberButton = forwardRef<HTMLButtonElement, CyberButtonProps>(
  ({ variant = "primary", size = "md", className = "", disabled, children, ...rest }, ref) => {
    const { tier } = useUITier();

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={[
          "border rounded font-semibold tracking-wider transition-colors",
          sizeClasses[size],
          variantClasses[variant],
          glowByTier[tier]?.[variant] ?? "",
          disabled ? "opacity-30 cursor-not-allowed pointer-events-none" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

CyberButton.displayName = "CyberButton";
