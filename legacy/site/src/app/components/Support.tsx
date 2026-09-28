import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Heart, ExternalLink, QrCode } from "lucide-react";
import { DexMark } from "./DexMark";
import { useSeason } from "./season";
import { Particles } from "./Particles";

const KOFI_URL = "https://ko-fi.com/dexdonation";
const MB_BANK_BIN = "970422";
const MB_BANK_ACCOUNT = "0585739325";
const BANK_QR_MEMO = "dex support";
const BANK_AMOUNT_MARKS = [
  { label: "scan", value: 0 },
  { label: "50k", value: 50000 },
  { label: "100k", value: 100000 },
  { label: "250k", value: 250000 },
  { label: "500k", value: 500000 },
  { label: "1m", value: 1000000 },
  { label: "2m", value: 2000000 },
  { label: "5m", value: 5000000 },
  { label: "10m", value: 10000000 },
];
const MAX_BANK_MARK_INDEX = BANK_AMOUNT_MARKS.length - 1;

function formatVnd(amount: number) {
  return `${amount.toLocaleString("vi-VN")} VND`;
}

function markIndexFromRailPosition(clientX: number, rail: HTMLElement) {
  const rect = rail.getBoundingClientRect();
  const progress = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));

  return Math.round(progress * MAX_BANK_MARK_INDEX);
}

export function Support() {
  const { season } = useSeason();
  const reduceMotion = useReducedMotion();
  const [bankAmountIndex, setBankAmountIndex] = useState(0);
  const bankAmount = BANK_AMOUNT_MARKS[bankAmountIndex].value;
  const bankQrUrl = useMemo(() => {
    const baseUrl = `https://img.vietqr.io/image/${MB_BANK_BIN}-${MB_BANK_ACCOUNT}-qr_only.png`;

    if (bankAmount <= 0) {
      return baseUrl;
    }

    const params = new URLSearchParams({
      amount: String(bankAmount),
      addInfo: BANK_QR_MEMO,
    });

    return `${baseUrl}?${params.toString()}`;
  }, [bankAmount]);
  const bankAmountLabel = bankAmount > 0 ? formatVnd(bankAmount) : "scan only";
  const bankAmountPercent = (bankAmountIndex / MAX_BANK_MARK_INDEX) * 100;
  const setBankAmountFromRail = (clientX: number, rail: HTMLElement) => {
    setBankAmountIndex(markIndexFromRailPosition(clientX, rail));
  };

  return (
    <section id="support" className="relative scroll-mt-20 overflow-hidden border-b border-black/10 bg-white py-16 md:py-24">
      <Particles density={40} intensity={0.5} className="opacity-55" />
      <div
        className="pointer-events-none absolute inset-0 opacity-75"
        style={{ background: season.atmosphere }}
      />
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10">
        <div
          className="cut-control grid grid-cols-1 gap-6 border border-black/15 bg-[#f3f4f6]/90 p-7 md:grid-cols-[1.3fr_1fr] md:gap-10 md:p-12"
          style={{ backdropFilter: "blur(8px)" }}
        >
          <div>
            <div
              className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em]"
              style={{ color: season.accent, fontFamily: "'JetBrains Mono', monospace" }}
            >
              SUPPORT
              <span className="h-px w-8" style={{ background: season.accent, opacity: 0.4 }} />
            </div>
            <h2
              className="text-[#111111]"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 52,
                lineHeight: 0.95,
                letterSpacing: "0",
              }}
            >
              support <DexMark size={54} />.
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-black/60">
              Ko-fi and MB Bank are here if you would like to help fund the next
              project. No pressure.
            </p>

            <div className="mt-8 grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
              <a
                href={KOFI_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="support-tile cut-control group flex items-center justify-between border border-black/12 bg-white p-4 transition hover:border-black/35"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="cut-control grid h-10 w-10 place-items-center"
                    style={{
                      background: season.accent + "20",
                      color: season.accent,
                    }}
                  >
                    <Heart size={16} />
                  </div>
                  <div>
                    <div
                      className="text-[#111111]"
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      Ko-fi
                    </div>
                    <div
                      className="text-[9px] font-semibold uppercase text-black/40"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      support page
                    </div>
                  </div>
                </div>
                <ExternalLink size={14} className="text-black/35 transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-black" />
              </a>

              <div className="group">
                <button
                  type="button"
                  className="support-tile cut-control flex w-full items-center justify-between border border-black/12 bg-white p-4 text-left transition hover:border-black/35 group-focus-within:border-black/35 group-hover:border-black/35"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="cut-control grid h-10 w-10 place-items-center"
                      style={{
                        background: season.accent + "20",
                        color: season.accent,
                      }}
                    >
                      <QrCode size={16} />
                    </div>
                    <div>
                      <div
                        className="text-[#111111]"
                        style={{
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        MB Bank
                      </div>
                      <div
                        className="text-[9px] font-semibold uppercase text-black/40"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        MB Bank - {MB_BANK_ACCOUNT}
                      </div>
                    </div>
                  </div>
                  <span
                    className="text-[9px] font-bold uppercase text-black/40 group-focus-within:text-black/70 group-hover:text-black/70"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {bankAmountLabel}
                  </span>
                </button>

                <div className="grid max-h-0 overflow-hidden opacity-0 transition-all duration-300 group-focus-within:max-h-44 group-focus-within:opacity-100 group-hover:max-h-44 group-hover:opacity-100">
                  <div className="cut-control mt-3 border border-black/12 bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span
                        className="text-[9px] font-bold uppercase text-black/45"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        transfer amount
                      </span>
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.16em]"
                        style={{
                          color: season.accent,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {bankAmountLabel}
                      </span>
                    </div>
                    <div
                      data-testid="bank-amount-rail"
                      role="slider"
                      tabIndex={0}
                      aria-label="MB Bank QR transfer amount"
                      aria-valuemin={0}
                      aria-valuemax={MAX_BANK_MARK_INDEX}
                      aria-valuenow={bankAmountIndex}
                      aria-valuetext={bankAmountLabel}
                      className="relative mt-4 h-14 cursor-pointer select-none outline-none"
                      onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setBankAmountFromRail(event.clientX, event.currentTarget);
                      }}
                      onPointerMove={(event) => {
                        if (event.buttons === 1) {
                          setBankAmountFromRail(event.clientX, event.currentTarget);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                          event.preventDefault();
                          setBankAmountIndex((value) => Math.max(0, value - 1));
                        }
                        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                          event.preventDefault();
                          setBankAmountIndex((value) => Math.min(MAX_BANK_MARK_INDEX, value + 1));
                        }
                        if (event.key === "Home") {
                          event.preventDefault();
                          setBankAmountIndex(0);
                        }
                        if (event.key === "End") {
                          event.preventDefault();
                          setBankAmountIndex(MAX_BANK_MARK_INDEX);
                        }
                      }}
                    >
                      <div className="absolute left-0 right-0 top-4 h-px bg-black/20">
                        <div
                          className="h-px transition-[width] duration-300"
                          style={{
                            background: season.accent,
                            width: `${bankAmountPercent}%`,
                          }}
                        />
                      </div>
                      {BANK_AMOUNT_MARKS.map((mark, index) => {
                        const left = (index / MAX_BANK_MARK_INDEX) * 100;
                        const active = index <= bankAmountIndex;

                        return (
                          <div
                            key={mark.label}
                            className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col items-center"
                            style={{ left: `${left}%` }}
                          >
                            <span
                              className="h-5 w-px"
                              style={{
                                background: active ? season.accent : "rgba(0,0,0,0.22)",
                              }}
                            />
                            <span
                              className="mt-3 text-[8px] font-bold uppercase tracking-[0.08em]"
                              style={{
                                color: active ? season.accent : "rgba(0,0,0,0.38)",
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              {mark.label}
                            </span>
                          </div>
                        );
                      })}
                      <div
                        className="absolute top-4 h-3 w-3 -translate-y-1/2 border border-black/60 transition-[left] duration-300"
                        style={{
                          background: season.accent,
                          left: `calc(${bankAmountPercent}% - 6px)`,
                          boxShadow: `0 0 18px ${season.glow}`,
                        }}
                      />
                      <input
                        aria-label="MB Bank QR transfer amount"
                        type="range"
                        min={0}
                        max={MAX_BANK_MARK_INDEX}
                        step={1}
                        value={bankAmountIndex}
                        onInput={(event) => setBankAmountIndex(Number(event.currentTarget.value))}
                        onChange={(event) => setBankAmountIndex(Number(event.target.value))}
                        className="sr-only"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="cut-control flex flex-col items-center justify-center border border-black/12 bg-white p-6 md:p-8">
            <div
              className="cut-control grid h-52 w-52 place-items-center overflow-hidden border border-black/20 bg-white p-3 text-black"
              style={{ boxShadow: `0 0 60px ${season.glow}` }}
            >
              <motion.img
                key={bankQrUrl}
                src={bankQrUrl}
                alt={`VietQR for MB Bank account ${MB_BANK_ACCOUNT}`}
                className="h-full w-full object-contain"
                referrerPolicy="no-referrer"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div
              className="mt-5 text-center text-[9px] font-bold uppercase text-black/55"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              MB Bank / {MB_BANK_ACCOUNT}
            </div>
            <div
              className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{
                color: season.accent,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {bankAmount > 0 ? `${formatVnd(bankAmount)} + memo` : "account QR"}
            </div>
            <div
              className="mt-5 border-t border-black/10 pt-4 text-center text-[11px] italic text-black/50"
              style={{ fontFamily: "'Daniel Dex', cursive", fontSize: 22 }}
            >
              thank u, seriously - dex
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
