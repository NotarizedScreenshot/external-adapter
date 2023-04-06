export interface IMetadata {
  headers: { [id: string]: string };
  ip: string;
  url: string;
  dns: { host: string; data: string[] };
}

export type TMetadataAttributes = { trait_type: string; value: string }[];

export interface ITweetResults {
  legacy: {
    full_text: string;
    created_at: string;
    favorite_count: number;
    quote_count: number;
    retweet_count: number;
    entities: {
      user_mentions: { screen_name: string }[];
      urls: { expanded_url: string }[];
      hashtags: { text: string }[];
      symbols: { text: string }[];
    };
    extended_entities: {
      media: any;
    };
  };
  views: any;
  core: any;
  card: any;
}

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
  media: { type: 'photo' | 'video'; src: string; thumb: string }[] | null;
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

export type ITweetRawData = string;

export interface IGetScreenshotResponseData {
  imageUrl: string | null;
  metadata: string | null;
  tweetdata: string | null;
}

export type ITweetPageMetaData = [IMetadata | null, ITweetRawData | null];

export interface ITweetTimelineEntry {
  entryId: string;
  sortIndex: string;
  content: {
    entryType: string;
    itemContent: {
      itemType: string;
      tweet_results: {
        result: ITweetResults;
      };
    };
  };
}
