import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface GlitchTextProps {
  text: string;
  className?: string;
  interval?: number;
}

export function GlitchText({ text, className = "", interval = 3000 }: GlitchTextProps) {
  const [glitching, setGlitching] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setGlitching(true);
      setTimeout(() => setGlitching(false), 200);
    }, interval);
    return () => clearInterval(timer);
  }, [interval]);

  return (
    <div className={`relative inline-block ${className}`}>
      <span className="relative z-10">{text}</span>
      {glitching && (
        <>
          <motion.span
            className="absolute top-0 left-0 z-0 text-cyber-magenta opacity-70"
            initial={{ x: -2 }}
            animate={{ x: 2 }}
            transition={{ repeat: Infinity, duration: 0.1 }}
          >
            {text}
          </motion.span>
          <motion.span
            className="absolute top-0 left-0 z-0 text-cyber-cyan opacity-70"
            initial={{ x: 2 }}
            animate={{ x: -2 }}
            transition={{ repeat: Infinity, duration: 0.1 }}
          >
            {text}
          </motion.span>
        </>
      )}
    </div>
  );
}
