export interface IMetadata {
  headers: { [id: string] : string},
  ip: string,
  url: string,
  dns: { host: string, data: string[]};
}

export type TMetadataAttributes = { trait_type: string, value: string}[];

export interface ITweetCard {
  description: string;
  domain: string;
  thumbnail_image_original: string;
  vanity_url: string;
  title: string;
  card_url: string;
}

export interface ITweetBody {
  full_text: string;
  card: ITweetCard | null;
  urls: string[] | null;
  hashtags: string[] | null;
  symbols: string[] | null;
  media: string[] | null;
  user_mentions: string[] | null;
}

export interface ITweetUser {
  profile_image_url_https: string;
  name: string;
  screen_name: string;
}

export interface ITweetDetails {
  created_at: string;
  favorite_count: number;
  quote_count: number;
  retweet_count: number;
  views_count: string;
}
export interface ITweetData {
  body: ITweetBody;
  user: ITweetUser;
  details: ITweetDetails;
}