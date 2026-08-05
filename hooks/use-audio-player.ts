"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { trackById, type LibraryTrack } from "@/lib/library";

export type RepeatMode = "off" | "all" | "one";

export type PlayerSample = {
  /** Position in seconds. */
  position: number;
  /** `Date.now()` when that position was read — the anchor for the playhead. */
  at: number;
};

export type PlayerState = {
  track: LibraryTrack | null;
  queue: string[];
  playing: boolean;
  /** Real length off the file, falling back to the manifest's guess. */
  duration: number;
  sample: PlayerSample;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  loading: boolean;
  error: string | null;
  /** Set when the browser refused to start audio without a gesture. */
  needsGesture: boolean;
  analyser: AnalyserNode | null;
  /**
   * Bumped on every deliberate change — track, play, pause, seek. The
   * broadcaster watches this instead of diffing state, so a poll and a real
   * change are never confused.
   */
  epoch: number;
};

export type Player = PlayerState & {
  play: (trackId: string, queue?: string[]) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  setMuted: (value: boolean) => void;
  setShuffle: (value: boolean) => void;
  setRepeat: (value: RepeatMode) => void;
  /** Follow a remote position without counting as a deliberate change. */
  syncTo: (target: { trackId: string; position: number; playing: boolean; queue?: string[] }) => void;
  /** Drop any rate-bending syncTo applied. Call when leaving sync. */
  resetRate: () => void;
};

/** Above this we jump; below it we bend the playback rate instead. */
const HARD_SEEK_S = 2;
const NUDGE_FLOOR_S = 0.25;
/** Cap on rate-bending. Beyond a few percent it's audible as pitch drift. */
const MAX_RATE_TRIM = 0.05;

const VOLUME_KEY = "listen:volume";
const DEFAULT_VOLUME = 0.8;

/**
 * Volume lives in localStorage, read through an external store rather than an
 * effect. A player you leave open all day should remember how loud it was, and
 * `useSyncExternalStore` is the one way to read browser storage that has a
 * defined answer during the server render (the default) and corrects itself on
 * hydration without a state write in an effect body.
 */
let cachedVolume: number | null = null;
const volumeListeners = new Set<() => void>();

function readStoredVolume(): number {
  if (cachedVolume === null) {
    const raw = window.localStorage.getItem(VOLUME_KEY);
    const parsed = raw === null ? NaN : Number(raw);
    cachedVolume = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : DEFAULT_VOLUME;
  }
  return cachedVolume;
}

function writeStoredVolume(value: number): void {
  cachedVolume = value;
  try {
    window.localStorage.setItem(VOLUME_KEY, String(value));
  } catch {
    // Private mode, or storage full. The session still works, it just forgets.
  }
  for (const listener of volumeListeners) listener();
}

function subscribeVolume(listener: () => void): () => void {
  volumeListeners.add(listener);
  return () => {
    volumeListeners.delete(listener);
  };
}

/**
 * The audio player: one element, one graph, everything else derived.
 *
 * The element and the Web Audio graph are created once and reused for every
 * track — `createMediaElementSource` may be called only once per element for
 * the life of the page, so a new element per track would cost the visualiser
 * after the first song.
 *
 * `syncTo` is what makes listening along work. Rather than seeking on every
 * update — which would stutter constantly — it corrects proportionally: a
 * gross difference is a seek, and anything under a couple of seconds is fixed
 * by playing fractionally fast or slow until the gap closes. Within a few
 * percent that's inaudible, and the alternative is a click every five seconds.
 */
export function useAudioPlayer(): Player {
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const graphFailed = useRef(false);
  const pendingSeek = useRef<number | null>(null);

  const [trackId, setTrackId] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [sample, setSample] = useState<PlayerSample>({ position: 0, at: 0 });
  const volume = useSyncExternalStore(subscribeVolume, readStoredVolume, () => DEFAULT_VOLUME);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [epoch, setEpoch] = useState(0);

  // Read in callbacks that must not re-create themselves on every state change.
  const latest = useRef({ trackId, queue, shuffle, repeat });
  useEffect(() => {
    latest.current = { trackId, queue, shuffle, repeat };
  });

  const bump = useCallback(() => setEpoch((n) => n + 1), []);

  useEffect(() => {
    const audio = new Audio();
    // Same-origin files don't need this, but tracks moved to a bucket do —
    // without it the analyser silently reads zeroes off a tainted stream.
    audio.crossOrigin = "anonymous";
    audio.preload = "metadata";
    elementRef.current = audio;

    const commit = () => setSample({ position: audio.currentTime, at: Date.now() });

    const onLoaded = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setLoading(false);
      // A seek requested before the file had metadata is applied now — setting
      // currentTime on an unloaded element is either ignored or throws.
      if (pendingSeek.current !== null) {
        audio.currentTime = pendingSeek.current;
        pendingSeek.current = null;
        commit();
      }
    };
    const onPlay = () => {
      setPlaying(true);
      setNeedsGesture(false);
      commit();
    };
    const onPause = () => {
      setPlaying(false);
      commit();
    };
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onError = () => {
      setLoading(false);
      setPlaying(false);
      setError("that file wouldn't load");
    };
    const onSeeked = () => commit();

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("error", onError);
    audio.addEventListener("seeked", onSeeked);

    // One sample a second is plenty: the playhead extrapolates between them,
    // and `timeupdate`'s four-a-second would restart that clock needlessly.
    const ticker = setInterval(() => {
      if (!audio.paused) commit();
    }, 1000);

    return () => {
      clearInterval(ticker);
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("seeked", onSeeked);
      void contextRef.current?.close();
      contextRef.current = null;
      analyserRef.current = null;
      elementRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = elementRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  const attachGraph = useCallback(() => {
    const audio = elementRef.current;
    if (!audio || contextRef.current || graphFailed.current) return;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error("no web audio");
      const context = new Ctor();
      const node = context.createAnalyser();
      node.fftSize = 1024;
      node.smoothingTimeConstant = 0.75;
      context.createMediaElementSource(audio).connect(node);
      node.connect(context.destination);
      contextRef.current = context;
      analyserRef.current = node;
      setAnalyser(node);
    } catch {
      // A cross-origin file without CORS headers, or no Web Audio at all.
      // Playback still works; the spectrum just sits flat.
      graphFailed.current = true;
      setAnalyser(null);
    }
  }, []);

  /** Start the element, reporting a blocked autoplay rather than swallowing it. */
  const start = useCallback(
    (gesture: boolean) => {
      const audio = elementRef.current;
      if (!audio) return;
      if (gesture) attachGraph();
      void contextRef.current?.resume();
      audio.play().catch(() => {
        setPlaying(false);
        setNeedsGesture(true);
      });
    },
    [attachGraph],
  );

  const load = useCallback((id: string, position: number, autoplay: boolean, gesture: boolean) => {
    const audio = elementRef.current;
    const track = trackById(id);
    if (!audio || !track) return;

    const changingSource = audio.src !== new URL(track.src, window.location.href).href;
    if (changingSource) {
      setError(null);
      setLoading(true);
      audio.src = track.src;
      audio.load();
      pendingSeek.current = position > 0 ? position : null;
    } else if (position > 0) {
      audio.currentTime = position;
    }
    setTrackId(id);
    setDuration(track.duration ?? 0);
    setSample({ position, at: Date.now() });
    if (autoplay) start(gesture);
  }, [start]);

  const play = useCallback(
    (id: string, nextQueue?: string[]) => {
      if (nextQueue) setQueue(nextQueue);
      load(id, 0, true, true);
      bump();
    },
    [bump, load],
  );

  const toggle = useCallback(() => {
    const audio = elementRef.current;
    if (!audio || !latest.current.trackId) return;
    if (audio.paused) start(true);
    else audio.pause();
    bump();
  }, [bump, start]);

  const step = useCallback(
    (direction: 1 | -1) => {
      const { trackId: current, queue: q, shuffle: isShuffle, repeat: mode } = latest.current;
      if (q.length === 0 || !current) return;

      if (isShuffle && direction === 1) {
        // Never hand back the track already playing — on a two-track queue
        // that would look like shuffle simply not working.
        const others = q.filter((id) => id !== current);
        const pick = others[Math.floor(Math.random() * others.length)] ?? current;
        play(pick);
        return;
      }

      const index = q.indexOf(current);
      const nextIndex = index + direction;
      if (nextIndex < 0) {
        play(mode === "all" ? q[q.length - 1]! : q[0]!);
        return;
      }
      if (nextIndex >= q.length) {
        if (mode === "all") play(q[0]!);
        else elementRef.current?.pause();
        return;
      }
      play(q[nextIndex]!);
    },
    [play],
  );

  // `ended` needs the current queue and mode, so it's registered separately
  // from the element's one-time setup.
  useEffect(() => {
    const audio = elementRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (latest.current.repeat === "one" && latest.current.trackId) {
        audio.currentTime = 0;
        void audio.play();
        return;
      }
      step(1);
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [step]);

  const seek = useCallback(
    (seconds: number) => {
      const audio = elementRef.current;
      if (!audio) return;
      audio.currentTime = Math.max(0, seconds);
      setSample({ position: audio.currentTime, at: Date.now() });
      bump();
    },
    [bump],
  );

  const syncTo = useCallback(
    ({
      trackId: targetId,
      position,
      playing: shouldPlay,
      queue: nextQueue,
    }: {
      trackId: string;
      position: number;
      playing: boolean;
      queue?: string[];
    }) => {
      const audio = elementRef.current;
      if (!audio) return;
      if (nextQueue) setQueue(nextQueue);

      if (latest.current.trackId !== targetId) {
        load(targetId, position, shouldPlay, false);
        return;
      }

      if (!shouldPlay) {
        if (!audio.paused) audio.pause();
        audio.playbackRate = 1;
        return;
      }
      if (audio.paused) start(false);

      const drift = position - audio.currentTime;
      if (Math.abs(drift) > HARD_SEEK_S) {
        audio.currentTime = Math.max(0, position);
        audio.playbackRate = 1;
      } else if (Math.abs(drift) > NUDGE_FLOOR_S) {
        // Close the gap over roughly the next twenty seconds.
        const trim = Math.max(-MAX_RATE_TRIM, Math.min(MAX_RATE_TRIM, drift / 20));
        audio.playbackRate = 1 + trim;
      } else if (audio.playbackRate !== 1) {
        audio.playbackRate = 1;
      }
    },
    [load, start],
  );

  const setVolume = useCallback((value: number) => {
    writeStoredVolume(Math.min(1, Math.max(0, value)));
  }, []);

  const resetRate = useCallback(() => {
    if (elementRef.current) elementRef.current.playbackRate = 1;
  }, []);

  const track = useMemo(() => trackById(trackId), [trackId]);

  return {
    track,
    queue,
    playing,
    duration: duration || track?.duration || 0,
    sample,
    volume,
    muted,
    shuffle,
    repeat,
    loading,
    error,
    needsGesture,
    analyser,
    epoch,
    play,
    toggle,
    next: () => step(1),
    previous: () => step(-1),
    seek,
    setVolume,
    setMuted,
    setShuffle,
    setRepeat,
    syncTo,
    resetRate,
  };
}
