import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getCast,
  getPersonShows,
  getSchedule,
  getShowIndexPage,
  getWebShowsToday,
  TvmazeError,
} from '../api/tvmaze';
import type { ShowSummary } from '../api/types';
import {
  buildTaste,
  genreCandidates,
  librarySignature,
  rankRecommendations,
  type Candidate,
  type Recommendation,
} from '../model/recommend';
import { useLibrary } from './library';

const STORAGE_KEY = 'tvtracker:recs:v2';
const FRESH_FOR_MS = 12 * 60 * 60 * 1000;

/**
 * TVmaze allows roughly 20 calls per 10 seconds, and this is the only screen
 * that fans out, so the budget is spent deliberately: cast for a handful of
 * your heaviest shows, credits for the people who actually recur, then a few
 * index pages and today's schedules as the pool for genre matching.
 */
const MAX_ANCHORS = 4;
const CAST_PER_ANCHOR = 6;
const MAX_PEOPLE = 10;
const CONCURRENCY = 4;

/**
 * The index is ~250 shows a page in id order. Which pages are read rotates by
 * day, and again on every manual refresh, so the genre picks do not go stale.
 */
const INDEX_PAGES = 3;
const INDEX_RANGE = 240;

function indexPages(seed: number): number[] {
  const stride = Math.floor(INDEX_RANGE / INDEX_PAGES);
  const start = (seed * 37) % INDEX_RANGE;
  return Array.from({ length: INDEX_PAGES }, (_, i) => (start + i * stride) % INDEX_RANGE);
}

type Cached = { at: number; signature: string; items: Recommendation[] };

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Never let one failed request lose the whole screen. */
async function settle<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function useRecommendations() {
  const { shows, hydrated } = useLibrary();
  const [items, setItems] = useState<Recommendation[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef<AbortController | null>(null);
  const refreshes = useRef(0);

  const signature = librarySignature(shows);

  const compute = useCallback(
    async (force: boolean) => {
      running.current?.abort();
      if (force) refreshes.current += 1;
      const controller = new AbortController();
      running.current = controller;

      const taste = buildTaste(shows);
      if (taste.anchors.length === 0) {
        setItems([]);
        setUpdatedAt(null);
        setError(null);
        return;
      }

      if (!force) {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          try {
            const cached = JSON.parse(raw) as Cached;
            const fresh = Date.now() - cached.at < FRESH_FOR_MS;
            if (fresh && cached.signature === signature && Array.isArray(cached.items)) {
              setItems(cached.items);
              setUpdatedAt(cached.at);
              setError(null);
              return;
            }
          } catch {
            // Unreadable cache is not worth reporting; just recompute.
          }
        }
      }

      setLoading(true);
      setError(null);
      try {
        const anchors = taste.anchors.slice(0, MAX_ANCHORS);

        // 1. Who is in the shows you actually watch.
        const casts = await mapLimit(anchors, CONCURRENCY, (anchor) =>
          settle(getCast(anchor.show.id, controller.signal), []),
        );
        if (controller.signal.aborted) return;

        // 2. Rank those people: appearing across several of your shows beats
        //    top billing in one of them.
        const people = new Map<number, { name: string; anchorIds: number[]; score: number }>();
        casts.forEach((cast, index) => {
          const anchor = anchors[index];
          cast.slice(0, CAST_PER_ANCHOR).forEach((member, billing) => {
            const entry = people.get(member.personId) ?? {
              name: member.name,
              anchorIds: [],
              score: 0,
            };
            entry.anchorIds.push(anchor.show.id);
            entry.score += anchor.share * (1 - billing / (CAST_PER_ANCHOR * 2));
            people.set(member.personId, entry);
          });
        });

        const shortlist = [...people.entries()]
          .sort(
            (a, b) =>
              b[1].anchorIds.length - a[1].anchorIds.length ||
              b[1].score - a[1].score ||
              a[0] - b[0],
          )
          .slice(0, MAX_PEOPLE);

        // 3. What else those people have been in.
        const credits = await mapLimit(shortlist, CONCURRENCY, ([personId]) =>
          settle(getPersonShows(personId, controller.signal), [] as ShowSummary[]),
        );
        if (controller.signal.aborted) return;

        const candidates: Candidate[] = [];
        credits.forEach((shows_, index) => {
          const [, person] = shortlist[index];
          for (const show of shows_) {
            if (taste.tracked.has(show.id)) continue;
            candidates.push({
              show,
              via: person.anchorIds.map((anchorId) => ({ personName: person.name, anchorId })),
            });
          }
        });

        // 4. Genre matches from a broad pool: a slice of TVmaze's index plus
        //    what is on TV and streaming today.
        const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
        const today = todayISO();
        const pools = await mapLimit(
          [
            ...indexPages(day + refreshes.current).map(
              (page) => () => getShowIndexPage(page, controller.signal),
            ),
            () =>
              getSchedule('US', today, controller.signal).then((entries) =>
                entries.map((entry) => entry.show),
              ),
            () => getWebShowsToday(today, controller.signal),
          ],
          CONCURRENCY,
          (load) => settle(load(), [] as ShowSummary[]),
        );
        if (controller.signal.aborted) return;
        candidates.push(...genreCandidates(pools.flat(), taste));

        const ranked = rankRecommendations(candidates, taste);
        if (ranked.length === 0) {
          setItems([]);
          setError('Nothing new found in your genres — pull to refresh for a different batch.');
          return;
        }

        const at = Date.now();
        setItems(ranked);
        setUpdatedAt(at);
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ at, signature, items: ranked } satisfies Cached),
        );
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof TvmazeError ? err.message : 'Could not build your picks');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [shows, signature],
  );

  useEffect(() => {
    if (!hydrated) return;
    compute(false);
    return () => running.current?.abort();
    // Recompute when the library changes shape, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, signature]);

  return {
    items,
    loading,
    error,
    updatedAt,
    refresh: useCallback(() => compute(true), [compute]),
    hasLibrary: shows.length > 0,
    hasWatched: buildTaste(shows).anchors.length > 0,
  };
}
