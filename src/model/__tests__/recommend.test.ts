import type { Episode, ShowSummary } from '../../api/types';
import type { TrackedShow } from '../progress';
import {
  buildTaste,
  librarySignature,
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

function tracked(summary: ShowSummary, total: number, watched: number): TrackedShow {
  const eps = episodes(summary.id, total);
  return {
    show: summary,
    episodes: eps,
    watched: eps.slice(0, watched).map((e) => e.id),
    addedAt: 0,
    lastWatchedAt: null,
    episodesFetchedAt: null,
  };
}

const vault = show(1, 'Vault City', ['Drama', 'Crime']);
const ember = show(2, 'Ash & Ember', ['Drama']);
const comedy = show(3, 'Loose Ends', ['Comedy']);

describe('buildTaste', () => {
  it('weights genres by episodes watched, not by show count', () => {
    const taste = buildTaste([tracked(vault, 40, 30), tracked(comedy, 10, 10)], NOW);
    // 30 drama+crime episodes against 10 comedy ones.
    expect(taste.genres.get('Drama')).toBeCloseTo(0.75);
    expect(taste.genres.get('Crime')).toBeCloseTo(0.75);
    expect(taste.genres.get('Comedy')).toBeCloseTo(0.25);
  });

  it('orders anchors by how much you have watched', () => {
    const taste = buildTaste([tracked(comedy, 10, 4), tracked(vault, 40, 30)], NOW);
    expect(taste.anchors.map((a) => a.show.id)).toEqual([1, 3]);
    expect(taste.anchors[0].share).toBeCloseTo(30 / 34);
  });

  it('ignores shows you have barely started', () => {
    const taste = buildTaste([tracked(vault, 40, 30), tracked(comedy, 10, 1)], NOW);
    expect(taste.anchors.map((a) => a.show.id)).toEqual([1]);
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

  it('falls back to a genre explanation when there is no cast link', () => {
    const ranked = rankRecommendations([{ show: show(10, 'New', ['Drama']), via: [] }], taste);
    expect(ranked[0].reason).toBe('More drama, which you watch a lot of');
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
