import fs from 'fs/promises';
import path from 'path';
import {
  getDnsInfo,
  getMediaUrlsToUpload,
  getTweetTimelineEntries,
  isValidUint64,
  makeImageBase64UrlfromBuffer,
  makeTweetUrlWithId,
  trimUrl,
} from '../helpers';
import puppeteer, { Browser, ElementHandle, HTTPResponse, Page } from 'puppeteer';
import { IGetScreenshotResponseData, IMetadata, ITweetTimelineEntry } from '../types';
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

export const getBoundingBox = async (element: ElementHandle | null) => {
  if (!!element) {
    const elementBoundingBox = await element.boundingBox();
    return elementBoundingBox ? elementBoundingBox : puppeteerDefaultConfig.defaultBoundingBox;
  }
  return puppeteerDefaultConfig.defaultBoundingBox;
};

export const getSavedCookies = (): Promise<
  { name: string; value: string; [id: string]: string | number | boolean }[] | null
> =>
  fs
    .readFile(path.resolve(processPWD, 'data', 'cookies.json'), 'utf-8')
    .then((cockiesString) => JSON.parse(cockiesString))
    .catch((error) => {
      console.error(error.message);
      return null;
    });

export const findElementByTextContentAsync = async (
  elements: ElementHandle[],
  textValue: string,
): Promise<ElementHandle | null> => {
  for (let i = 0; i < elements.length; i += 1) {
    const property = await elements[i].getProperty('textContent');
    const value = await property.jsonValue();
    if (value?.toLocaleLowerCase() === textValue.toLocaleLowerCase()) return elements[i];
  }
  return null;
};

export const waitForSelectorWithTimeout = async (
  page: Page,
  selector: string,
  timeout: number = 5000,
): Promise<ElementHandle | null> => {
  try {
    return await page.waitForSelector(selector, {
      timeout,
    });
  } catch (error) {
    console.log(`Can not get selector: ${selector}, exceed timeout ${timeout} ms`);
    return null;
  }
};

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

export const screenshotPromise = async (page: Page, tweetId: string) => {
  try {
    const cookies = await getSavedCookies();

    if (!cookies) {
      await page.goto(
        'https://twitter.com/i/flow/login',
        puppeteerDefaultConfig.page.goto.gotoWaitUntilIdle,
      );
      await page.waitForSelector('input');
      console.log(process.env.TWITTER_PASSWORD);
      console.log(process.env.TWITTER_USERNAME);
      if (!process.env.TWITTER_USERNAME) {
        console.log(`Twitter username is falsy: '${process.env.TWITTER_USERNAME}'`);
        return null;
      }
      await page.type('input', process.env.TWITTER_USERNAME);

      const loginPageButtons = await page.$$('[role="button"]');

      const nextButton = await findElementByTextContentAsync(
        loginPageButtons,
        TWITTER_NEXT_BUTTON_TEXT_CONTENT,
      );

      // console.log(nextButton);
      if (!nextButton) {
        console.log(
          `Twitter Log in page error: can not get button '${TWITTER_NEXT_BUTTON_TEXT_CONTENT}'`,
        );
        return null;
      }

      await nextButton.click();
      console.log('click');
      await page.waitForSelector('input');

      if (!process.env.TWITTER_PASSWORD) {
        console.log(`Twitter password is falsy: '${process.env.TWITTER_PASSWORD}'`);
        return null;
      }
      await page.type('input', process.env.TWITTER_PASSWORD);

      const buttons2 = await page.$$('[role="button"]');

      const logInButton = await findElementByTextContentAsync(
        buttons2,
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
      console.log(articleElement);
      if (!articleElement) {
        console.log('shitta fuckka');
        const screenshotImageBuffer: Buffer = await page.screenshot();
        return makeImageBase64UrlfromBuffer(screenshotImageBuffer);
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

    console.log('fetched', fetchedData);

    const screenshotImageUrl = fetchedData.imageUrl;
    const screenshotImageBuffer = makeBufferFromBase64ImageUrl(screenshotImageUrl);
    const stampedImageBuffer = await makeStampedImage(screenshotImageUrl);
    const stampedImageUrl = makeImageBase64UrlfromBuffer(stampedImageBuffer);
    const responseData: IGetScreenshotResponseData = { ...fetchedData, imageUrl: stampedImageUrl };

    if (responseData.tweetdata) {
      const tweetEntry: ITweetTimelineEntry = getTweetTimelineEntries(responseData.tweetdata).find(
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
    }

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
