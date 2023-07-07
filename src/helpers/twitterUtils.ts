import { ElementHandle } from 'puppeteer';
import { createTweetData } from '../models';
import { IThreadData, IThreadEntry, ITweetData, ITweetTimelineEntry } from 'types';
import { puppeteerDefaultConfig } from '../config';

export const getBoundingBox = async (element: ElementHandle | null) => {
  if (!!element) {
    const elementBoundingBox = await element.boundingBox();
    return elementBoundingBox ? elementBoundingBox : puppeteerDefaultConfig.defaultBoundingBox;
  }
  return puppeteerDefaultConfig.defaultBoundingBox;
};

export const getTweetResults = (tweetData: any) => {
  try {
    switch (true) {
      case !!tweetData.content?.itemContent?.tweet_results?.result:        
        return tweetData.content.itemContent.tweet_results.result;
      case !!tweetData.data.tweetResult?.result:
        return tweetData.data.tweetResult.result;
      default:
        throw new Error(`can not get tweet results, data: ${JSON.stringify(tweetData)}`);
    }
  } catch (error: any) {
    console.error('getTweetResults error: ', error);
    return null;
  }
};

export const getTweetTimelineEntries = (
  tweetRawDataString: string | null,
): ITweetTimelineEntry[] => {
  try {
    if (!tweetRawDataString) return [];
    const tweetRawDataParsed = JSON.parse(tweetRawDataString);

    const tweetResponseInstructions =
      tweetRawDataParsed.data['threaded_conversation_with_injections_v2'].instructions;

    const tweetTimeLineEntries: ITweetTimelineEntry[] = tweetResponseInstructions.find(
      (el: any) => el.type === 'TimelineAddEntries',
    ).entries;
    return tweetTimeLineEntries;
  } catch (error) {
    console.error('getTweetTimelineEntries error: ', error);
    return [];
  }
};

export const getTweetBodyMediaUrls = (tweetdata: ITweetData): string[] => {
  return tweetdata.body.media
    ? tweetdata.body.media?.flatMap((media) => {
        if (media.type === 'video') return [media.src, media.thumb];
        return media.src;
      })
    : [];
};

export const getThreadsDataToUpload = (threadsData: IThreadData[]): string[] => {
  return threadsData.flatMap<string>((thread) => {
    return thread.items.flatMap((tweet: ITweetData) => {
      const mediaToUpload: string[] = [];

      if (!!tweet.body.card) mediaToUpload.push(tweet.body.card.thumbnail_image_original);

      mediaToUpload.push(tweet.user.profile_image_url_https);

      const mediaUrls = getTweetBodyMediaUrls(tweet);

      return [...mediaToUpload, ...mediaUrls];
    });
  });
};

export const getMediaUrlsToUpload = (tweet: ITweetData): string[] => {
  const mediaToUpload: string[] = [];

  if (!!tweet.body.card?.thumbnail_image_original)
    mediaToUpload.push(tweet.body.card.thumbnail_image_original);
  if (!!tweet.body.card?.player_image_original)
    mediaToUpload.push(tweet.body.card.player_image_original);
  if (!!tweet.user.profile_image_url_https) mediaToUpload.push(tweet.user.profile_image_url_https);

  const mediaUrls = getTweetBodyMediaUrls(tweet);

  return [...mediaToUpload, ...mediaUrls];
};

export const getTweetDataFromThreadEntry = (entry: IThreadEntry) => {
  return {
    entryId: entry.entryId,
    items: entry.content.items
      .filter((item: any) => item.item.itemContent.itemType === 'TimelineTweet')
      .map((item: any) => createTweetData(item.item.itemContent.tweet_results.result)),
  };
};

export const getTweetResultsFromTweetRawData = (tweetRawDataString: string, tweetId: string) => {
  try {
    const tweetRawDataParsed = JSON.parse(tweetRawDataString);
    console.log('getTweetResultsFromTweetRawData', tweetRawDataParsed);
    const tweetResponseInstructions =
      tweetRawDataParsed.data['threaded_conversation_with_injections_v2'].instructions;

    const tweetTimeLineEntries = tweetResponseInstructions.find(
      (el: any) => el.type === 'TimelineAddEntries',
    ).entries;

    const tweetEntry = tweetTimeLineEntries.find(
      (entry: any) => entry.entryId === `tweet-${tweetId}`,
    );

    return tweetEntry.content.itemContent.tweet_results.result;
  } catch (error) {
    console.error('getTweetResultsFromTweetRawData', error);
    return null;
  }
};

export const makeTweetUrlWithId = (tweetId: string): string =>
  `https://twitter.com/twitter/status/${tweetId}`;
