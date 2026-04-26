import { useEffect, useMemo, useRef } from "react";
import { motion, useMotionValue, useMotionValueEvent } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { Prize } from "@/lib/api";

const SEGMENT_COLORS = [
  ["#FFD85C", "#F59E0B"],
  ["#13C2C2", "#0E9F9F"],
  ["#FF4081", "#D81B60"],
  ["#7C3AED", "#5B21B6"],
  ["#10B981", "#059669"],
  ["#F97316", "#C2410C"],
  ["#3B82F6", "#1D4ED8"],
  ["#EC4899", "#BE185D"],
];

interface SpinWheelProps {
  prizes: Prize[];
  rotation: number;
  isSpinning: boolean;
  isLoading: boolean;
  onAnimationComplete: () => void;
  onTick?: () => void;
}

export function SpinWheel({
  prizes,
  rotation,
  isSpinning,
  isLoading,
  onAnimationComplete,
  onTick,
}: SpinWheelProps) {
  const count = Math.max(prizes.length, 1);
  const segAngle = 360 / count;
  const lastSegmentRef = useRef<number>(-1);
  const motionRotation = useMotionValue(rotation);

  useMotionValueEvent(motionRotation, "change", (latest) => {
    if (!onTick) return;
    const seg = Math.floor(((latest % 360) + 360) / segAngle) % count;
    if (lastSegmentRef.current !== seg) {
      if (lastSegmentRef.current !== -1) onTick();
      lastSegmentRef.current = seg;
    }
  });

  const conic = useMemo(() => {
    if (count === 1) return SEGMENT_COLORS[0][0];
    const stops: string[] = [];
    for (let i = 0; i < count; i++) {
      const [c] = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      const start = i * segAngle;
      const end = (i + 1) * segAngle;
      stops.push(`${c} ${start}deg ${end}deg`);
    }
    return `conic-gradient(from -${segAngle / 2}deg, ${stops.join(", ")})`;
  }, [count, segAngle]);

  const radius = 50;

  const transition = isLoading
    ? { duration: 2, ease: "linear" as const, repeat: Infinity }
    : isSpinning
    ? { duration: 5, ease: [0.15, 0, 0.15, 1] as [number, number, number, number] }
    : { duration: 0 };

  // Decorative LED dots around the rim
  const ledCount = 24;
  const leds = useMemo(
    () =>
      Array.from({ length: ledCount }, (_, i) => {
        const angle = (i / ledCount) * 360;
        const a = ((angle - 90) * Math.PI) / 180;
        const x = 50 + 47 * Math.cos(a);
        const y = 50 + 47 * Math.sin(a);
        return { x, y, i };
      }),
    [],
  );

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[500px]">
      {/* Pulsing radial halo behind the wheel */}
      <motion.div
        className="absolute -inset-6 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, rgba(255,216,92,0.45) 0%, rgba(19,194,194,0.25) 40%, transparent 70%)",
        }}
        animate={{
          scale: isSpinning ? [1, 1.08, 1] : [1, 1.04, 1],
          opacity: isSpinning ? [0.7, 1, 0.7] : [0.45, 0.65, 0.45],
        }}
        transition={{
          duration: isSpinning ? 1.2 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Outer dark ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, #4a3a8a, #1A0E4D 70%, #0B0520)",
          boxShadow:
            "0 0 60px rgba(255,216,92,0.35), 0 0 0 6px rgba(255,216,92,0.18), inset 0 6px 20px rgba(0,0,0,0.7)",
        }}
      />

      {/* LED dots ring */}
      <div className="absolute inset-0 pointer-events-none">
        {leds.map((led) => (
          <motion.div
            key={led.i}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${led.x}%`,
              top: `${led.y}%`,
              background: led.i % 2 === 0 ? "#FFD85C" : "#13C2C2",
              boxShadow: `0 0 8px ${led.i % 2 === 0 ? "#FFD85C" : "#13C2C2"}`,
            }}
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{
              duration: isSpinning ? 0.4 : 1.6,
              repeat: Infinity,
              delay: (led.i % 6) * 0.08,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Wheel */}
      <div className="absolute inset-[5%] rounded-full border-[6px] border-slate-900 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.45),inset_0_0_30px_rgba(0,0,0,0.5)]">
        <motion.div
          className="relative h-full w-full rounded-full"
          style={{ background: conic, rotate: motionRotation }}
          animate={{ rotate: rotation }}
          transition={transition}
          onAnimationComplete={() => {
            if (isSpinning) onAnimationComplete();
          }}
        >
          {/* Segment labels */}
          {prizes.map((prize, i) => {
            const angle = i * segAngle + segAngle / 2;
            const rad = ((angle - 90) * Math.PI) / 180;
            const x = 50 + radius * 0.62 * Math.cos(rad);
            const y = 50 + radius * 0.62 * Math.sin(rad);
            return (
              <div
                key={`${prize.PrizeName}-${i}`}
                className="absolute flex flex-col items-center justify-center text-center"
                style={{
                  top: `${y}%`,
                  left: `${x}%`,
                  transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                  width: "30%",
                }}
              >
                <div className="text-[clamp(1.4rem,4.2vmin,2.5rem)] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                  {prize.Emoji}
                </div>
                <div className="text-[clamp(0.5rem,1.4vmin,0.85rem)] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] leading-tight px-1">
                  {prize.PrizeName}
                </div>
              </div>
            );
          })}

          {/* Segment dividers */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {Array.from({ length: count }).map((_, i) => {
              const a = (i * segAngle - 90) * (Math.PI / 180);
              const x = 50 + 50 * Math.cos(a);
              const y = 50 + 50 * Math.sin(a);
              return (
                <line
                  key={i}
                  x1="50"
                  y1="50"
                  x2={x}
                  y2={y}
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="0.35"
                />
              );
            })}
          </svg>
        </motion.div>
      </div>

      {/* Center hub */}
      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          animate={{ rotate: isSpinning ? 360 : 0 }}
          transition={
            isSpinning
              ? { duration: 1.5, repeat: Infinity, ease: "linear" }
              : { duration: 0 }
          }
          className="flex h-[18%] aspect-square min-h-14 min-w-14 items-center justify-center rounded-full text-[#0B0520] shadow-[0_0_25px_rgba(255,216,92,0.9)] ring-4 ring-[#0B0520]"
          style={{
            background: "linear-gradient(135deg, #FFD85C, #13C2C2)",
          }}
        >
          <Sparkles className="h-1/2 w-1/2" strokeWidth={2.5} />
        </motion.div>
      </div>

      {/* Pointer at 12 o'clock */}
      <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
        <motion.div
          animate={{ y: isSpinning ? [0, -3, 0] : 0 }}
          transition={{
            duration: 0.15,
            repeat: isSpinning ? Infinity : 0,
            ease: "easeInOut",
          }}
          className="relative"
          style={{ filter: "drop-shadow(0 0 12px rgba(255,216,92,0.95))" }}
        >
          <div
            className="h-12 w-10"
            style={{
              background: "linear-gradient(180deg, #FFD85C 0%, #F59E0B 100%)",
              clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)",
            }}
          />
          <div
            className="absolute left-1/2 top-1 h-3 w-3 -translate-x-1/2 rounded-full"
            style={{
              background: "#fff",
              boxShadow: "0 0 8px #fff",
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
