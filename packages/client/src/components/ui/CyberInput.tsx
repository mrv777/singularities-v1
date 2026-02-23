import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

interface CyberInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  showCount?: boolean;
}

export const CyberInput = forwardRef<HTMLInputElement, CyberInputProps>(
  ({ label, error, showCount, maxLength, value, className = "", ...rest }, ref) => {
    const len = typeof value === "string" ? value.length : 0;

    return (
      <div>
        {label && (
          <label className="text-text-muted text-[10px] uppercase tracking-wider block mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          value={value}
          maxLength={maxLength}
          className={[
            "w-full bg-bg-primary border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-cyber-cyan focus:outline-none transition-colors",
            error ? "border-cyber-red" : "border-border-default",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        />
        {(error || (showCount && maxLength != null)) && (
          <div className="flex justify-between mt-1">
            {error ? (
              <span className="text-cyber-red text-[10px]">{error}</span>
            ) : (
              <span />
            )}
            {showCount && maxLength != null && (
              <span className="text-text-muted text-[10px]">
                {len}/{maxLength}
              </span>
            )}
          </div>
        )}
      </div>
    );
  },
);

CyberInput.displayName = "CyberInput";
