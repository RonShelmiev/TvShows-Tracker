/** Normalised shapes the app works with — never raw TVmaze JSON. */
export type ShowSummary = {
  id: number;
  name: string;
  image: string | null;
  imageLarge: string | null;
  premiered: string | null;
  ended: string | null;
  genres: string[];
  network: string | null;
  runtime: number | null;
  status: string | null;
  summary: string | null;
  language: string | null;
  /** TVmaze's own 0-10 average, when enough people have voted. */
  rating: number | null;
  /** TVmaze's 0-100 popularity weight — only ever a tie-breaker. */
  weight: number | null;
};

export type CastMember = {
  personId: number;
  name: string;
  character: string | null;
};

export type Episode = {
  id: number;
  name: string;
  season: number;
  number: number;
  airdate: string | null;
  airstamp: string | null;
  runtime: number | null;
};

export type ScheduleEntry = {
  episode: Episode;
  show: ShowSummary;
  network: string | null;
  airtime: string | null;
};
