import {
  getDnsInfo,
  getHostWithoutWWW,
  getMediaUrlsToUpload,
  getTweetTimelineEntries,
  isValidUint64,
  makeImageBase64UrlfromBuffer,
  makeTweetUrlWithId,
  pngPathFromTweetId,
  trimUrl,
  tweetDataPathFromTweetId,
} from '../helpers';
import { HTTPResponse, Page } from 'puppeteer';
import {
  IGetScreenshotResponseData,
  IMetadata,
  IScreenShotBuffersToUpload,
  ITweetTimelineEntry,
} from '../types';
import { DEFAULT_TIMEOUT_MS, screenshotResponseDataOrderedKeys } from '../config';
import fs from 'fs/promises';
import path from 'path';
import { processPWD } from '../prestart';
import { Request, Response } from 'express';
import { reportError } from '../helpers';
import { puppeteerDefaultConfig } from '../config';
import puppeteer from 'puppeteer';
import { makeBufferFromBase64ImageUrl, makeStampedImage } from './images';
import { createTweetData } from '../models';
import { uploadQueue } from '../queue';
import { constants } from 'buffer';

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
      try {
        const responseUrl = puppeteerResponse.url();
        const headers = puppeteerResponse.headers();
        console.log(headers);

        if (
          responseUrl.match(/TweetDetail/g) &&
          headers['content-type'].includes('application/json')
        ) {
          // console.log(headers);
          const responseData = await puppeteerResponse.text();
          resolve(responseData);
        }
        setTimeout(() => reject(`failed to get tweet ${tweetId} tweet data`), DEFAULT_TIMEOUT_MS);
      } catch (e) {
        reject(e);
        console.log('getTweetPromise', e);
      }
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
    if (!!activeJob) {
      const data = activeJob.data;
      const { stampedImageBuffer, metadata, tweetdata } = data;

      const responseData: IGetScreenshotResponseData = {
        imageUrl: makeImageBase64UrlfromBuffer(Buffer.from(stampedImageBuffer!)),
        metadata,
        tweetdata,
      };
      response.set('Content-Type', 'application/json');
      return response.status(200).send({ ...responseData, jobId: activeJob.id });
    }

    if (!isValidUint64(tweetId)) {
      return reportError('invalid tweeetId', response);
    }
    const tweetUrl = makeTweetUrlWithId(tweetId);

    const browser = await puppeteer.launch({
      args: puppeteerDefaultConfig.launch.args,
    });

    const page = await browser.newPage();

    await page.setViewport({
      ...puppeteerDefaultConfig.viewport,
      deviceScaleFactor: 1,
    });
    await page.setUserAgent(puppeteerDefaultConfig.userAgent);

    const screenShotPromise = page
      .goto(tweetUrl, puppeteerDefaultConfig.page.goto.gotoWaitUntilIdle)
      .then(async () => {
        const articleElement = (await page.waitForSelector('article'))!;
        const boundingBox = (await articleElement.boundingBox())!;

        const screenshotImageBuffer: Buffer = await page.screenshot({
          clip: { ...boundingBox },
        });

        return makeImageBase64UrlfromBuffer(screenshotImageBuffer);
      });

    const fetchedData = (
      await Promise.allSettled<string>([
        getTweetDataPromise(page, tweetId),

        getMetaDataPromise(page, tweetId),
        screenShotPromise,
      ])
    ).reduce<IGetScreenshotResponseData>(
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
    const stampedImageBuffer = await makeStampedImage(screenshotImageUrl!, fetchedData.metadata!);
    const stampedImageUrl = makeImageBase64UrlfromBuffer(stampedImageBuffer!);
    const responseData: IGetScreenshotResponseData = { ...fetchedData };

    const tweetEntry: ITweetTimelineEntry = getTweetTimelineEntries(responseData.tweetdata!).find(
      (entry) => entry.entryId === `tweet-${tweetId}`,
    )!;

    const tweetData = createTweetData(tweetEntry.content.itemContent.tweet_results.result);

    const tweetsDataUrlsToUpload = getMediaUrlsToUpload(tweetData);

    // const mediaUrls = Array.from(new Set([...tweetsDataUrlsToUpload]));

    // const uploadJob = await uploadQueue.add({
    //   tweetId,
    //   userId,
    //   metadata: fetchedData.metadata,
    //   tweetdata: fetchedData.tweetdata,
    //   screenshotImageBuffer,
    //   stampedImageBuffer,
    //   mediaUrls,
    // });

    browser.close();

    response.set('Content-Type', 'application/json');
    return response.status(200).send({ ...responseData });
  } catch (error) {
    console.log('getScreenshotWithPuppeteer');
    return response.status(200);
  }
};
