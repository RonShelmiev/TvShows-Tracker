import { parseEpisode, parseShow, posterUri, stripHtml } from '../tvmaze';

describe('stripHtml', () => {
  it('turns a TVmaze summary into plain text', () => {
    expect(stripHtml('<p><b>Vault City</b> is a drama.</p>')).toBe('Vault City is a drama.');
  });

  it('decodes the entities TVmaze actually emits', () => {
    expect(stripHtml('<p>Tom &amp; Jerry &#39;92 &quot;fun&quot;</p>')).toBe('Tom & Jerry \'92 "fun"');
  });

  it('returns null for empty or missing summaries', () => {
    expect(stripHtml(null)).toBeNull();
    expect(stripHtml('<p></p>')).toBeNull();
  });
});

describe('parseShow', () => {
  it('reads the fields the app uses', () => {
    const show = parseShow({
      id: 82,
      name: 'Game of Thrones',
      image: { medium: 'http://x/medium.jpg', original: 'http://x/original.jpg' },
      premiered: '2011-04-17',
      ended: '2019-05-19',
      genres: ['Drama', 'Fantasy'],
      network: { name: 'HBO' },
      runtime: 60,
      status: 'Ended',
      summary: '<p>Seven noble families fight.</p>',
      language: 'English',
    });
    expect(show).toMatchObject({
      id: 82,
      name: 'Game of Thrones',
      image: 'http://x/medium.jpg',
      imageLarge: 'http://x/original.jpg',
      network: 'HBO',
      summary: 'Seven noble families fight.',
    });
  });

  it('falls back to the web channel and average runtime', () => {
    const show = parseShow({
      id: 5,
      name: 'Streaming Only',
      webChannel: { name: 'Netflix' },
      averageRuntime: 42,
      genres: null,
    });
    expect(show?.network).toBe('Netflix');
    expect(show?.runtime).toBe(42);
    expect(show?.genres).toEqual([]);
  });

  it('rejects entries without an id or a name', () => {
    expect(parseShow({ name: 'No id' })).toBeNull();
    expect(parseShow(null)).toBeNull();
  });

  it('nulls out missing images and dates rather than guessing', () => {
    const show = parseShow({ id: 9, name: 'Bare', image: null, premiered: null });
    expect(show?.image).toBeNull();
    expect(show?.premiered).toBeNull();
  });
});

describe('parseEpisode', () => {
  it('reads a regular episode', () => {
    expect(
      parseEpisode({
        id: 4952,
        name: 'Winter Is Coming',
        season: 1,
        number: 1,
        airdate: '2011-04-17',
        airstamp: '2011-04-18T01:00:00+00:00',
        runtime: 60,
      }),
    ).toEqual({
      id: 4952,
      name: 'Winter Is Coming',
      season: 1,
      number: 1,
      airdate: '2011-04-17',
      airstamp: '2011-04-18T01:00:00+00:00',
      runtime: 60,
    });
  });

  it('skips specials, which TVmaze gives a null number', () => {
    expect(parseEpisode({ id: 1, name: 'Special', season: 1, number: null })).toBeNull();
  });

  it('names an untitled episode after its number', () => {
    expect(parseEpisode({ id: 2, season: 2, number: 5, name: null })?.name).toBe('Episode 5');
  });
});

describe('posterUri', () => {
  it('upgrades TVmaze http image urls, which iOS blocks', () => {
    expect(posterUri({ image: 'http://static.tvmaze.com/a.jpg' })).toBe(
      'https://static.tvmaze.com/a.jpg',
    );
  });

  it('passes through https and null', () => {
    expect(posterUri({ image: 'https://x/a.jpg' })).toBe('https://x/a.jpg');
    expect(posterUri({ image: null })).toBeNull();
  });
});
