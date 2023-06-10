import { makeTweetUrlWithId, randomInt } from '../helpers';
import { IMoment, ITweetBody, ITweetData, ITweetDetails, ITweetResults, ITweetUser } from 'types';

export const createTweetData = (tweetResults: ITweetResults): ITweetData | null => {
  //TODO: Issue 52: https://github.com/orgs/NotarizedScreenshot/projects/1/views/1?pane=issue&itemId=27498718\
  //Add handling tombstone tweet
  try {
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
  } catch (error) {
    console.log('createTweetData error', error);
    return null;
  }
};

export const createMoment = (timestamp: number): IMoment => {
  const date = new Date(timestamp);
  const dateSplitted = date.toUTCString().split(' ');
  const time = `${dateSplitted[4]} ${dateSplitted[5]}`;
  const day = `${dateSplitted[2]} ${dateSplitted[1]}, ${dateSplitted[3]}`;

  return { time, day };
};

export const createNftName = (tweetId: string, moment: IMoment) => {
  const templates = [
    ['Notarized Capture: tweet ID', 'at', 'on', 'Authenticated internet history. QuantumOracle'],
    ['Notarized Screenshot: ID', 'at', 'on', 'Authenticated internet history. QuantumOracle'],
    ['Notarized Capture: tweet ID', 'at', 'on', 'Authenticated internet history. QuantumOracle'],
    ['Certified Moment: ID', 'at', 'on', 'Captured reality, forever preserved. QuantumOracle'],
    ['Verified Snapshot: ID', 'at', 'on', 'An irrefutable glimpse into history. QuantumOracle'],
    ['Authentic Capture: ID', 'at', 'on', 'A testament to verified discovery. QuantumOracle'],
  ];
  const index = randomInt(0, templates.length - 1);

  return `${templates[index][0]} ${tweetId} ${templates[index][1]} ${moment.time} ${
    templates[index][2]
  } ${moment.day}. ${templates[index][3]}. Original tweet: ${makeTweetUrlWithId(tweetId)}`;
};
export const createNftDescription = (tweetId: string, author: string, moment: IMoment) => {
  const templates = [
    [
      'Unveil verified truth with this Notarized Snapshot. Witness the tweet by',
      'captured at',
      'on',
      'Embrace authenticated internet history. See the original tweet at:',
      "Explore it while it's still accessible!",
    ],
    [
      'Step into a certified moment of authenticity with this Verified Snapshot. Explore the tweet by',
      'captured at',
      'on',
      'Unveil the truth. Check the original tweet:',
      "Dive into it before it's gone!",
    ],
    [
      'Journey through time with this Certified Moment, capturing the tweet by',
      'at',
      'on',
      'Embrace an irrefutable glimpse into history. Find the original tweet at:',
      "Explore it now, while it's still accessible!",
    ],
    [
      'Embark on an exploration of verified discovery with this Authentic Capture. Immerse yourself in the tweet by',
      'captured at',
      'on',
      'A testament to the power of QuantumOracle. Discover the original tweet:',
      'Explore it before it disappears!',
    ],
    [
      'Indulge in the authenticity of this Notarized Snapshot, capturing the tweet by',
      'at',
      'on',
      'Preserving verified truth in internet history. Find the original tweet:',
      "Explore it while it's still accessible!",
    ],
    [
      'Witness a frozen moment in time with this Verified Snapshot. Delve into the tweet by',
      'captured at',
      'on',
      'QuantumOracle unveils the truth. View the original tweet:',
      'Discover it before it becomes inaccessible!',
    ],
    [
      'Capture the essence of history with this Certified Moment. Immerse yourself in the tweet by',
      'captured at',
      'on',
      'QuantumOracle reveals an irrefutable glimpse. Check the original tweet:',
      'Explore it before it vanishes!',
    ],
    [
      'Embark on a journey of verified authenticity with this Authentic Capture. Immerse yourself in the tweet by',
      'captured at',
      'on',
      'QuantumOracle preserves internet history. See the original tweet:',
      "Explore it while it's still available!",
    ],
    [
      'Discover the power of verified truth with this Notarized Snapshot. Showcasing the tweet by',
      'captured at',
      'on',
      'Delve into authenticated internet history. Check the original tweet:',
      'Explore it while you can!',
    ],
    [
      'Dive into the realm of verified discovery with this Verified Snapshot. Unveil the tweet by',
      'captured at',
      'on',
      'QuantumOracle captures the essence. Visit the original tweet:',
      "Explore it before it's lost to the digital abyss!",
    ],
  ];
  const index = randomInt(0, templates.length - 1);

  return `${templates[index][0]} @${author} ${templates[index][1]} ${moment.time} ${
    templates[index][2]
  } ${moment.day}. ${templates[index][3]} ${makeTweetUrlWithId(tweetId)}. ${templates[index][4]}`;
};
