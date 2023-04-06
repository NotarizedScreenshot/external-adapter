import { Request, Response } from 'express';
import puppeteer from 'puppeteer';
import {
  getMetaDataPromise,
  getTweetDataPromise,
  getTweetTimelineEntries,
  isValidUint64,
  isValidUrl,
  makeImageBase64UrlfromBuffer,
  makeTweetUrlWithId,
  pngPathFromTweetId,
} from '../helpers';
import { puppeteerDefaultConfig } from '../config';
import path from 'path';
import { processPWD } from '../prestart';
import { IGetScreenshotResponseData, ITweetData, ITweetTimelineEntry } from '../types';

import { createTweetData } from '../models';
import { makeStampedImage } from '../helpers/images';

export const getScreenShot = async (request: Request, response: Response) => {
  try {
    const { tweetId } = request.query as {
      tweetId: string;
    };

    if (!isValidUint64(tweetId)) {
      console.error('invalid tweeetId');
      return response.status(422).json({ error: 'invalid tweet id' });
    }
    const tweetUrl = makeTweetUrlWithId(tweetId);

    if (!isValidUrl(tweetUrl)) {
      console.log('error: invalid url');
      return response.status(422).json({ error: 'invalid url' });
    }

    const browser = await puppeteer.launch({
      args: puppeteerDefaultConfig.launch.args,
    });

    const page = await browser.newPage();

    const screenshotPath = path.resolve(processPWD, 'data', pngPathFromTweetId(tweetId));

    await page.setViewport({
      ...puppeteerDefaultConfig.viewport,
      deviceScaleFactor: 1,
    });
    await page.setUserAgent(puppeteerDefaultConfig.userAgent);

    const screenShotPromise = page
      .goto(tweetUrl, puppeteerDefaultConfig.page.goto)
      .then(async () => {
        const screenshotImageBuffer: Buffer = await page.screenshot({
          path: screenshotPath,
        });

        return makeImageBase64UrlfromBuffer(screenshotImageBuffer);
      });

    const fetchedData = (
      await Promise.allSettled<string>([
        getTweetDataPromise(page, tweetId),
        getMetaDataPromise(page, tweetUrl),
        screenShotPromise,
      ])
    ).reduce<IGetScreenshotResponseData>(
      (acc, val, index) => {
        const orderedKeys: (keyof IGetScreenshotResponseData)[] = [
          'tweetdata',
          'metadata',
          'imageUrl',
        ];

        if (val.status === 'fulfilled') {
          acc[orderedKeys[index]] = val.value;
        }
        if (val.status === 'rejected') {
          acc[orderedKeys[index]] = null;
        }
        return acc;
      },
      {
        imageUrl: null,
        metadata: null,
        tweetdata: null,
      },
    );

    const screenshotImageUrl = fetchedData.imageUrl;
    const stampedImageBuffer = await makeStampedImage(screenshotImageUrl!, fetchedData.metadata!);
    const stampedImageUrl = makeImageBase64UrlfromBuffer(stampedImageBuffer!);
    const responseData: IGetScreenshotResponseData = { ...fetchedData, imageUrl: stampedImageUrl };

    const tweetEntries: ITweetTimelineEntry[] = [];
    const threadEntries: any[] = [];
    const responseTweetEntries = getTweetTimelineEntries(responseData.tweetdata!);
    for (const tweetEntry of responseTweetEntries!) {
      if (tweetEntry.entryId.includes('tweet-')) tweetEntries.push(tweetEntry);
      if (tweetEntry.entryId.includes('conversationthread-')) threadEntries.push(tweetEntry);
    }

    const tweetsData = tweetEntries.map((entry) => {
      console.log(entry.content.itemContent.tweet_results.result.legacy);
      return createTweetData(entry.content.itemContent.tweet_results.result);
    });

    const threadsData = threadEntries.map((entry) => {
      return {
        entryId: entry.entryId,
        items: entry.content.items
          .filter((item: any) => item.item.itemContent.itemType === 'TimelineTweet')
          .map((item: any) => createTweetData(item.item.itemContent.tweet_results.result)),
      };
    });
    
    const tweetsDataUploaded = tweetsData.flatMap((tweet) => {
      const mediaToUpload: string[] = [];

      if (!!tweet.body.card) mediaToUpload.push(tweet.body.card.thumbnail_image_original);
      mediaToUpload.push(tweet.user.profile_image_url_https);

      tweet.body.media?.forEach((media) => {
        mediaToUpload.push(media.src);
        if (media.type === 'video') {
          mediaToUpload.push(media.thumb);
        }
      });
      return mediaToUpload;
    });

    const threadsDataToUpload = threadsData.flatMap((thread) => {
      return thread.items.flatMap((tweet: ITweetData) => {
        const mediaToUpload: string[] = [];

        if (!!tweet.body.card) mediaToUpload.push(tweet.body.card.thumbnail_image_original);

        mediaToUpload.push(tweet.user.profile_image_url_https);

        tweet.body.media?.forEach((media) => {
          mediaToUpload.push(media.src);
          if (media.type === 'video') {
            mediaToUpload.push(media.thumb);
          }
        });
        return mediaToUpload;
      });
    });

    const allUrlsToUpload = new Set([...threadsDataToUpload, ...tweetsDataUploaded]);
    const screenShotsToUpload = { screenshotImageUrl, stampedImageUrl };
    const metadataToUpload = { metadata: responseData.metadata, tweetData: responseData.tweetdata };
    //// TODO: send somewhere to fetch and upload to IPFS.
    browser.close();

    response.set('Content-Type', 'application/json');
    response.status(200).send(responseData);
  } catch (error) {
    console.log(`controller error:  ${error}`);
    if (error instanceof Error) {
      return response.status(502).json({ error: error.message });
    }
    response.status(502).json({ error: `Unknown error: ${error}` });
  }
};
