import type { Episode, ScheduleEntry, ShowSummary } from './types';

const BASE = 'https://api.tvmaze.com';
const TIMEOUT_MS = 12_000;

export class TvmazeError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'TvmazeError';
  }
}

/**
 * TVmaze allows roughly 20 calls per 10 seconds per IP, and show/episode data
 * barely moves, so identical GETs inside a session are served from memory.
 */
const cache = new Map<string, { at: number; value: unknown }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function get<T>(path: string, signal?: AbortSignal, ttl = CACHE_TTL_MS): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const res = await fetch(BASE + path, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (res.status === 404) throw new TvmazeError('Not found on TVmaze', 404);
    if (res.status === 429) throw new TvmazeError('TVmaze is rate limiting us — try again in a moment', 429);
    if (!res.ok) throw new TvmazeError(`TVmaze responded ${res.status}`, res.status);
    const value = (await res.json()) as T;
    cache.set(path, { at: Date.now(), value });
    return value;
  } catch (err) {
    if (err instanceof TvmazeError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TvmazeError(signal?.aborted ? 'Cancelled' : 'TVmaze took too long to answer');
    }
    throw new TvmazeError('Could not reach TVmaze — check your connection');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/* -------------------------------------------------------------------------- */
/* Parsing: TVmaze nulls a lot of fields, so every read is defensive.          */
/* -------------------------------------------------------------------------- */

type Json = Record<string, any>;

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v : null;

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export function stripHtml(html: string | null): string | null {
  if (!html) return null;
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
  return text === '' ? null : text;
}

export function parseShow(raw: Json | null | undefined): ShowSummary | null {
  if (!raw || num(raw.id) === null || !str(raw.name)) return null;
  return {
    id: raw.id,
    name: raw.name,
    image: str(raw.image?.medium) ?? str(raw.image?.original),
    imageLarge: str(raw.image?.original) ?? str(raw.image?.medium),
    premiered: str(raw.premiered),
    ended: str(raw.ended),
    genres: Array.isArray(raw.genres) ? raw.genres.filter((g: unknown) => typeof g === 'string') : [],
    network: str(raw.network?.name) ?? str(raw.webChannel?.name),
    runtime: num(raw.runtime) ?? num(raw.averageRuntime),
    status: str(raw.status),
    summary: stripHtml(str(raw.summary)),
    language: str(raw.language),
  };
}

export function parseEpisode(raw: Json | null | undefined): Episode | null {
  if (!raw || num(raw.id) === null) return null;
  const season = num(raw.season);
  const number = num(raw.number);
  // number is null for specials; we track the regular run only.
  if (season === null || number === null) return null;
  return {
    id: raw.id,
    name: str(raw.name) ?? `Episode ${number}`,
    season,
    number,
    airdate: str(raw.airdate),
    airstamp: str(raw.airstamp),
    runtime: num(raw.runtime),
  };
}

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                   */
/* -------------------------------------------------------------------------- */

export async function searchShows(query: string, signal?: AbortSignal): Promise<ShowSummary[]> {
  const q = query.trim();
  if (q === '') return [];
  const raw = await get<Json[]>(`/search/shows?q=${encodeURIComponent(q)}`, signal);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => parseShow(entry?.show))
    .filter((s): s is ShowSummary => s !== null);
}

export async function getShow(id: number, signal?: AbortSignal): Promise<ShowSummary> {
  const show = parseShow(await get<Json>(`/shows/${id}`, signal));
  if (!show) throw new TvmazeError('That show came back empty from TVmaze');
  return show;
}

export async function getEpisodes(id: number, signal?: AbortSignal): Promise<Episode[]> {
  const raw = await get<Json[]>(`/shows/${id}/episodes`, signal);
  if (!Array.isArray(raw)) return [];
  return raw.map(parseEpisode).filter((e): e is Episode => e !== null);
}

/** One round trip for a show and its episodes. */
export async function getShowWithEpisodes(
  id: number,
  signal?: AbortSignal,
): Promise<{ show: ShowSummary; episodes: Episode[] }> {
  const raw = await get<Json>(`/shows/${id}?embed=episodes`, signal);
  const show = parseShow(raw);
  if (!show) throw new TvmazeError('That show came back empty from TVmaze');
  const embedded = raw?._embedded?.episodes;
  const episodes = Array.isArray(embedded)
    ? embedded.map(parseEpisode).filter((e): e is Episode => e !== null)
    : await getEpisodes(id, signal);
  return { show, episodes };
}

/** What is on today, used as the resting state of Browse. */
export async function getSchedule(
  country: string,
  date: string,
  signal?: AbortSignal,
): Promise<ScheduleEntry[]> {
  const raw = await get<Json[]>(
    `/schedule?country=${encodeURIComponent(country)}&date=${encodeURIComponent(date)}`,
    signal,
    5 * 60 * 1000,
  );
  if (!Array.isArray(raw)) return [];
  const out: ScheduleEntry[] = [];
  for (const entry of raw) {
    const episode = parseEpisode(entry);
    const show = parseShow(entry?.show);
    if (episode && show) {
      out.push({
        episode,
        show,
        network: str(entry?.show?.network?.name) ?? str(entry?.show?.webChannel?.name),
        airtime: str(entry?.airtime),
      });
    }
  }
  return out;
}

export function posterUri(show: { image: string | null }): string | null {
  // TVmaze serves http:// URLs for some older images; iOS blocks those.
  return show.image ? show.image.replace(/^http:\/\//, 'https://') : null;
}
