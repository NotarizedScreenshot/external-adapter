import fs from 'fs/promises';
import path from 'path';
import {
  findElementByTextContentAsync,
  getBoundingBox,
  getDnsInfo,
  getMediaUrlsToUpload,
  getSavedCookies,
  getSocketByUserId,
  getTweetResults,
  getTweetTimelineEntries,
  isValidUint64,
  makeImageBase64UrlfromBuffer,
  makeTweetUrlWithId,
  trimUrl,
  waitForSelectorWithTimeout,
} from '../helpers';
import puppeteer, { Browser, ElementHandle, HTTPResponse, Page } from 'puppeteer';
import {
  IGetScreenshotResponseData,
  IMetadata,
  IResponseData,
  ITweetData,
  ITweetTimelineEntry,
} from '../types';
import {
  DEFAULT_TIMEOUT_MS,
  TWITTER_LOGIN_BUTTON_TEXT_CONTENT,
  TWITTER_NEXT_BUTTON_TEXT_CONTENT,
  screenshotResponseDataOrderedKeys,
} from '../config';
import { Request, Response } from 'express';
import { reportError } from '../helpers';
import { puppeteerDefaultConfig } from '../config';
import { makeBufferFromBase64ImageUrl, makeStampedImage } from './images';
import { createTweetData } from '../models';
import { uploadQueue } from '../queue';
import { processPWD } from '../prestart';

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
        responseUrl.match(/TweetDetail/g) ||
        (responseUrl.match(/TweetResultByRestId/g) &&
          headers['content-type'] &&
          headers['content-type'].includes('application/json'))
      ) {
        console.log('getTweetDataPromise: caught response, response url: ', responseUrl);
        try {
          const responseData = await puppeteerResponse.text();
          resolve(responseData);
        } catch (error: any) {
          console.log('getTweetDataPromise error:', error.message);
        }
      }
      setTimeout(
        () =>
          reject(
            `failed to get tweet ${tweetId} tweet data, did not caught tweet data response within timeout`,
          ),
        DEFAULT_TIMEOUT_MS,
      );
    });
  });

export const screenshotPromise = async (page: Page, tweetId: string) => {
  try {
    const cookies = await getSavedCookies();

    if (!cookies) {
      await page.goto(
        'https://twitter.com/i/flow/login',
        puppeteerDefaultConfig.page.goto.gotoWaitUntilIdle,
      );

      await page.waitForSelector('input');

      console.log('process.env.TWITTER_PASSWORD', process.env.TWITTER_PASSWORD);
      console.log('process.env.TWITTER_USERNAME', process.env.TWITTER_USERNAME);
      console.log('process.env.TWITTER_EMAIL', process.env.TWITTER_EMAIL);

      if (!process.env.TWITTER_USERNAME) {
        console.log(`Twitter username is falsy: '${process.env.TWITTER_USERNAME}'`);
        return null;
      }

      await page.type('input', process.env.TWITTER_USERNAME);

      const loginPageButtons = await page.$$('[role="button"]');

      const loginPgaeNextButton = await findElementByTextContentAsync(
        loginPageButtons,
        TWITTER_NEXT_BUTTON_TEXT_CONTENT,
      );

      // console.log(nextButton);
      if (!loginPgaeNextButton) {
        console.log(
          `Twitter Log in page error: can not get button '${TWITTER_NEXT_BUTTON_TEXT_CONTENT}'`,
        );
        return null;
      }

      await loginPgaeNextButton.click();

      await page.waitForSelector('input');

      if (!process.env.TWITTER_PASSWORD) {
        console.log(`Twitter password is falsy: '${process.env.TWITTER_PASSWORD}'`);
        return null;
      }

      await page.type('input', process.env.TWITTER_PASSWORD);

      const passwordPageButtons = await page.$$('[role="button"]');

      const logInButton = await findElementByTextContentAsync(
        passwordPageButtons,
        TWITTER_LOGIN_BUTTON_TEXT_CONTENT,
      );

      if (!logInButton) {
        console.log(
          `Twitter Log in page error: can not get button '${TWITTER_NEXT_BUTTON_TEXT_CONTENT}'`,
        );

        return null;
      }

      await logInButton.click();

      const articleElement = await waitForSelectorWithTimeout(page, `article`);

      if (!articleElement) {
        const label = await waitForSelectorWithTimeout(page, 'label');
        const labelTextContent = await (await label?.getProperty('textContent'))?.jsonValue();
        if (labelTextContent?.toLowerCase().includes('email')) {
          if (!process.env.TWITTER_EMAIL) {
            console.log(`Twitter email is falsy: '${process.env.TWITTER_EMAIL}'`);
            return null;
          }
          await page.type('input', process.env.TWITTER_EMAIL);
          const emailPageButtons = await page.$$('[role="button"]');

          const emailPageNextButton = await findElementByTextContentAsync(
            emailPageButtons,
            TWITTER_NEXT_BUTTON_TEXT_CONTENT,
          );

          await emailPageNextButton!.click();
        }
      }

      const coockies = await page.cookies();
      fs.writeFile(path.resolve(processPWD, 'data', 'cookies.json'), JSON.stringify(coockies));
    } else {
      await page.setCookie(...cookies);
    }

    const tweetUrl = makeTweetUrlWithId(tweetId);

    await page.goto(tweetUrl, puppeteerDefaultConfig.page.goto.gotoWaitUntilIdle);

    const mainElement = await page.waitForSelector('main');
    const mailboundingBox = await getBoundingBox(mainElement);
    const articleElement = await waitForSelectorWithTimeout(
      page,
      `article:has(a[href$="/status/${tweetId}"])`,
    );
    const articleBoundingBox = await getBoundingBox(articleElement);
    articleBoundingBox.y -= mailboundingBox.y;

    await page.evaluate(() => {
      const bottomBars = document.querySelectorAll('[data-testid="BottomBar"]');
      bottomBars.forEach((bottomBarElement) => {
        const bottomBar = bottomBarElement as HTMLElement;

        bottomBar.style.display = 'none';
      });
      const dialogs = document.querySelectorAll('[role="dialog"]');
      dialogs.forEach((bottomBarElement) => {
        const bottomBar = bottomBarElement as HTMLElement;
        bottomBar.style.display = 'none';
      });
    });

    const screenshotImageBuffer: Buffer = await page.screenshot({
      clip: { ...articleBoundingBox },
      path: 'screenshot.png',
    });

    return makeImageBase64UrlfromBuffer(screenshotImageBuffer);
  } catch (error: any) {
    console.log('Can not get screenshot:', error.message);
    return null;
  }
};

export const screenshotWithPuppeteer = async (
  request: Request,
  response: Response,
): Promise<Response> => {
  try {
    return getScreenshotWithPuppeteer(request, response);
  } catch (error) {
    console.log('screenshotWithPuppeteer error: ', error);
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
      const { stampedImageBuffer, metadata, tweetdata, parsedTweetData } = activeJob.data;

      const responseData: IResponseData = {
        imageUrl: makeImageBase64UrlfromBuffer(Buffer.from(stampedImageBuffer!)),
        metadata,
        tweetdata,
        parsedTweetData,
      };
      response.set('Content-Type', 'application/json');
      return response.status(200).send({ ...responseData, jobId: activeJob.id });
    }

    const tweetUrl = makeTweetUrlWithId(tweetId);

    console.log('getScreenshotWithPuppeteer tweetUrl: ', tweetUrl);

    const browser = await getBrowser();

    const page = await browser.newPage();

    console.log('getScreenshotWithPuppeteer page', page);

    await page.setViewport({
      ...puppeteerDefaultConfig.viewport,
      deviceScaleFactor: 1,
    });
    await page.setUserAgent(puppeteerDefaultConfig.userAgent);

    const promises: Iterable<Promise<string | null>> = [
      getTweetDataPromise(page, tweetId),
      getMetaDataPromise(page, tweetId),
      screenshotPromise(page, tweetId),
    ];
    const allData = await Promise.allSettled<string | null>(promises);
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

    if (!fetchedData.tweetdata || !fetchedData.metadata || !fetchedData.imageUrl) {
      const socket = getSocketByUserId(userId);

      const responseDataKeys = Object.keys(fetchedData) as (keyof IGetScreenshotResponseData)[];
      const falsyResponseData = responseDataKeys.reduce<{
        metadata?: IGetScreenshotResponseData['metadata'];
        tweetdata?: IGetScreenshotResponseData['tweetdata'];
        imageUrl?: IGetScreenshotResponseData['imageUrl'];
      }>((acc, val) => {
        if (!responseData[val]) acc[val] = null;
        return acc;
      }, {});

      if (!!socket) socket.emit('uploadRejected', JSON.stringify(falsyResponseData));
      return response.status(500).send({
        error: `fetching data error: ${JSON.stringify(falsyResponseData)}`,
        data: fetchedData,
      });
    }

    const screenshotImageUrl = fetchedData.imageUrl;
    const screenshotImageBuffer = makeBufferFromBase64ImageUrl(screenshotImageUrl);
    const stampedImageBuffer = await makeStampedImage(screenshotImageUrl);
    const stampedImageUrl = makeImageBase64UrlfromBuffer(stampedImageBuffer);

    const tweetEntrys: ITweetTimelineEntry[] = getTweetTimelineEntries(fetchedData.tweetdata);
    const tweetEntry = tweetEntrys.find((entry) => entry.entryId === `tweet-${tweetId}`)!;

    console.log('getScreenshotWithPuppeteer get tweetEntries: tweetEntry = ', tweetEntry);
    if (!tweetEntry)
      console.log(
        'getScreenshotWithPuppeteer tweetEntry is falsy, try to parse responseData.tweetdata',
      );

    console.log('getScreenshotWithPuppeteer responseData.tweetdata', fetchedData.tweetdata);

    const tweetResults = tweetEntry
      ? getTweetResults(tweetEntry)
      : getTweetResults(JSON.parse(fetchedData.tweetdata!));

    console.log('getScreenshotWithPuppeteer tweetResults = ', tweetResults);

    const parsedTweetData = createTweetData(tweetResults);

    const tweetsDataUrlsToUpload = parsedTweetData ? getMediaUrlsToUpload(parsedTweetData) : [];
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
      parsedTweetData,
    });

    await browser.close();

    const responseData = {
      imageUrl: stampedImageUrl,
      metadata: fetchedData.metadata,
      tweetdata: fetchedData.tweetdata,
      parsedTweetData,
    };

    response.set('Content-Type', 'application/json');
    return response.status(200).send({ ...responseData });
  } catch (error: any) {
    console.log('getScreenshotWithPuppeteer', error);
    return response.status(500).send({ error: error.message });
  }
};

async function getBrowser(): Promise<Browser> {
  const chromeHost = process.env.CHROME_HOST;
  const browser = await puppeteer.connect({ browserWSEndpoint: `ws://${chromeHost}:3000` });  
  console.log('browser', browser);
  return browser;
}
