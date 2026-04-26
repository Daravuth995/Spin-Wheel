import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  User,
  Trophy,
  Coins,
  Flame,
  LogIn,
  Loader2,
  PartyPopper,
  Target,
  CheckCircle2,
  AlertTriangle,
  X,
  Volume2,
  VolumeX,
  ChevronDown,
} from "lucide-react";
import {
  getRestrictionMessage,
  getSlotConfig,
  handleCardGame,
  login as apiLogin,
  type Prize,
} from "@/lib/api";
import {
  loadHistory,
  pushHistory,
  clearHistory,
  type HistoryEntry,
} from "@/lib/history";
import {
  isMuted,
  setMuted,
  playTick,
  playWin,
  playJackpot,
  playSpinStart,
} from "@/lib/sound";
import { SpinWheel } from "@/components/SpinWheel";
import { Confetti } from "@/components/Confetti";
import { HistoryPanel } from "@/components/HistoryPanel";

const REVOLUTIONS = 6;

interface WinState {
  message: string;
  isJackpot: boolean;
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const duration = 700;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span>{display}</span>;
}

export function LuckySpin() {
  // Auth
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  // Profile
  const [studentName, setStudentName] = useState("");
  const [points, setPoints] = useState(0);

  // Game
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [spinCost, setSpinCost] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [winState, setWinState] = useState<WinState | null>(null);
  const [confettiActive, setConfettiActive] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Modals
  const [showAgreement, setShowAgreement] = useState(false);
  const [restrictionMsg, setRestrictionMsg] = useState("");
  const [showPrizes, setShowPrizes] = useState(false);
  const [muted, setMutedLocal] = useState(false);

  const pendingResultRef = useRef<{
    remaining: number;
    message: string;
    isJackpot: boolean;
    prizeIndex: number;
    emoji: string;
    prize: string;
    change: number;
  } | null>(null);

  const credentialsRef = useRef({ id: "", password: "" });

  function toggleMute() {
    const next = !muted;
    setMutedLocal(next);
    setMuted(next);
  }

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    if (!studentId.trim() || !password.trim()) {
      setLoginError("Please enter both ID and password.");
      return;
    }
    setLoginError("");
    setLoginLoading(true);
    try {
      const data = await apiLogin(studentId.trim(), password.trim());
      if (data.success) {
        const id = studentId.trim();
        credentialsRef.current = { id, password: password.trim() };
        setStudentName(data.name ?? "");
        setPoints(data.points ?? 0);
        setLoggedIn(true);
        setShowAgreement(true);
        setHistory(loadHistory(id));
        loadSlotConfig();
        checkRestriction(id);
      } else {
        setLoginError(data.message ?? "Login failed.");
      }
    } catch {
      setLoginError("Error connecting to server.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function loadSlotConfig() {
    try {
      const cfg = await getSlotConfig();
      setSpinCost(cfg.spinCost);
      setPrizes(cfg.prizes ?? []);
    } catch {
      setStatusMsg("Error loading prize board.");
    }
  }

  async function checkRestriction(id: string) {
    try {
      const r = await getRestrictionMessage(id);
      if (r?.message && r.message.trim() !== "") {
        setRestrictionMsg(r.message);
      }
    } catch {
      // silent
    }
  }

  async function handleSpin() {
    if (isSpinning || isPreloading) return;
    if (spinCost == null || prizes.length === 0) return;
    if (points < spinCost) {
      setStatusMsg("Not enough points to spin!");
      return;
    }

    setStatusMsg("");
    setWinState(null);
    setIsPreloading(true);
    playSpinStart();

    try {
      const data = await handleCardGame(
        credentialsRef.current.id,
        credentialsRef.current.password,
      );

      if (!data.success) {
        setStatusMsg(data.message ?? "Spin failed.");
        setIsPreloading(false);
        return;
      }

      const prizeIndex = prizes.findIndex((p) => p.Emoji === data.emoji);
      if (prizeIndex === -1) {
        setStatusMsg("Prize not found.");
        setIsPreloading(false);
        return;
      }

      const segCount = prizes.length;
      const segAngle = 360 / segCount;
      const jitter = (Math.random() - 0.5) * (segAngle * 0.6);
      const targetWithin = 360 - (prizeIndex * segAngle + segAngle / 2) + jitter;

      const currentMod = ((rotation % 360) + 360) % 360;
      const delta = ((targetWithin - currentMod) % 360 + 360) % 360;
      const next = rotation + REVOLUTIONS * 360 + delta;

      pendingResultRef.current = {
        remaining: data.remaining ?? points - spinCost,
        message:
          (data.change ?? 0) > 0
            ? `You won ${data.prize} (+${data.change} points!)`
            : "Thank you for playing!",
        isJackpot: !!data.hitJackpot,
        prizeIndex,
        emoji: data.emoji ?? "",
        prize: data.prize ?? "",
        change: data.change ?? 0,
      };

      setPoints((p) => p - spinCost);
      setIsPreloading(false);
      setIsSpinning(true);
      setRotation(next);
    } catch {
      setStatusMsg("Error contacting server.");
      setIsPreloading(false);
    }
  }

  function onWheelStop() {
    const r = pendingResultRef.current;
    if (!r) {
      setIsSpinning(false);
      return;
    }
    setIsSpinning(false);
    setStatusMsg("");
    setPoints(r.remaining);
    setWinState({ message: r.message, isJackpot: r.isJackpot });

    if (r.isJackpot) {
      setConfettiActive(true);
      playJackpot();
      setTimeout(() => setConfettiActive(false), 5000);
    } else if (r.change > 0) {
      playWin();
    }

    // Persist to history
    const id = credentialsRef.current.id;
    if (id) {
      const next = pushHistory(id, {
        emoji: r.emoji,
        prize: r.prize,
        change: r.change,
        isJackpot: r.isJackpot,
      });
      setHistory(next);
    }

    pendingResultRef.current = null;
    setTimeout(() => setWinState(null), 3500);
  }

  function tickHaptic() {
    playTick();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(8);
    }
  }

  function handleClearHistory() {
    const id = credentialsRef.current.id;
    if (!id) return;
    clearHistory(id);
    setHistory([]);
  }

  // ----- Render -----

  if (!loggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="glass-strong w-full max-w-md rounded-3xl p-8 text-center shadow-[0_12px_40px_rgba(0,0,0,0.3)] sm:p-10"
        >
          <motion.div
            initial={{ scale: 0.5, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: "linear-gradient(135deg, #FFD85C, #13C2C2)",
              boxShadow: "0 0 30px rgba(255, 216, 92, 0.5)",
            }}
          >
            <Trophy className="h-10 w-10 text-[#0B0520]" />
          </motion.div>

          <h1 className="text-3xl font-extrabold tracking-wider text-gradient-gold">
            LUCKY SPIN
          </h1>
          <p className="mt-1 text-sm text-white/70">Sign in to play</p>

          <form onSubmit={handleLogin} className="mt-7 flex flex-col gap-3">
            <input
              type="text"
              autoComplete="username"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Student ID"
              className="w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-base text-white outline-none transition placeholder:text-white/50 focus:border-[#13C2C2] focus:ring-2 focus:ring-[#13C2C2]/30"
            />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-base text-white outline-none transition placeholder:text-white/50 focus:border-[#13C2C2] focus:ring-2 focus:ring-[#13C2C2]/30"
            />
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loginLoading}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold text-white shadow-[0_6px_20px_rgba(19,194,194,0.4)] transition disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #13C2C2, #0D9488)",
              }}
            >
              {loginLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LogIn className="h-5 w-5" />
              )}
              {loginLoading ? "Signing in..." : "Enter Game"}
            </motion.button>
          </form>

          {loginError && (
            <p className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-200">
              {loginError}
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-3 py-4 sm:px-5 sm:py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass flex w-full flex-col items-stretch gap-2 rounded-2xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.2)] sm:flex-row sm:items-center sm:justify-between sm:p-4"
      >
        <div className="grid grid-cols-3 gap-2 text-center sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:text-left">
          <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/10 bg-black/30 px-2 py-2 sm:flex-row sm:items-center sm:gap-2 sm:px-4 sm:py-2">
            <User className="h-4 w-4 text-[#FFD85C]" />
            <span className="truncate max-w-[80px] text-xs sm:text-sm font-semibold text-white/90 sm:max-w-none">
              {studentName || "Player"}
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/10 bg-black/30 px-2 py-2 sm:flex-row sm:items-center sm:gap-2 sm:px-4 sm:py-2">
            <Trophy className="h-4 w-4 text-[#FFD85C]" />
            <span className="text-xs font-semibold sm:text-sm">
              <span className="text-white/60">Pts </span>
              <span className="font-bold text-[#FFD85C]">
                <AnimatedNumber value={points} />
              </span>
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/10 bg-black/30 px-2 py-2 sm:flex-row sm:items-center sm:gap-2 sm:px-4 sm:py-2">
            <Coins className="h-4 w-4 text-[#FFD85C]" />
            <span className="text-xs font-semibold sm:text-sm">
              <span className="text-white/60">Jackpot </span>
              <span className="font-bold text-[#FFD85C]">350</span>
            </span>
          </div>
        </div>
        <button
          onClick={toggleMute}
          className="flex items-center justify-center gap-2 self-center rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4 text-[#13C2C2]" />
          )}
          <span className="hidden sm:inline">{muted ? "Muted" : "Sound"}</span>
        </button>
      </motion.div>

      {/* Title */}
      <div className="text-center">
        <motion.h1
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-2xl font-extrabold tracking-[2px] text-gradient-gold drop-shadow-[0_0_20px_rgba(255,216,92,0.4)] sm:text-4xl"
        >
          LUCKY SPIN ROYALE
        </motion.h1>
        <p className="text-xs text-white/60 sm:text-sm">
          Spin the wheel and win amazing prizes
        </p>
      </div>

      {/* Main game area: wheel + history */}
      <div className="flex w-full flex-col items-center gap-5 lg:flex-row lg:items-start lg:justify-center lg:gap-8">
        {/* Wheel column */}
        <div className="flex w-full max-w-[500px] flex-col items-center gap-4 lg:w-auto lg:max-w-none">
          {prizes.length > 0 ? (
            <SpinWheel
              prizes={prizes}
              rotation={rotation}
              isSpinning={isSpinning}
              isLoading={isPreloading}
              onAnimationComplete={onWheelStop}
              onTick={tickHaptic}
            />
          ) : (
            <div className="flex aspect-square w-full max-w-[500px] items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-[#FFD85C]" />
            </div>
          )}

          {/* Spin button */}
          <div className="flex w-full flex-col items-center gap-2">
            <motion.button
              onClick={handleSpin}
              whileHover={
                !isSpinning && !isPreloading ? { scale: 1.1 } : undefined
              }
              whileTap={
                !isSpinning && !isPreloading ? { scale: 0.9 } : undefined
              }
              disabled={isSpinning || isPreloading || prizes.length === 0}
              className="relative flex w-full max-w-xs items-center justify-center gap-3 overflow-hidden rounded-full px-10 py-4 text-lg font-bold tracking-wider text-white shadow-[0_8px_25px_rgba(255,64,129,0.5)] transition disabled:opacity-60 sm:text-xl"
              style={{
                background:
                  isSpinning || isPreloading
                    ? "linear-gradient(135deg, #555, #777)"
                    : "linear-gradient(135deg, #FF4081, #D81B60)",
              }}
            >
              {isPreloading || isSpinning ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Flame className="h-6 w-6" />
              )}
              {isPreloading
                ? "PREPARING..."
                : isSpinning
                ? "SPINNING..."
                : "SPIN NOW"}
            </motion.button>

            {spinCost != null && (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-1.5 text-xs">
                <Target className="h-3.5 w-3.5 text-[#FFD85C]" />
                <span className="text-white/70">Cost</span>
                <span className="font-bold text-[#FFD85C]">
                  {spinCost} pt{spinCost !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {statusMsg && (
              <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-2 text-center text-sm font-semibold">
                {statusMsg}
              </div>
            )}
          </div>
        </div>

        {/* History panel */}
        <div className="w-full max-w-[500px] lg:max-w-none">
          <HistoryPanel entries={history} onClear={handleClearHistory} />
        </div>
      </div>

      {/* Compact prize panel (collapsible) */}
      {prizes.length > 0 && (
        <div className="w-full max-w-3xl">
          <button
            onClick={() => setShowPrizes((v) => !v)}
            className="glass flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/[0.08]"
          >
            <span className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#FFD85C]" />
              Prize Board
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70">
                {prizes.length}
              </span>
            </span>
            <motion.span
              animate={{ rotate: showPrizes ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-white/60" />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {showPrizes && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="glass mt-2 grid grid-cols-2 gap-2 rounded-xl p-3 sm:grid-cols-3 md:grid-cols-4">
                  {prizes.map((prize, i) => (
                    <div
                      key={`${prize.PrizeName}-${i}`}
                      className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/25 px-3 py-2"
                    >
                      <span className="text-xl">{prize.Emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-white/90">
                          {prize.PrizeName}
                        </div>
                        <div className="text-[10px] font-bold text-[#FFD85C]">
                          {prize.RewardPoints} pts
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <Confetti active={confettiActive} />

      {/* Win Toast */}
      <AnimatePresence>
        {winState && (
          <motion.div
            key="win-toast"
            initial={{ opacity: 0, y: -40, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="fixed left-1/2 top-1/2 z-[200] flex max-w-[90%] -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-2xl px-6 py-5 text-center text-base font-bold text-[#0B0520] shadow-[0_15px_40px_rgba(0,0,0,0.4)] sm:px-8 sm:py-6 sm:text-lg"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,216,92,0.95), rgba(19,194,194,0.95))",
              border: "1px solid rgba(255,255,255,0.3)",
              backdropFilter: "blur(8px)",
            }}
          >
            <PartyPopper className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />
            {winState.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Jackpot Modal */}
      <AnimatePresence>
        {winState?.isJackpot && (
          <motion.div
            key="jackpot"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-[rgba(11,5,32,0.85)] backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="rounded-3xl border-2 border-white/30 p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] sm:p-10"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,216,92,0.95), rgba(19,194,194,0.95))",
                backdropFilter: "blur(10px)",
              }}
            >
              <h2 className="text-4xl font-extrabold text-[#0B0520] drop-shadow-[0_2px_5px_rgba(255,255,255,0.5)] sm:text-5xl">
                JACKPOT!
              </h2>
              <p className="mt-4 text-xl font-bold text-[#FF4081] drop-shadow-[0_2px_5px_rgba(255,255,255,0.5)] sm:text-2xl">
                +20 BONUS POINTS!
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agreement Modal */}
      <AnimatePresence>
        {showAgreement && (
          <motion.div
            key="agreement"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 px-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-strong w-full max-w-xl rounded-2xl p-6 sm:p-8"
            >
              <h2 className="mb-3 text-xl font-bold text-gradient-gold sm:text-2xl">
                Game Participation Agreement
              </h2>
              <p className="text-sm text-white/80 sm:text-base">
                This game is part of our classroom activities to help you stay
                motivated and improve your English communication skills.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/85 sm:text-base">
                {[
                  "Use your points responsibly and fairly.",
                  "Understand that prizes are randomly given.",
                  "Do not attempt to cheat or abuse the system.",
                  "Respect classroom rules and purpose of this game.",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#13C2C2]" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-white/80 sm:text-base">
                By clicking "I Agree", you accept the terms and may begin
                playing.
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowAgreement(false)}
                className="mt-5 rounded-xl px-6 py-3 font-bold text-white shadow-[0_6px_20px_rgba(19,194,194,0.4)]"
                style={{
                  background: "linear-gradient(to right, #13C2C2, #0D9488)",
                }}
              >
                I Agree
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restriction Overlay */}
      <AnimatePresence>
        {restrictionMsg && (
          <motion.div
            key="restriction"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] flex items-center justify-center bg-[rgba(11,5,32,0.85)] backdrop-blur-md px-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="glass-strong relative w-full max-w-lg rounded-2xl p-6 text-center sm:p-8"
            >
              <button
                onClick={() => setRestrictionMsg("")}
                className="absolute right-3 top-3 rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Dismiss"
              >
                <X className="h-5 w-5" />
              </button>
              <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-[#FF4081]" />
              <p className="text-base font-medium text-white sm:text-lg">
                {restrictionMsg}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Initialize muted state from module
void isMuted;
