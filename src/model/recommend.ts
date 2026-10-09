import type { ShowSummary } from '../api/types';
import { progressFor, type Progress, type TrackedShow } from './progress';

/**
 * TVmaze has no recommendations endpoint, so we build our own from two signals
 * it does expose: genres, and the people in a show. Genre leads — it is what
 * most people mean by "more like this" — and shared cast lifts a pick further.
 * Both are explainable: every pick can say which of your shows it came from,
 * which matters more than a slightly better ranking you cannot argue with.
 */

/** What your library says you like. */
export type Taste = {
  /** Shows already tracked — never recommend these back. */
  tracked: Set<number>;
  /** Genre -> share of your watching, each 0-1. */
  genres: Map<string, number>;
  /** Languages of the shows you watch, so genre picks stay watchable. */
  languages: Set<string>;
  /** The shows worth mining for cast and genres, heaviest first. */
  anchors: Anchor[];
};

export type Anchor = {
  show: ShowSummary;
  /** How much this show says about your taste — see showWeight. */
  weight: number;
  /** This anchor's share of all your watching, 0-1. */
  share: number;
  /** In progress and touched recently, rather than finished or abandoned. */
  watching: boolean;
};

/** A show we might suggest, with the trail back to your library. */
export type Candidate = {
  show: ShowSummary;
  via: CandidateLink[];
};

export type CandidateLink = {
  personName: string;
  /** The tracked show this person also appears in. */
  anchorId: number;
};

export type Recommendation = {
  show: ShowSummary;
  score: number;
  /** "Crime + Drama, like Vault City" — the headline justification. */
  reason: string;
  /** "Jane Doe is in both · Drama, Crime" */
  detail: string;
  /** The show's genres that you watch, most-watched first. */
  genres: string[];
};

/** A finished or paused show needs a little history to count as taste. */
const MIN_ANCHOR_EPISODES = 2;
/** What you are watching now says more about your mood than what you finished. */
const CURRENT_BOOST = 2;
/** Untouched this long, an unfinished show is treated as paused, not current. */
const STALE_AFTER_MS = 60 * 24 * 60 * 60 * 1000;

/** Genre-only picks have no cast link to vouch for them, so they clear a bar. */
const MIN_GENRE_MATCH = 0.5;
const MIN_POOL_RATING = 6.5;
/** TVmaze's popularity weight, used to admit unrated shows that are clearly known. */
const MIN_POOL_WEIGHT_UNRATED = 80;

export function isWatching(entry: TrackedShow, progress: Progress, now: Date = new Date()): boolean {
  if (progress.watched === 0 || progress.left === 0) return false;
  return entry.lastWatchedAt === null || now.getTime() - entry.lastWatchedAt < STALE_AFTER_MS;
}

/**
 * Square root so a finished 100-episode show does not drown out the one you
 * started last week, then boosted if you are still watching it.
 */
function showWeight(watched: number, watching: boolean): number {
  return Math.sqrt(watched) * (watching ? CURRENT_BOOST : 1);
}

export function buildTaste(shows: TrackedShow[], now: Date = new Date()): Taste {
  const tracked = new Set(shows.map((s) => s.show.id));
  const genreTotals = new Map<string, number>();
  const languages = new Set<string>();
  const weighted: Omit<Anchor, 'share'>[] = [];
  let total = 0;

  for (const entry of shows) {
    const progress = progressFor(entry, now);
    if (progress.watched <= 0) continue;
    const watching = isWatching(entry, progress, now);
    const weight = showWeight(progress.watched, watching);
    total += weight;
    if (entry.show.language) languages.add(entry.show.language);
    for (const genre of entry.show.genres) {
      genreTotals.set(genre, (genreTotals.get(genre) ?? 0) + weight);
    }
    if (watching || progress.watched >= MIN_ANCHOR_EPISODES) {
      weighted.push({ show: entry.show, weight, watching });
    }
  }

  const genres = new Map<string, number>();
  if (total > 0) {
    for (const [genre, count] of genreTotals) genres.set(genre, count / total);
  }

  const anchors: Anchor[] = weighted
    .sort((a, b) => b.weight - a.weight || a.show.id - b.show.id)
    .map((entry) => ({ ...entry, share: total === 0 ? 0 : entry.weight / total }));

  return { tracked, genres, languages, anchors };
}

/** Diminishing returns: the fifth shared actor should not count like the first. */
function damp(value: number): number {
  return 1 - Math.exp(-value);
}

/** The show's genres that you watch, most-watched first. */
export function matchedGenres(show: ShowSummary, taste: Taste): string[] {
  return show.genres
    .filter((genre) => (taste.genres.get(genre) ?? 0) > 0)
    .sort((a, b) => (taste.genres.get(b) ?? 0) - (taste.genres.get(a) ?? 0));
}

/**
 * How squarely a show sits in your genres, 0-1. Each of its genres is scored
 * against your favourite one, then averaged, so a genre you never watch dilutes
 * the match; matching two of your genres earns a little extra.
 */
export function genreScore(show: ShowSummary, taste: Taste): number {
  if (show.genres.length === 0 || taste.genres.size === 0) return 0;
  const top = Math.max(...taste.genres.values());
  let affinity = 0;
  let matched = 0;
  for (const genre of show.genres) {
    const share = taste.genres.get(genre) ?? 0;
    affinity += share / top;
    if (share > 0) matched += 1;
  }
  return 0.8 * (affinity / show.genres.length) + 0.2 * (Math.min(matched, 2) / 2);
}

/** TVmaze ratings cluster between 6 and 9, so stretch that range rather than 0-10. */
function ratingScore(show: ShowSummary): number {
  if (show.rating === null) return 0.3;
  return Math.min(Math.max((show.rating - 6) / 3, 0), 1);
}

function peopleScore(candidate: Candidate, taste: Taste): number {
  const byPerson = new Map<string, number>();
  const shareOf = new Map(taste.anchors.map((a) => [a.show.id, a.share]));
  for (const link of candidate.via) {
    // One person linking through two of your shows counts once, at the best share.
    const share = shareOf.get(link.anchorId) ?? 0;
    byPerson.set(link.personName, Math.max(byPerson.get(link.personName) ?? 0, share));
  }
  let sum = 0;
  for (const share of byPerson.values()) sum += share;
  return damp(sum * 3);
}

export function scoreCandidate(candidate: Candidate, taste: Taste): number {
  return (
    0.55 * genreScore(candidate.show, taste) +
    0.3 * peopleScore(candidate, taste) +
    0.15 * ratingScore(candidate.show)
  );
}

/**
 * Turns a broad pool of shows (TVmaze's index, today's schedule) into genre
 * candidates: in a language you watch, a strong genre match, and either rated
 * decently or popular enough to vouch for itself.
 */
export function genreCandidates(pool: ShowSummary[], taste: Taste, limit = 60): Candidate[] {
  const seen = new Set<number>();
  const kept: { show: ShowSummary; rank: number }[] = [];
  for (const show of pool) {
    if (taste.tracked.has(show.id) || seen.has(show.id)) continue;
    seen.add(show.id);
    if (taste.languages.size > 0 && show.language && !taste.languages.has(show.language)) continue;
    const match = genreScore(show, taste);
    if (match < MIN_GENRE_MATCH) continue;
    const vouched =
      show.rating !== null
        ? show.rating >= MIN_POOL_RATING
        : (show.weight ?? 0) >= MIN_POOL_WEIGHT_UNRATED;
    if (!vouched) continue;
    kept.push({ show, rank: 0.7 * match + 0.3 * ratingScore(show) });
  }
  return kept
    .sort((a, b) => b.rank - a.rank || a.show.id - b.show.id)
    .slice(0, limit)
    .map(({ show }) => ({ show, via: [] }));
}

/** The show of yours that shares most genres with this one — what "like X" names. */
function genreAnchor(show: ShowSummary, taste: Taste): Anchor | null {
  let best: { anchor: Anchor; overlap: number } | null = null;
  for (const anchor of taste.anchors) {
    const overlap = anchor.show.genres.filter((genre) => show.genres.includes(genre)).length;
    if (overlap === 0) continue;
    // Anchors are already heaviest-first, so ties go to the show you watch most.
    if (!best || overlap > best.overlap) best = { anchor, overlap };
  }
  return best?.anchor ?? null;
}

function describe(
  candidate: Candidate,
  taste: Taste,
  matched: string[],
): { reason: string; detail: string } {
  const anchorById = new Map(taste.anchors.map((a) => [a.show.id, a]));
  const linked = candidate.via
    .map((link) => ({ link, anchor: anchorById.get(link.anchorId) }))
    .filter((row): row is { link: CandidateLink; anchor: Anchor } => !!row.anchor)
    .sort((a, b) => b.anchor.share - a.anchor.share);

  const genres = candidate.show.genres.slice(0, 2).join(', ');

  if (linked.length === 0) {
    const like = genreAnchor(candidate.show, taste);
    const headline = matched.slice(0, 2).join(' + ');
    if (like && headline) {
      return {
        reason: `${headline}, like ${like.show.name}`,
        detail: like.watching
          ? `You're watching ${like.show.name} now · ${candidate.show.genres.slice(0, 3).join(', ')}`
          : candidate.show.genres.slice(0, 3).join(', '),
      };
    }
    return {
      reason: matched[0] ? `More ${matched[0].toLowerCase()}, which you watch a lot of` : 'Worth a look',
      detail: genres,
    };
  }

  const top = linked[0];
  const people = new Set(linked.map((row) => row.link.personName));
  const names = [...people];
  // Kept short: this sits under the title next to the Track button.
  const who =
    names.length === 1 ? `${names[0]} is in both` : `${names[0]} + ${names.length - 1} more`;

  return {
    reason: `Because you watch ${top.anchor.show.name}`,
    detail: genres ? `${who} · ${genres}` : who,
  };
}

export function rankRecommendations(
  candidates: Candidate[],
  taste: Taste,
  limit = 30,
): Recommendation[] {
  const merged = new Map<number, Candidate>();
  for (const candidate of candidates) {
    if (taste.tracked.has(candidate.show.id)) continue;
    const existing = merged.get(candidate.show.id);
    if (existing) existing.via.push(...candidate.via);
    else merged.set(candidate.show.id, { show: candidate.show, via: [...candidate.via] });
  }

  return [...merged.values()]
    .map((candidate) => ({ candidate, matched: matchedGenres(candidate.show, taste) }))
    // An actor's cooking show is not a pick: anything with genres must share one of yours.
    .filter(
      ({ candidate, matched }) =>
        taste.genres.size === 0 || candidate.show.genres.length === 0 || matched.length > 0,
    )
    .map(({ candidate, matched }) => ({
      show: candidate.show,
      score: scoreCandidate(candidate, taste),
      genres: matched,
      ...describe(candidate, taste, matched),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.show.weight ?? 0) - (a.show.weight ?? 0) ||
        a.show.id - b.show.id,
    )
    .slice(0, limit);
}

/**
 * A library changes shape as you watch; this says when the picks are worth
 * recomputing rather than serving from cache.
 */
export function librarySignature(shows: TrackedShow[], now: Date = new Date()): string {
  return shows
    .map((entry) => `${entry.show.id}:${progressFor(entry, now).watched}`)
    .sort()
    .join(',');
}
