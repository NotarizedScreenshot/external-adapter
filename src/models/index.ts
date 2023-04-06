import {
  ITweetBody,
  ITweetData,
  ITweetDetails,
  ITweetResults,
  ITweetUser,
} from 'types';

export const createTweetData = (tweetResults: ITweetResults): ITweetData => {
  const { legacy, views, core, card } = tweetResults;
  const {
    full_text,
    created_at,
    favorite_count,
    quote_count,
    retweet_count,
    entities,
    extended_entities,
  } = legacy;

  const { user_mentions, urls, hashtags, symbols } = entities;

  const media = extended_entities?.media ?? [];

  const { profile_image_url_https, name, screen_name } = core.user_results.result.legacy;

  const user: ITweetUser = {
    profile_image_url_https,
    name,
    screen_name,
  };

  const views_count = views.count;
  const details: ITweetDetails = {
    created_at,
    favorite_count,
    quote_count,
    retweet_count,
    views_count,
  };

  const props = [
    'vanity_url',
    'card_url',
    'title',
    'description',
    'domain',
    'thumbnail_image_original',
    'player_image_original',
  ];

  const cardData: ITweetBody['card'] = !card
    ? null
    : card?.legacy.binding_values.reduce((acc: any, val: any) => {
        if (props.includes(val.key)) {
          if (val.value.type === 'STRING') {
            acc[val.key] = val.value.string_value;
          }

          if (val.value.type === 'IMAGE') {
            acc[val.key] = val.value.image_value.url;
          }
        }
        return acc;
      }, {});

  const tweetUrls: ITweetBody['urls'] =
    !urls || urls.length === 0
      ? null
      : urls?.map((url: { expanded_url: string }) => url.expanded_url);

  const tweetHashTags: ITweetBody['hashtags'] =
    !hashtags || hashtags.length === 0
      ? null
      : hashtags?.map((hashtag: { text: string }) => hashtag.text);

  const tweetSymbols: ITweetBody['symbols'] =
    !symbols || symbols.length === 0
      ? null
      : symbols?.map((symbol: { text: string }) => symbol.text);

  const tweetMedia: ITweetBody['media'] = !media
    ? null
    : media.map(
        ({
          type,
          media_url_https,
          video_info,
        }: {
          media_url_https: string;
          type: 'photo' | 'video';
          video_info: { variants: any[] };
        }) => {
          if (type === 'video') {
            const maxBitrateVariant = video_info.variants.reduce((acc, val) => {
              if ((!!acc.bitrate && val.bitrate > acc.bitrate) || (!acc.bitrate && val.bitrate))
                return val;
              return acc;
            }, {});
            const minBitrateVariant = video_info.variants.reduce((acc, val) => {
              if ((!!acc.bitrate && val.bitrate < acc.bitrate) || (!acc.bitrate && val.bitrate))
                return val;
              return acc;
            }, {});

            return { type, src: maxBitrateVariant.url, thumb: media_url_https };
          }
          return { type, src: media_url_https };
        },
      );

  const tweetMentions: ITweetBody['user_mentions'] = !user_mentions
    ? null
    : user_mentions.map((mention: { screen_name: string }) => mention.screen_name);

  const body: ITweetBody = {
    full_text,
    card: cardData,
    urls: tweetUrls,
    hashtags: tweetHashTags,
    symbols: tweetSymbols,
    media: tweetMedia,
    user_mentions: tweetMentions,
  };

  const tweetData = {
    body,
    user,
    details,
  };
  return tweetData;
};
