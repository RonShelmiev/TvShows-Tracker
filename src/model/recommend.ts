import type { ShowSummary } from '../api/types';
import { progressFor, type TrackedShow } from './progress';

/**
 * TVmaze has no recommendations endpoint, so we build our own from two signals
 * it does expose: the people in a show, and its genres. Both are explainable —
 * every pick can say which of your shows it came from, which matters more than
 * a slightly better ranking you cannot argue with.
 */

/** What your library says you like. */
export type Taste = {
  /** Shows already tracked — never recommend these back. */
  tracked: Set<number>;
  /** Genre -> share of your watching, summing to 1. */
  genres: Map<string, number>;
  /** The shows worth mining for cast, heaviest first. */
  anchors: Anchor[];
};

export type Anchor = {
  show: ShowSummary;
  /** Episodes actually watched — a show you finished counts more than one you sampled. */
  weight: number;
  /** This anchor's share of all your watching, 0-1. */
  share: number;
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
  /** "Because you watch Vault City" — the headline justification. */
  reason: string;
  /** "Jane Doe was in both · Drama, Crime" */
  detail: string;
};

const MIN_ANCHOR_EPISODES = 2;

export function buildTaste(shows: TrackedShow[], now: Date = new Date()): Taste {
  const tracked = new Set(shows.map((s) => s.show.id));
  const genreTotals = new Map<string, number>();
  const weighted: { show: ShowSummary; weight: number }[] = [];
  let total = 0;

  for (const entry of shows) {
    const weight = progressFor(entry, now).watched;
    if (weight <= 0) continue;
    total += weight;
    weighted.push({ show: entry.show, weight });
    for (const genre of entry.show.genres) {
      genreTotals.set(genre, (genreTotals.get(genre) ?? 0) + weight);
    }
  }

  const genres = new Map<string, number>();
  if (total > 0) {
    for (const [genre, count] of genreTotals) genres.set(genre, count / total);
  }

  const anchors: Anchor[] = weighted
    .filter((entry) => entry.weight >= MIN_ANCHOR_EPISODES)
    .sort((a, b) => b.weight - a.weight || a.show.id - b.show.id)
    .map((entry) => ({ ...entry, share: total === 0 ? 0 : entry.weight / total }));

  return { tracked, genres, anchors };
}

/** Diminishing returns: the fifth shared actor should not count like the first. */
function damp(value: number): number {
  return 1 - Math.exp(-value);
}

function genreScore(show: ShowSummary, taste: Taste): number {
  let score = 0;
  for (const genre of show.genres) score += taste.genres.get(genre) ?? 0;
  return Math.min(score, 1);
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
    0.6 * peopleScore(candidate, taste) +
    0.3 * genreScore(candidate.show, taste) +
    0.1 * ratingScore(candidate.show)
  );
}

function describe(candidate: Candidate, taste: Taste): { reason: string; detail: string } {
  const anchorById = new Map(taste.anchors.map((a) => [a.show.id, a]));
  const linked = candidate.via
    .map((link) => ({ link, anchor: anchorById.get(link.anchorId) }))
    .filter((row): row is { link: CandidateLink; anchor: Anchor } => !!row.anchor)
    .sort((a, b) => b.anchor.share - a.anchor.share);

  const genres = candidate.show.genres.slice(0, 2).join(', ');

  if (linked.length === 0) {
    const best = [...candidate.show.genres]
      .map((genre) => ({ genre, share: taste.genres.get(genre) ?? 0 }))
      .sort((a, b) => b.share - a.share)[0];
    return {
      reason: best && best.share > 0 ? `More ${best.genre.toLowerCase()}, which you watch a lot of` : 'Worth a look',
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
  limit = 20,
): Recommendation[] {
  const merged = new Map<number, Candidate>();
  for (const candidate of candidates) {
    if (taste.tracked.has(candidate.show.id)) continue;
    const existing = merged.get(candidate.show.id);
    if (existing) existing.via.push(...candidate.via);
    else merged.set(candidate.show.id, { show: candidate.show, via: [...candidate.via] });
  }

  return [...merged.values()]
    .map((candidate) => ({
      show: candidate.show,
      score: scoreCandidate(candidate, taste),
      ...describe(candidate, taste),
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
