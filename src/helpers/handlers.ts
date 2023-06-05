import {
  getDnsInfo,
  getMediaUrlsToUpload,
  getTweetTimelineEntries,
  isValidUint64,
  makeImageBase64UrlfromBuffer,
  makeTweetUrlWithId,
  trimUrl,
} from '../helpers';
import { Browser, HTTPResponse, Page } from 'puppeteer';
import { IGetScreenshotResponseData, IMetadata, ITweetTimelineEntry } from '../types';
import { DEFAULT_TIMEOUT_MS, screenshotResponseDataOrderedKeys } from '../config';
import { Request, Response } from 'express';
import { reportError } from '../helpers';
import { puppeteerDefaultConfig } from '../config';
import puppeteer from 'puppeteer';
import { makeBufferFromBase64ImageUrl, makeStampedImage } from './images';
import { createTweetData } from '../models';
import { uploadQueue } from '../queue';

export const getMetaDataPromise = (page: Page, tweetId: string) =>
  new Promise<string>((resolve, reject) => {
    const tweetUrl = makeTweetUrlWithId(tweetId);
    page.on('response', async (puppeteerResponse: HTTPResponse) => {
      const responseUrl = puppeteerResponse.url();
      const trimmedResponseUrl = trimUrl(responseUrl);
      if (trimmedResponseUrl === tweetUrl) {
        const headers = puppeteerResponse.headers();
        const host = 'twitter.com';
        const dns = await getDnsInfo(host);
        const meta: IMetadata = {
          headers,
          ip: puppeteerResponse.remoteAddress().ip!,
          url: responseUrl,
          dns: { host, data: dns },
        };
        resolve(JSON.stringify(meta));
      }
      setTimeout(() => reject(`failed to get tweet ${tweetId} metadata`), DEFAULT_TIMEOUT_MS);
    });
  });

export const getTweetDataPromise = (page: Page, tweetId: string) =>
  new Promise<string>((resolve, reject) => {
    page.on('response', async (puppeteerResponse: HTTPResponse) => {
      const responseUrl = puppeteerResponse.url();

      const headers = puppeteerResponse.headers();

      if (
        responseUrl.match(/TweetDetail/g) &&
        headers['content-type'] &&
        headers['content-type'].includes('application/json')
      ) {
        try {
          const responseData = await puppeteerResponse.text();
          resolve(responseData);
        } catch (error: any) {
          console.log('getTweetDataPromise error:', error.message);
        }
      }
      setTimeout(() => reject(`failed to get tweet ${tweetId} tweet data`), DEFAULT_TIMEOUT_MS);
    });
  });

export const screenshotWithPuppeteer = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  try {
    return getScreenshotWithPuppeteer(request, response);
  } catch (error) {
    return response
      .status(502)
      .json({ error: `screenshotWithPuppeteer controller error:  ${error}` });
  }
};

const getScreenshotWithPuppeteer = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  try {
    const { tweetId, userId } = request.query as {
      tweetId: string;
      userId: string;
    };
    const jobs = await uploadQueue.getJobs(['active']);

    const activeJob = jobs.find((job) => job.data.userId === userId);

    if (!isValidUint64(tweetId)) {
      return reportError('invalid tweeetId', response);
    }
    if (!!activeJob) {
      const { stampedImageBuffer, metadata, tweetdata } = activeJob.data;

      const responseData: IGetScreenshotResponseData = {
        imageUrl: makeImageBase64UrlfromBuffer(Buffer.from(stampedImageBuffer!)),
        metadata,
        tweetdata,
      };
      response.set('Content-Type', 'application/json');
      return response.status(200).send({ ...responseData, jobId: activeJob.id });
    }

    const tweetUrl = makeTweetUrlWithId(tweetId);

    console.log('tweetUrl: ', tweetUrl);

    const browser = await getBrowser();

    const page = await browser.newPage();

    console.log('page', page);

    await page.setViewport({
      ...puppeteerDefaultConfig.viewport,
      deviceScaleFactor: 1,
    });
    await page.setUserAgent(puppeteerDefaultConfig.userAgent);

    const screenShotPromise: Promise<string> = page
      .goto(tweetUrl, puppeteerDefaultConfig.page.goto.gotoWaitUntilIdle)
      .then(async () => {
        await page.evaluate(() => {
          const bottomBar = document.querySelector('[data-testid="BottomBar"]') as HTMLElement;
          if (bottomBar) {
            bottomBar.style.display = 'none';
          }
        });
        const articleElement = (await page.waitForSelector('article'))!;
        const boundingBox = (await articleElement.boundingBox())!;

        const screenshotImageBuffer: Buffer = await page.screenshot({
          clip: { ...boundingBox },
        });

        return makeImageBase64UrlfromBuffer(screenshotImageBuffer);
      });

    const promises: Iterable<Promise<string>> = [
      getTweetDataPromise(page, tweetId),
      getMetaDataPromise(page, tweetId),
      screenShotPromise,
    ];
    const allData = await Promise.allSettled<string>(promises);
    const fetchedData = allData.reduce<IGetScreenshotResponseData>(
      (acc, val, index) => {
        acc[screenshotResponseDataOrderedKeys[index]] =
          val.status === 'fulfilled' ? val.value : null;
        return acc;
      },
      {
        imageUrl: null,
        metadata: null,
        tweetdata: null,
      },
    );

    const screenshotImageUrl = fetchedData.imageUrl;
    const screenshotImageBuffer = makeBufferFromBase64ImageUrl(screenshotImageUrl!);
    const stampedImageBuffer = await makeStampedImage(screenshotImageUrl!);
    const stampedImageUrl = makeImageBase64UrlfromBuffer(stampedImageBuffer!);
    const responseData: IGetScreenshotResponseData = { ...fetchedData, imageUrl: stampedImageUrl };

    const tweetEntry: ITweetTimelineEntry = getTweetTimelineEntries(responseData.tweetdata!).find(
      (entry) => entry.entryId === `tweet-${tweetId}`,
    )!;

    const tweetData = createTweetData(tweetEntry.content.itemContent.tweet_results.result);

    const tweetsDataUrlsToUpload = tweetData ? getMediaUrlsToUpload(tweetData) : [];
    //TODO: Issue 52: https://github.com/orgs/NotarizedScreenshot/projects/1/views/1?pane=issue&itemId=27498718\
    //Add handling tombstone tweet

    const mediaUrls = Array.from(new Set([...tweetsDataUrlsToUpload]));

    const uploadJob = await uploadQueue.add({
      tweetId,
      userId,
      metadata: fetchedData.metadata,
      tweetdata: fetchedData.tweetdata,
      screenshotImageBuffer,
      stampedImageBuffer,
      mediaUrls,
    });

    await browser.close();

    response.set('Content-Type', 'application/json');
    return response.status(200).send({ ...responseData });
  } catch (error: any) {
    console.log(error.message);
    return response.status(500).send({ error: error.message });
  }
};

async function getBrowser(): Promise<Browser> {
  const chromeHost = process.env.CHROME_HOST;
  const browser = await puppeteer.connect({browserWSEndpoint: `ws://${chromeHost}:3000`});
  console.log('browser', browser);
  return browser;
}
