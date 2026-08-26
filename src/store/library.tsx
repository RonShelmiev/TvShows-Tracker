import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getShowWithEpisodes } from '../api/tvmaze';
import type { ShowSummary } from '../api/types';
import {
  markNext as computeNext,
  markUpTo,
  pruneWatched,
  setSeasonWatched,
  toggleEpisode,
  type TrackedShow,
} from '../model/progress';

const STORAGE_KEY = 'tvtracker:library:v1';
const SAVE_DEBOUNCE_MS = 400;
/** Running shows gain episodes; refresh a show's episode list at most daily. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

type LibraryContextValue = {
  shows: TrackedShow[];
  /** Ordered the way My Shows lists them: most recently watched first. */
  ordered: TrackedShow[];
  hydrated: boolean;
  busy: Record<number, boolean>;
  isTracked: (showId: number) => boolean;
  get: (showId: number) => TrackedShow | undefined;
  addShow: (show: ShowSummary) => Promise<void>;
  removeShow: (showId: number) => void;
  toggle: (showId: number, episodeId: number) => void;
  markNext: (showId: number) => void;
  setPosition: (showId: number, episodeId: number) => void;
  setSeason: (showId: number, season: number, watched: boolean) => void;
  refresh: (showId: number) => Promise<void>;
  clearAll: () => void;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

function isTrackedShow(value: unknown): value is TrackedShow {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Partial<TrackedShow>;
  return (
    typeof t.show === 'object' &&
    t.show !== null &&
    typeof t.show.id === 'number' &&
    Array.isArray(t.episodes) &&
    Array.isArray(t.watched)
  );
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [shows, setShows] = useState<TrackedShow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load once on boot.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) setShows(parsed.filter(isTrackedShow));
        }
      } catch {
        // A corrupt library should not stop the app booting — start empty.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after changes settle.
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(shows)).catch(() => {});
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [shows, hydrated]);

  const updateWatched = useCallback(
    (showId: number, next: (tracked: TrackedShow) => number[]) => {
      setShows((current) =>
        current.map((tracked) =>
          tracked.show.id === showId
            ? { ...tracked, watched: next(tracked), lastWatchedAt: Date.now() }
            : tracked,
        ),
      );
    },
    [],
  );

  const setShowBusy = useCallback((showId: number, value: boolean) => {
    setBusy((current) => {
      if (value) return { ...current, [showId]: true };
      const { [showId]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const addShow = useCallback(
    async (summary: ShowSummary) => {
      setShowBusy(summary.id, true);
      try {
        const { show, episodes } = await getShowWithEpisodes(summary.id);
        setShows((current) => {
          if (current.some((t) => t.show.id === show.id)) return current;
          const tracked: TrackedShow = {
            show,
            episodes,
            watched: [],
            addedAt: Date.now(),
            lastWatchedAt: null,
            episodesFetchedAt: Date.now(),
          };
          return [tracked, ...current];
        });
      } finally {
        setShowBusy(summary.id, false);
      }
    },
    [setShowBusy],
  );

  const refresh = useCallback(
    async (showId: number) => {
      setShowBusy(showId, true);
      try {
        const { show, episodes } = await getShowWithEpisodes(showId);
        setShows((current) =>
          current.map((tracked) => {
            if (tracked.show.id !== showId) return tracked;
            const merged: TrackedShow = {
              ...tracked,
              show,
              episodes,
              episodesFetchedAt: Date.now(),
            };
            return { ...merged, watched: pruneWatched(merged) };
          }),
        );
      } finally {
        setShowBusy(showId, false);
      }
    },
    [setShowBusy],
  );

  // Quietly top up stale episode lists once the library is on screen.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!hydrated) return;
    const stale = shows
      .filter(
        (t) =>
          t.show.status !== 'Ended' &&
          (t.episodesFetchedAt === null || Date.now() - t.episodesFetchedAt > STALE_AFTER_MS),
      )
      .slice(0, 3);
    for (const tracked of stale) {
      refreshRef.current(tracked.show.id).catch(() => {});
    }
    // Only when the set of tracked shows changes, not on every watch tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, shows.length]);

  const value = useMemo<LibraryContextValue>(() => {
    const ordered = [...shows].sort(
      (a, b) => (b.lastWatchedAt ?? b.addedAt) - (a.lastWatchedAt ?? a.addedAt),
    );
    return {
      shows,
      ordered,
      hydrated,
      busy,
      isTracked: (showId) => shows.some((t) => t.show.id === showId),
      get: (showId) => shows.find((t) => t.show.id === showId),
      addShow,
      removeShow: (showId) => setShows((current) => current.filter((t) => t.show.id !== showId)),
      toggle: (showId, episodeId) =>
        updateWatched(showId, (t) => toggleEpisode(t.watched, episodeId)),
      markNext: (showId) => updateWatched(showId, (t) => computeNext(t)),
      setPosition: (showId, episodeId) => updateWatched(showId, (t) => markUpTo(t, episodeId)),
      setSeason: (showId, season, watched) =>
        updateWatched(showId, (t) => setSeasonWatched(t, season, watched)),
      refresh,
      clearAll: () => setShows([]),
    };
  }, [shows, hydrated, busy, addShow, refresh, updateWatched]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return value;
}
