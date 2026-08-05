"use client";

import { useCallback, useMemo, useState } from "react";
import { Radio } from "lucide-react";
import { AvatarStack } from "@/components/chrome/avatar-stack";
import { Button } from "@/components/chrome/button";
import { Chrome } from "@/components/chrome/chrome";
import { EmptyState } from "@/components/chrome/empty-state";
import { LiveBadge } from "@/components/chrome/live-badge";
import { Marquee } from "@/components/chrome/marquee";
import { Playhead } from "@/components/chrome/playhead";
import { SoundBars } from "@/components/chrome/sound-bars";
import { Spectrum } from "@/components/chrome/spectrum";
import { Transport } from "@/components/chrome/transport";
import { Volume } from "@/components/chrome/volume";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useOwner } from "@/hooks/use-owner";
import { usePresence } from "@/hooks/use-presence";
import { useBroadcast, useRoom } from "@/hooks/use-room";
import { useTuneIn } from "@/hooks/use-tune-in";
import {
  EVERYTHING,
  LIBRARY_IS_EMPTY,
  PLAYLISTS,
  playlistById,
  playlistTracks,
  trackById,
  type LibraryTrack,
  type Playlist,
} from "@/lib/library";
import { Library } from "./library";
import { Sleeve } from "./sleeve";

/** Tuned to the room, or off doing your own thing. */
type Mode = "tuned" | "free";

export function ListenRoom() {
  const player = useAudioPlayer();
  const { owner } = useOwner();
  const { people, count } = usePresence();

  const isOwner = owner === true;
  // The broadcaster is the source of truth and has nothing to poll for.
  const feed = useRoom(!isOwner);

  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("tuned");

  // Wait for the ownership check before syncing anything: for the first few
  // milliseconds the broadcaster looks like a listener, and tuning in would
  // have them chasing their own broadcast.
  const tuned = owner === false && mode === "tuned";
  useBroadcast(player, playlistId, isOwner);
  useTuneIn(player, feed, tuned && Boolean(feed.room?.trackId));

  const selected = useMemo<Playlist>(
    () => playlistById(playlistId) ?? PLAYLISTS[0] ?? EVERYTHING,
    [playlistId],
  );

  const start = useCallback(
    (track: LibraryTrack, playlist: Playlist) => {
      // Picking something yourself is the moment you stop listening along.
      if (tuned) setMode("free");
      setPlaylistId(playlist.id);
      player.play(track.id, playlist.trackIds);
    },
    [player, tuned],
  );

  const onPlayPause = useCallback(() => {
    if (tuned && player.playing) {
      // Stopping the broadcast on your own end means taking the controls.
      setMode("free");
    }
    player.toggle();
  }, [player, tuned]);

  const tuneBackIn = useCallback(() => {
    setMode("tuned");
    feed.refresh();
  }, [feed]);

  const roomTrack = trackById(feed.room?.trackId);
  const track = player.track;
  const broadcasting = isOwner && player.playing;

  if (LIBRARY_IS_EMPTY) {
    return (
      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-10 px-6 py-24">
        <Chrome as="h1" className="text-[44px] font-semibold tracking-tight">
          listen.
        </Chrome>
        <EmptyState
          icon={<Radio size={20} strokeWidth={1.25} aria-hidden />}
          title="the library is empty"
          description="drop mp3s into public/music, run bun run scan, and paste what it prints into lib/library.ts. that file is the whole catalogue."
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[900px] flex-col gap-14 px-6 py-16 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Chrome as="h1" className="text-[44px] font-semibold tracking-tight">
            listen.
          </Chrome>
          <p className="mt-2 max-w-[440px] text-[15px] leading-7 text-white/60">
            {isOwner
              ? "you're the broadcaster. anything you play here plays for everyone on the page."
              : "whatever i'm playing, playing here — same track, same second. or go and put something else on."}
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <LiveBadge
            status={
              isOwner
                ? broadcasting
                  ? "live"
                  : "idle"
                : feed.status === "live"
                  ? "live"
                  : feed.status === "quiet"
                    ? "idle"
                    : feed.status === "connecting"
                      ? "connecting"
                      : "offline"
            }
            label={isOwner ? (broadcasting ? "on air" : "off air") : undefined}
            detail={count > 0 ? `${count} here` : undefined}
          />
          {people.length > 0 && <AvatarStack people={people} size="xs" max={6} total={count} />}
        </div>
      </header>

      <section className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
        <Sleeve
          art={track?.art}
          alt={track ? `cover of ${track.album ?? track.title}` : "nothing playing"}
          spinning={player.playing}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-5 pt-1">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
              {tuned ? "tuned in" : isOwner ? "now playing" : "your own thing"}
            </span>
            {!isOwner && !tuned && roomTrack && (
              <Button size="sm" variant="ghost" onClick={tuneBackIn}>
                tune back in
              </Button>
            )}
          </div>

          {track ? (
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center gap-3">
                {player.playing && (
                  <SoundBars size="sm" label={null} className="shrink-0 text-white/70" />
                )}
                {track.title.length > 32 ? (
                  <Marquee speed={26} className="text-[26px] leading-tight tracking-tight">
                    <span>{track.title}</span>
                  </Marquee>
                ) : (
                  <h2 className="truncate text-[26px] leading-tight tracking-tight">
                    {track.title}
                  </h2>
                )}
              </div>
              <p className="truncate text-[15px] text-white/60">
                {track.artist}
                {track.album && <span className="text-white/35"> · {track.album}</span>}
              </p>
            </div>
          ) : (
            <p className="text-[15px] text-white/45">
              {tuned && !roomTrack
                ? "nothing is playing right now. the room stays open."
                : "pick something from the library below."}
            </p>
          )}

          <Playhead
            position={player.sample.position}
            startedAt={player.sample.at || undefined}
            duration={player.duration}
            playing={player.playing}
            // A listener tuned in can't scrub someone else's playback; break
            // off first and the bar becomes yours.
            onSeek={tuned ? undefined : player.seek}
            remaining
          />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <Transport
              playing={player.playing}
              loading={player.loading}
              disabled={!track}
              onPlayPause={onPlayPause}
              onPrevious={tuned ? undefined : player.previous}
              onNext={tuned ? undefined : player.next}
              shuffle={tuned ? undefined : player.shuffle}
              onShuffleChange={tuned ? undefined : player.setShuffle}
              repeat={player.repeat}
              onRepeatChange={tuned ? undefined : player.setRepeat}
            />
            <Volume
              value={player.volume}
              onChange={player.setVolume}
              muted={player.muted}
              onMutedChange={player.setMuted}
            />
            <Spectrum
              analyser={player.analyser ?? undefined}
              paused={!player.playing || !player.analyser}
              bars={28}
              height={40}
              className="min-w-[160px] flex-1"
            />
          </div>

          {(player.needsGesture || player.error) && (
            <p className="text-[13px] leading-6 text-white/45">
              {player.error ??
                "your browser wants a click before it will make noise — press play to join."}
            </p>
          )}
        </div>
      </section>

      <Library
        selected={selected}
        onSelectPlaylist={(playlist) => setPlaylistId(playlist.id)}
        onPlay={start}
        activeTrackId={track?.id ?? null}
        playing={player.playing}
      />

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-white/30">
        <span>listen.justin06lee.dev</span>
        <span>
          {playlistTracks(EVERYTHING).length} tracks · {PLAYLISTS.length} playlists
        </span>
      </footer>
    </main>
  );
}
