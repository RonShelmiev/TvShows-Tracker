import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getCast, getPersonShows, getSchedule, TvmazeError } from '../api/tvmaze';
import type { ShowSummary } from '../api/types';
import {
  buildTaste,
  librarySignature,
  rankRecommendations,
  type Candidate,
  type Recommendation,
} from '../model/recommend';
import { useLibrary } from './library';

const STORAGE_KEY = 'tvtracker:recs:v1';
const FRESH_FOR_MS = 12 * 60 * 60 * 1000;

/**
 * TVmaze allows roughly 20 calls per 10 seconds, and this is the only screen
 * that fans out, so the budget is spent deliberately: cast for a handful of
 * your heaviest shows, then credits for the people who actually recur.
 */
const MAX_ANCHORS = 5;
const CAST_PER_ANCHOR = 6;
const MAX_PEOPLE = 12;
const CONCURRENCY = 4;

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

  const signature = librarySignature(shows);

  const compute = useCallback(
    async (force: boolean) => {
      running.current?.abort();
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

        // 4. A thin library yields few people, so top up from what is on today
        //    in the genres you watch.
        if (candidates.length < 5) {
          const schedule = await settle(getSchedule('US', todayISO(), controller.signal), []);
          for (const entry of schedule) {
            if (taste.tracked.has(entry.show.id)) continue;
            if (!entry.show.genres.some((genre) => (taste.genres.get(genre) ?? 0) > 0)) continue;
            candidates.push({ show: entry.show, via: [] });
          }
        }

        if (controller.signal.aborted) return;

        const ranked = rankRecommendations(candidates, taste);
        if (ranked.length === 0) {
          setItems([]);
          setError('Nothing new found — TVmaze knows little about the cast of your shows.');
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
