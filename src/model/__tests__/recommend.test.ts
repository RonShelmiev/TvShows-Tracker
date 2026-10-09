import type { Episode, ShowSummary } from '../../api/types';
import type { TrackedShow } from '../progress';
import {
  buildTaste,
  genreCandidates,
  genreScore,
  librarySignature,
  matchedGenres,
  rankRecommendations,
  scoreCandidate,
  type Candidate,
} from '../recommend';

const NOW = new Date('2026-09-10T12:00:00Z');

function show(id: number, name: string, genres: string[], rating: number | null = 8): ShowSummary {
  return {
    id,
    name,
    image: null,
    imageLarge: null,
    premiered: '2020-01-01',
    ended: null,
    genres,
    network: 'BBC Two',
    runtime: 50,
    status: 'Running',
    summary: null,
    language: 'English',
    rating,
    weight: 90,
  };
}

function episodes(showId: number, count: number): Episode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: showId * 1000 + i,
    name: `Episode ${i + 1}`,
    season: 1,
    number: i + 1,
    airdate: '2021-01-01',
    airstamp: '2021-01-01T21:00:00+00:00',
    runtime: 50,
  }));
}

function tracked(
  summary: ShowSummary,
  total: number,
  watched: number,
  lastWatchedAt: number | null = null,
): TrackedShow {
  const eps = episodes(summary.id, total);
  return {
    show: summary,
    episodes: eps,
    watched: eps.slice(0, watched).map((e) => e.id),
    addedAt: 0,
    lastWatchedAt,
    episodesFetchedAt: null,
  };
}

const vault = show(1, 'Vault City', ['Drama', 'Crime']);
const ember = show(2, 'Ash & Ember', ['Drama']);
const comedy = show(3, 'Loose Ends', ['Comedy']);

const DAY = 24 * 60 * 60 * 1000;
const LONG_AGO = NOW.getTime() - 200 * DAY;

describe('buildTaste', () => {
  it('weights genres by episodes watched, with diminishing returns', () => {
    // Both finished: 36 drama+crime episodes against 9 comedy ones -> sqrt 6 vs 3.
    const taste = buildTaste([tracked(vault, 36, 36), tracked(comedy, 9, 9)], NOW);
    expect(taste.genres.get('Drama')).toBeCloseTo(6 / 9);
    expect(taste.genres.get('Crime')).toBeCloseTo(6 / 9);
    expect(taste.genres.get('Comedy')).toBeCloseTo(3 / 9);
  });

  it('counts a show you are watching now above a bigger one you finished', () => {
    const taste = buildTaste([tracked(vault, 25, 25), tracked(comedy, 20, 9)], NOW);
    // Finished: sqrt(25) = 5. Watching: sqrt(9) * 2 = 6.
    expect(taste.anchors.map((a) => a.show.id)).toEqual([3, 1]);
    expect(taste.anchors[0].watching).toBe(true);
    expect(taste.anchors[1].watching).toBe(false);
    expect(taste.genres.get('Comedy')).toBeGreaterThan(taste.genres.get('Drama') ?? 0);
  });

  it('treats an unfinished show left alone for months as paused, not current', () => {
    const recent = buildTaste([tracked(comedy, 20, 9, NOW.getTime() - DAY)], NOW);
    const stale = buildTaste([tracked(comedy, 20, 9, LONG_AGO)], NOW);
    expect(recent.anchors[0].watching).toBe(true);
    expect(stale.anchors[0].watching).toBe(false);
    expect(stale.anchors[0].weight).toBeLessThan(recent.anchors[0].weight);
  });

  it('uses a show you have just started watching', () => {
    const taste = buildTaste([tracked(vault, 40, 30), tracked(comedy, 10, 1)], NOW);
    expect(taste.anchors.map((a) => a.show.id)).toContain(3);
  });

  it('ignores a single episode of a show you have since abandoned', () => {
    const taste = buildTaste([tracked(vault, 40, 30), tracked(comedy, 10, 1, LONG_AGO)], NOW);
    expect(taste.anchors.map((a) => a.show.id)).toEqual([1]);
    // It still says something about your genres.
    expect(taste.genres.get('Comedy')).toBeGreaterThan(0);
  });

  it('records the languages you watch', () => {
    expect(buildTaste([tracked(vault, 40, 30)], NOW).languages).toEqual(new Set(['English']));
  });

  it('returns no anchors when nothing is watched', () => {
    expect(buildTaste([tracked(vault, 40, 0)], NOW).anchors).toEqual([]);
    expect(buildTaste([], NOW).anchors).toEqual([]);
  });

  it('still lists tracked ids for shows with nothing watched, so they are never suggested', () => {
    expect(buildTaste([tracked(vault, 40, 0)], NOW).tracked.has(1)).toBe(true);
  });
});

describe('scoreCandidate', () => {
  const taste = buildTaste([tracked(vault, 40, 30), tracked(comedy, 10, 10)], NOW);

  it('ranks a shared actor from your heaviest show above one from a lighter show', () => {
    const fromVault: Candidate = { show: show(10, 'A', ['Drama']), via: [{ personName: 'Jo', anchorId: 1 }] };
    const fromComedy: Candidate = { show: show(11, 'B', ['Drama']), via: [{ personName: 'Sam', anchorId: 3 }] };
    expect(scoreCandidate(fromVault, taste)).toBeGreaterThan(scoreCandidate(fromComedy, taste));
  });

  it('ranks two shared actors above one', () => {
    const one: Candidate = { show: show(10, 'A', ['Drama']), via: [{ personName: 'Jo', anchorId: 1 }] };
    const two: Candidate = {
      show: show(11, 'B', ['Drama']),
      via: [
        { personName: 'Jo', anchorId: 1 },
        { personName: 'Kit', anchorId: 1 },
      ],
    };
    expect(scoreCandidate(two, taste)).toBeGreaterThan(scoreCandidate(one, taste));
  });

  it('does not double count one person credited through the same show twice', () => {
    const once: Candidate = { show: show(10, 'A', ['Drama']), via: [{ personName: 'Jo', anchorId: 1 }] };
    const twice: Candidate = {
      show: show(10, 'A', ['Drama']),
      via: [
        { personName: 'Jo', anchorId: 1 },
        { personName: 'Jo', anchorId: 1 },
      ],
    };
    expect(scoreCandidate(twice, taste)).toBeCloseTo(scoreCandidate(once, taste));
  });

  it('prefers a genre you watch when nothing else separates two shows', () => {
    const drama: Candidate = { show: show(10, 'A', ['Drama']), via: [] };
    const western: Candidate = { show: show(11, 'B', ['Western']), via: [] };
    expect(scoreCandidate(drama, taste)).toBeGreaterThan(scoreCandidate(western, taste));
  });

  it('lets a better rating break a tie', () => {
    const good: Candidate = { show: show(10, 'A', ['Drama'], 9), via: [] };
    const poor: Candidate = { show: show(11, 'B', ['Drama'], 6), via: [] };
    expect(scoreCandidate(good, taste)).toBeGreaterThan(scoreCandidate(poor, taste));
  });

  it('treats an unrated show as middling rather than bad', () => {
    const unrated: Candidate = { show: show(10, 'A', ['Drama'], null), via: [] };
    const poor: Candidate = { show: show(11, 'B', ['Drama'], 6), via: [] };
    expect(scoreCandidate(unrated, taste)).toBeGreaterThan(scoreCandidate(poor, taste));
  });
});

describe('rankRecommendations', () => {
  const taste = buildTaste([tracked(vault, 40, 30), tracked(ember, 20, 10)], NOW);

  it('never suggests a show you already track', () => {
    const ranked = rankRecommendations(
      [
        { show: vault, via: [{ personName: 'Jo', anchorId: 2 }] },
        { show: show(10, 'New', ['Drama']), via: [{ personName: 'Jo', anchorId: 1 }] },
      ],
      taste,
    );
    expect(ranked.map((r) => r.show.id)).toEqual([10]);
  });

  it('merges duplicate candidates and combines their links', () => {
    const ranked = rankRecommendations(
      [
        { show: show(10, 'New', ['Drama']), via: [{ personName: 'Jo', anchorId: 1 }] },
        { show: show(10, 'New', ['Drama']), via: [{ personName: 'Kit', anchorId: 1 }] },
      ],
      taste,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].detail).toContain('+ 1 more');
  });

  it('explains a pick by naming the show it came from', () => {
    const ranked = rankRecommendations(
      [{ show: show(10, 'New', ['Drama', 'Crime']), via: [{ personName: 'Jo Blogs', anchorId: 1 }] }],
      taste,
    );
    expect(ranked[0].reason).toBe('Because you watch Vault City');
    expect(ranked[0].detail).toBe('Jo Blogs is in both · Drama, Crime');
  });

  it('credits the heaviest show when a person links through two of yours', () => {
    const ranked = rankRecommendations(
      [
        {
          show: show(10, 'New', ['Drama']),
          via: [
            { personName: 'Jo', anchorId: 2 },
            { personName: 'Jo', anchorId: 1 },
          ],
        },
      ],
      taste,
    );
    expect(ranked[0].reason).toBe('Because you watch Vault City');
  });

  it('explains a genre pick by naming the closest show you watch', () => {
    const ranked = rankRecommendations([{ show: show(10, 'New', ['Drama', 'Crime']), via: [] }], taste);
    expect(ranked[0].reason).toBe('Drama + Crime, like Vault City');
    expect(ranked[0].detail).toBe("You're watching Vault City now · Drama, Crime");
    expect(ranked[0].genres).toEqual(['Drama', 'Crime']);
  });

  it('does not claim you are watching a show you finished', () => {
    const finished = buildTaste([tracked(vault, 30, 30)], NOW);
    const ranked = rankRecommendations([{ show: show(10, 'New', ['Crime']), via: [] }], finished);
    expect(ranked[0].reason).toBe('Crime, like Vault City');
    expect(ranked[0].detail).toBe('Crime');
  });

  it('drops a cast-linked show in a genre you never watch', () => {
    const ranked = rankRecommendations(
      [
        { show: show(10, 'Bake Off', ['Food']), via: [{ personName: 'Jo', anchorId: 1 }] },
        { show: show(11, 'Untagged', []), via: [{ personName: 'Jo', anchorId: 1 }] },
      ],
      taste,
    );
    expect(ranked.map((r) => r.show.id)).toEqual([11]);
  });

  it('ranks a strong genre match above a cast link in a weak one', () => {
    const ranked = rankRecommendations(
      [
        { show: show(10, 'Genre', ['Drama', 'Crime']), via: [] },
        { show: show(11, 'Cast', ['Drama', 'Sports', 'Music']), via: [{ personName: 'Jo', anchorId: 2 }] },
      ],
      taste,
    );
    expect(ranked[0].show.id).toBe(10);
  });

  it('respects the limit and returns the best first', () => {
    const many: Candidate[] = Array.from({ length: 30 }, (_, i) => ({
      show: show(100 + i, `Show ${i}`, ['Drama'], 6 + (i % 4)),
      via: [],
    }));
    const ranked = rankRecommendations(many, taste, 5);
    expect(ranked).toHaveLength(5);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it('is deterministic for equally scored shows', () => {
    const candidates: Candidate[] = [
      { show: show(20, 'B', ['Drama']), via: [] },
      { show: show(10, 'A', ['Drama']), via: [] },
    ];
    expect(rankRecommendations(candidates, taste).map((r) => r.show.id)).toEqual([10, 20]);
  });

  it('returns nothing when every candidate is already tracked', () => {
    expect(rankRecommendations([{ show: vault, via: [] }], taste)).toEqual([]);
  });
});

describe('genreScore', () => {
  const taste = buildTaste([tracked(vault, 36, 36), tracked(comedy, 9, 9)], NOW);

  it('scores your favourite genres highest', () => {
    expect(genreScore(show(10, 'A', ['Drama', 'Crime']), taste)).toBeCloseTo(1);
    expect(genreScore(show(10, 'A', ['Drama']), taste)).toBeGreaterThan(
      genreScore(show(11, 'B', ['Comedy']), taste),
    );
  });

  it('dilutes the match for genres you never watch', () => {
    expect(genreScore(show(10, 'A', ['Drama']), taste)).toBeGreaterThan(
      genreScore(show(11, 'B', ['Drama', 'Western']), taste),
    );
  });

  it('is zero for a show with no genres', () => {
    expect(genreScore(show(10, 'A', []), taste)).toBe(0);
  });

  it('lists matched genres most-watched first', () => {
    expect(matchedGenres(show(10, 'A', ['Western', 'Comedy', 'Drama']), taste)).toEqual(['Drama', 'Comedy']);
  });
});

describe('genreCandidates', () => {
  const taste = buildTaste([tracked(vault, 36, 36), tracked(comedy, 9, 9)], NOW);

  it('keeps well-rated shows in your genres and drops the rest', () => {
    const french = { ...show(13, 'Policier', ['Drama', 'Crime']), language: 'French' };
    const pool = [
      show(10, 'Good crime', ['Crime', 'Drama'], 8.2),
      show(11, 'Poor crime', ['Crime', 'Drama'], 5.1),
      show(12, 'Western', ['Western'], 9),
      french,
      vault,
    ];
    expect(genreCandidates(pool, taste).map((c) => c.show.id)).toEqual([10]);
  });

  it('admits an unrated show only when it is popular', () => {
    const known = { ...show(10, 'Known', ['Drama'], null), weight: 95 };
    const obscure = { ...show(11, 'Obscure', ['Drama'], null), weight: 20 };
    expect(genreCandidates([known, obscure], taste).map((c) => c.show.id)).toEqual([10]);
  });

  it('dedupes, puts the best match first and respects the limit', () => {
    const pool = [
      show(10, 'Drama only', ['Drama'], 7),
      show(11, 'Drama crime', ['Drama', 'Crime'], 7),
      show(11, 'Drama crime', ['Drama', 'Crime'], 7),
    ];
    expect(genreCandidates(pool, taste, 1).map((c) => c.show.id)).toEqual([11]);
  });
});

describe('librarySignature', () => {
  it('changes when an episode is watched', () => {
    const before = librarySignature([tracked(vault, 40, 30)], NOW);
    const after = librarySignature([tracked(vault, 40, 31)], NOW);
    expect(before).not.toBe(after);
  });

  it('ignores the order shows are stored in', () => {
    const a = librarySignature([tracked(vault, 40, 30), tracked(ember, 20, 10)], NOW);
    const b = librarySignature([tracked(ember, 20, 10), tracked(vault, 40, 30)], NOW);
    expect(a).toBe(b);
  });
});
