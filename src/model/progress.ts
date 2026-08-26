import type { Episode, ShowSummary } from '../api/types';

/** A show in your library: the TVmaze data plus what you have actually watched. */
export type TrackedShow = {
  show: ShowSummary;
  episodes: Episode[];
  /** Episode ids. An array (not a Set) so it survives JSON round trips. */
  watched: number[];
  addedAt: number;
  lastWatchedAt: number | null;
  episodesFetchedAt: number | null;
};

export type Progress = {
  watched: number;
  total: number;
  pct: number;
  left: number;
  /** First unwatched episode in air order, aired or not. */
  next: Episode | null;
  /** First unwatched episode that has actually aired — what you can mark now. */
  nextAired: Episode | null;
  /** Aired but unwatched — how far behind you are. */
  behind: number;
  minutesLeft: number;
};

export type SeasonSummary = {
  season: number;
  watched: number;
  total: number;
  pct: number;
  complete: boolean;
};

const DEFAULT_RUNTIME_MIN = 45;

export function episodeCode(season: number, number: number): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `S${pad(season)}E${pad(number)}`;
}

/** Air order: season, then episode number. */
export function sortEpisodes(episodes: readonly Episode[]): Episode[] {
  return [...episodes].sort((a, b) => (a.season - b.season) || (a.number - b.number));
}

export function hasAired(episode: Episode, now: Date = new Date()): boolean {
  if (episode.airstamp) {
    const t = Date.parse(episode.airstamp);
    if (!Number.isNaN(t)) return t <= now.getTime();
  }
  if (episode.airdate) {
    const t = Date.parse(`${episode.airdate}T23:59:59`);
    if (!Number.isNaN(t)) return t <= now.getTime();
  }
  return false;
}

function runtimeOf(episode: Episode, show: ShowSummary | null): number {
  return episode.runtime ?? show?.runtime ?? DEFAULT_RUNTIME_MIN;
}

export function progressFor(tracked: TrackedShow, now: Date = new Date()): Progress {
  const episodes = sortEpisodes(tracked.episodes);
  const seen = new Set(tracked.watched);
  const total = episodes.length;

  let watched = 0;
  let behind = 0;
  let minutesLeft = 0;
  let next: Episode | null = null;
  let nextAired: Episode | null = null;

  for (const episode of episodes) {
    if (seen.has(episode.id)) {
      watched += 1;
      continue;
    }
    minutesLeft += runtimeOf(episode, tracked.show);
    if (next === null) next = episode;
    if (hasAired(episode, now)) {
      behind += 1;
      if (nextAired === null) nextAired = episode;
    }
  }

  return {
    watched,
    total,
    pct: total === 0 ? 0 : Math.round((watched / total) * 100),
    left: total - watched,
    next,
    nextAired,
    behind,
    minutesLeft,
  };
}

export function seasonBreakdown(tracked: TrackedShow): SeasonSummary[] {
  const seen = new Set(tracked.watched);
  const bySeason = new Map<number, { watched: number; total: number }>();

  for (const episode of tracked.episodes) {
    const row = bySeason.get(episode.season) ?? { watched: 0, total: 0 };
    row.total += 1;
    if (seen.has(episode.id)) row.watched += 1;
    bySeason.set(episode.season, row);
  }

  return [...bySeason.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([season, row]) => ({
      season,
      watched: row.watched,
      total: row.total,
      pct: row.total === 0 ? 0 : Math.round((row.watched / row.total) * 100),
      complete: row.total > 0 && row.watched === row.total,
    }));
}

export function episodesInSeason(tracked: TrackedShow, season: number): Episode[] {
  return sortEpisodes(tracked.episodes.filter((e) => e.season === season));
}

/* -------------------------------------------------------------------------- */
/* Transitions — all pure: they take the watched list and return a new one.    */
/* -------------------------------------------------------------------------- */

export function toggleEpisode(watched: readonly number[], episodeId: number): number[] {
  return watched.includes(episodeId)
    ? watched.filter((id) => id !== episodeId)
    : [...watched, episodeId];
}

/**
 * "I am on this episode" — marks everything up to and including it as watched,
 * and leaves everything after it alone.
 */
export function markUpTo(tracked: TrackedShow, episodeId: number): number[] {
  const episodes = sortEpisodes(tracked.episodes);
  const index = episodes.findIndex((e) => e.id === episodeId);
  if (index === -1) return [...tracked.watched];
  const upTo = episodes.slice(0, index + 1).map((e) => e.id);
  return [...new Set([...tracked.watched, ...upTo])];
}

/** Marks the next unwatched aired episode; falls back to the next unaired one. */
export function markNext(tracked: TrackedShow, now: Date = new Date()): number[] {
  const { nextAired, next } = progressFor(tracked, now);
  const target = nextAired ?? next;
  return target ? [...tracked.watched, target.id] : [...tracked.watched];
}

export function setSeasonWatched(
  tracked: TrackedShow,
  season: number,
  watched: boolean,
): number[] {
  const ids = tracked.episodes.filter((e) => e.season === season).map((e) => e.id);
  if (watched) return [...new Set([...tracked.watched, ...ids])];
  const drop = new Set(ids);
  return tracked.watched.filter((id) => !drop.has(id));
}

/** Drops ids that no longer exist in the episode list (TVmaze re-numbering). */
export function pruneWatched(tracked: TrackedShow): number[] {
  const known = new Set(tracked.episodes.map((e) => e.id));
  return tracked.watched.filter((id) => known.has(id));
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatAirdate(airdate: string | null): string {
  if (!airdate) return 'TBA';
  const parts = airdate.split('-');
  if (parts.length !== 3) return airdate;
  const [year, month, day] = parts.map((p) => Number(p));
  if (!month || !day || month < 1 || month > 12) return airdate;
  const thisYear = new Date().getFullYear();
  const suffix = year === thisYear ? '' : ` ${year}`;
  return `${day} ${MONTHS[month - 1]}${suffix}`;
}

export function showYears(show: ShowSummary): string {
  const from = show.premiered?.slice(0, 4);
  if (!from) return '';
  const to = show.ended?.slice(0, 4);
  if (to && to !== from) return `${from}–${to}`;
  if (show.status === 'Ended' && to) return `${from}–${to}`;
  return from;
}
