"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SpectrumProps = {
  /**
   * Web Audio analyser to read. Create it once — `ctx.createAnalyser()`, wire
   * your source into it — and hand it over; the component only reads.
   */
  analyser?: AnalyserNode;
  /**
   * Escape hatch for anything that isn't a Web Audio graph: return `bars`
   * magnitudes in 0–1 per frame. Ignored when `analyser` is set.
   */
  sample?: (time: number) => number[];
  /** Column count. Defaults to 40. */
  bars?: number;
  /** Height in px. Defaults to 64. */
  height?: number;
  /** Widest a column may get, in px. Columns flex to fill. Defaults to 6. */
  barWidth?: number;
  /** Gap between columns in px. Defaults to 2. */
  gap?: number;
  /** CSS color of the columns. Defaults to white. */
  accent?: string;
  /** Mirror the columns around the centre line. */
  mirror?: boolean;
  /** Fall speed, 0–1 per frame. Lower falls slower. Defaults to 0.12. */
  decay?: number;
  /** Hold a thin cap at each column's recent maximum. Defaults to true. */
  peakHold?: boolean;
  /** Stop reading and let the columns settle to the floor. */
  paused?: boolean;
  ariaLabel?: string;
  className?: string;
};

/** Perceptual column spacing: linear fft bins put almost everything in the first tenth. */
function logBins(binCount: number, bars: number): Array<[number, number]> {
  const min = 1;
  const max = Math.max(2, binCount - 1);
  const ratio = Math.log(max / min) / bars;
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < bars; i++) {
    const start = Math.floor(min * Math.exp(ratio * i));
    const end = Math.max(start + 1, Math.floor(min * Math.exp(ratio * (i + 1))));
    edges.push([start, Math.min(max, end)]);
  }
  return edges;
}

/**
 * Live frequency analyser.
 *
 * Canvas, not elements — this repaints every frame, and 40 dom nodes with
 * changing inline styles would mean 40 style recalcs per frame. `waveform` is
 * the opposite trade: a fixed shape that never repaints, so it gets to be dom.
 *
 * Columns are spaced logarithmically. A linear walk over the fft bins spends
 * three quarters of its width on frequencies no instrument occupies, which is
 * why naive visualisers are all cliff on the left and flat on the right.
 *
 * Values fall by `decay` per frame rather than snapping to each reading: the
 * raw signal at 60fps flickers, and the eye reads the fall as loudness. Under
 * reduced motion nothing animates — the columns render once at their floor and
 * the frame loop never starts.
 */
export function Spectrum({
  analyser,
  sample,
  bars = 40,
  height = 64,
  barWidth = 6,
  gap = 2,
  accent = "#fff",
  mirror = false,
  decay = 0.12,
  peakHold = true,
  paused = false,
  ariaLabel = "audio spectrum",
  className,
}: SpectrumProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const levels = React.useRef<Float32Array>(new Float32Array(bars));
  const peaks = React.useRef<Float32Array>(new Float32Array(bars));

  // `sample` is almost always written inline at the call site. Holding it in a
  // ref keeps a new function identity from tearing down the frame loop on every
  // render — the loop only cares whether a sampler exists at all. The ref is
  // written in an effect, never during render, so a re-render React throws away
  // can't leave a stale sampler behind.
  const sampleRef = React.useRef(sample);
  React.useEffect(() => {
    sampleRef.current = sample;
  });
  const hasSample = typeof sample === "function";

  React.useEffect(() => {
    levels.current = new Float32Array(bars);
    peaks.current = new Float32Array(bars);
  }, [bars]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    // Left uninitialised-by-inference so the typed-array's buffer generic comes
    // from the constructor rather than an annotation that has to guess it.
    let fft = new Uint8Array(0);
    let bins: Array<[number, number]> = [];

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const read = (time: number): number[] => {
      if (analyser) {
        if (fft.length !== analyser.frequencyBinCount) {
          fft = new Uint8Array(analyser.frequencyBinCount);
          bins = logBins(analyser.frequencyBinCount, bars);
        }
        analyser.getByteFrequencyData(fft);
        return bins.map(([start, end]) => {
          let sum = 0;
          for (let i = start; i < end; i++) sum += fft[i] ?? 0;
          return sum / Math.max(1, end - start) / 255;
        });
      }
      return sampleRef.current?.(time) ?? [];
    };

    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const columnWidth = Math.min(barWidth, Math.max(1, (w - gap * (bars - 1)) / bars));
      const stride = bars > 1 ? (w - columnWidth) / (bars - 1) : 0;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = accent;
      for (let i = 0; i < bars; i++) {
        const value = Math.max(0.015, levels.current[i] ?? 0);
        const barHeight = value * h;
        const x = i * stride;
        if (mirror) {
          ctx.fillRect(x, (h - barHeight) / 2, columnWidth, barHeight);
        } else {
          ctx.fillRect(x, h - barHeight, columnWidth, barHeight);
        }
        if (peakHold) {
          const peak = peaks.current[i] ?? 0;
          if (peak > 0.02) {
            const y = mirror ? (h - peak * h) / 2 : h - peak * h;
            ctx.globalAlpha = 0.45;
            ctx.fillRect(x, Math.max(0, y - 1), columnWidth, 1);
            ctx.globalAlpha = 1;
          }
        }
      }
    };

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || paused || (!analyser && !hasSample)) {
      levels.current.fill(0);
      peaks.current.fill(0);
      paint();
      return () => observer.disconnect();
    }

    const tick = (time: number) => {
      const next = read(time);
      for (let i = 0; i < bars; i++) {
        const target = Math.min(1, Math.max(0, next[i] ?? 0));
        const current = levels.current[i] ?? 0;
        // Rise instantly, fall gradually — a transient you miss never happened,
        // but a decay you skip makes the whole thing strobe.
        levels.current[i] = target > current ? target : current + (target - current) * decay;
        const peak = peaks.current[i] ?? 0;
        peaks.current[i] = target > peak ? target : Math.max(0, peak - 0.006);
      }
      paint();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [analyser, hasSample, bars, height, barWidth, gap, accent, mirror, decay, peakHold, paused]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel}
      className={cn("block w-full", className)}
      style={{ height }}
    />
  );
}
