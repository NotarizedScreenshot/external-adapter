import { ITweetBody, ITweetCard, ITweetData, ITweetDetails, ITweetUser } from 'types';

export const createTweetData = ( legacy: any, views: any, core: any, card: any ): ITweetData => {
  const { full_text, created_at, favorite_count, quote_count, retweet_count, entities } = legacy;

  const { media, user_mentions, urls, hashtags, symbols } = entities;
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
  ];

  const cardData: ITweetCard | null = !card
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

  const tweetUrls: string[] | null =
    !urls || urls.length === 0
      ? null
      : urls?.map((url: { expanded_url: string }) => url.expanded_url);

  const tweetHashTags: string[] | null =
    !hashtags || hashtags.length === 0
      ? null
      : hashtags?.map((hashtag: { text: string }) => hashtag.text);

  const tweetSymbols: string[] | null =
    !symbols || symbols.length === 0
      ? null
      : symbols?.map((symbol: { text: string }) => symbol.text);

  const tweetMedia: string[] | null = !media
    ? null
    : media.map((el: { media_url_https: string }) => el.media_url_https);

  const tweetMentions: string[] | null = !user_mentions
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
