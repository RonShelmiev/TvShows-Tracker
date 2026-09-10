import type { Episode, ShowSummary } from '../../api/types';
import {
  episodeCode,
  episodesInSeason,
  formatAirdate,
  formatMinutes,
  hasAired,
  markNext,
  markUpTo,
  progressFor,
  pruneWatched,
  seasonBreakdown,
  setSeasonWatched,
  showYears,
  sortEpisodes,
  toggleEpisode,
  type TrackedShow,
} from '../progress';

const NOW = new Date('2026-08-26T12:00:00Z');

const show: ShowSummary = {
  id: 1,
  name: 'Vault City',
  image: null,
  imageLarge: null,
  premiered: '2021-03-14',
  ended: null,
  genres: ['Drama'],
  network: 'BBC Two',
  runtime: 50,
  status: 'Running',
  summary: null,
  language: 'English',
  rating: 8.2,
  weight: 92,
};

function episode(season: number, number: number, airdate: string, runtime: number | null = 50): Episode {
  return {
    id: season * 100 + number,
    name: `S${season} E${number}`,
    season,
    number,
    airdate,
    airstamp: `${airdate}T21:00:00+00:00`,
    runtime,
  };
}

function library(watched: number[] = []): TrackedShow {
  return {
    show,
    episodes: [
      episode(1, 1, '2021-03-14'),
      episode(1, 2, '2021-03-21'),
      episode(1, 3, '2021-03-28'),
      episode(2, 1, '2022-04-03'),
      episode(2, 2, '2026-09-30'), // not aired yet
    ],
    watched,
    addedAt: 0,
    lastWatchedAt: null,
    episodesFetchedAt: null,
  };
}

describe('episodeCode', () => {
  it('pads season and episode to two digits', () => {
    expect(episodeCode(3, 7)).toBe('S03E07');
    expect(episodeCode(12, 104)).toBe('S12E104');
  });
});

describe('sortEpisodes', () => {
  it('orders by season then number, without mutating the input', () => {
    const input = [episode(2, 1, '2022-04-03'), episode(1, 2, '2021-03-21'), episode(1, 1, '2021-03-14')];
    const sorted = sortEpisodes(input);
    expect(sorted.map((e) => e.id)).toEqual([101, 102, 201]);
    expect(input[0].season).toBe(2);
  });
});

describe('hasAired', () => {
  it('is true for past air dates and false for future ones', () => {
    expect(hasAired(episode(1, 1, '2021-03-14'), NOW)).toBe(true);
    expect(hasAired(episode(2, 2, '2026-09-30'), NOW)).toBe(false);
  });

  it('treats an unknown air date as not aired', () => {
    expect(hasAired({ ...episode(1, 1, '2021-03-14'), airdate: null, airstamp: null }, NOW)).toBe(false);
  });
});

describe('progressFor', () => {
  it('counts watched episodes and the percentage', () => {
    const progress = progressFor(library([101, 102]), NOW);
    expect(progress.watched).toBe(2);
    expect(progress.total).toBe(5);
    expect(progress.pct).toBe(40);
    expect(progress.left).toBe(3);
  });

  it('picks the first unwatched episode in air order as next', () => {
    const progress = progressFor(library([101, 103]), NOW);
    expect(progress.next?.id).toBe(102);
    expect(progress.nextAired?.id).toBe(102);
  });

  it('separates the next unwatched episode from the next aired one', () => {
    const progress = progressFor(library([101, 102, 103, 201]), NOW);
    expect(progress.next?.id).toBe(202); // future episode
    expect(progress.nextAired).toBeNull();
    expect(progress.behind).toBe(0);
  });

  it('reports how many aired episodes are waiting', () => {
    expect(progressFor(library([101]), NOW).behind).toBe(3);
  });

  it('sums the runtime still to watch, falling back to the show runtime', () => {
    const tracked = library([101, 102, 103]);
    tracked.episodes = tracked.episodes.map((e) =>
      e.id === 201 ? { ...e, runtime: null } : e,
    );
    // 201 falls back to the show's 50, 202 keeps its own 50.
    expect(progressFor(tracked, NOW).minutesLeft).toBe(100);
  });

  it('handles a show with no episodes', () => {
    const empty = { ...library(), episodes: [] };
    const progress = progressFor(empty, NOW);
    expect(progress.pct).toBe(0);
    expect(progress.total).toBe(0);
    expect(progress.next).toBeNull();
  });

  it('ignores watched ids that are not in the episode list', () => {
    expect(progressFor(library([999]), NOW).watched).toBe(0);
  });
});

describe('seasonBreakdown', () => {
  it('summarises each season in order', () => {
    const seasons = seasonBreakdown(library([101, 102, 103, 201]));
    expect(seasons).toEqual([
      { season: 1, watched: 3, total: 3, pct: 100, complete: true },
      { season: 2, watched: 1, total: 2, pct: 50, complete: false },
    ]);
  });
});

describe('episodesInSeason', () => {
  it('returns only that season, in order', () => {
    expect(episodesInSeason(library(), 1).map((e) => e.number)).toEqual([1, 2, 3]);
  });
});

describe('toggleEpisode', () => {
  it('adds an unwatched episode and removes a watched one', () => {
    expect(toggleEpisode([101], 102)).toEqual([101, 102]);
    expect(toggleEpisode([101, 102], 101)).toEqual([102]);
  });
});

describe('markUpTo', () => {
  it('marks everything up to and including the chosen episode', () => {
    expect(markUpTo(library(), 201).sort()).toEqual([101, 102, 103, 201]);
  });

  it('keeps episodes already watched beyond that point', () => {
    expect(markUpTo(library([202]), 102).sort()).toEqual([101, 102, 202]);
  });

  it('does not duplicate ids', () => {
    expect(markUpTo(library([101]), 102).sort()).toEqual([101, 102]);
  });

  it('leaves the list alone for an unknown episode', () => {
    expect(markUpTo(library([101]), 55555)).toEqual([101]);
  });
});

describe('markNext', () => {
  it('marks the next aired episode', () => {
    expect(markNext(library([101]), NOW)).toContain(102);
  });

  it('falls back to the next unaired episode when nothing aired is left', () => {
    expect(markNext(library([101, 102, 103, 201]), NOW)).toContain(202);
  });

  it('is a no-op once everything is watched', () => {
    const all = [101, 102, 103, 201, 202];
    expect(markNext(library(all), NOW).sort()).toEqual(all.sort());
  });
});

describe('setSeasonWatched', () => {
  it('marks and clears a whole season without touching others', () => {
    const marked = setSeasonWatched(library([201]), 1, true);
    expect(marked.sort()).toEqual([101, 102, 103, 201]);
    expect(setSeasonWatched(library(marked), 1, false)).toEqual([201]);
  });
});

describe('pruneWatched', () => {
  it('drops ids for episodes that no longer exist', () => {
    expect(pruneWatched(library([101, 424242]))).toEqual([101]);
  });
});

describe('formatMinutes', () => {
  it('formats hours and minutes', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(624)).toBe('10h 24m');
  });
});

describe('formatAirdate', () => {
  it('drops the year for the current year and keeps it otherwise', () => {
    const thisYear = new Date().getFullYear();
    expect(formatAirdate(`${thisYear}-08-13`)).toBe('13 Aug');
    expect(formatAirdate('2021-03-14')).toBe('14 Mar 2021');
    expect(formatAirdate(null)).toBe('TBA');
    expect(formatAirdate('nonsense')).toBe('nonsense');
  });
});

describe('showYears', () => {
  it('shows a range for ended shows and a single year for running ones', () => {
    expect(showYears(show)).toBe('2021');
    expect(showYears({ ...show, ended: '2024-05-01', status: 'Ended' })).toBe('2021–2024');
    expect(showYears({ ...show, premiered: null })).toBe('');
  });
});
