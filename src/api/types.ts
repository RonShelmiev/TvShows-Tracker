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
