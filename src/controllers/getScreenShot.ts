import { Request, Response } from 'express';
import puppeteer from 'puppeteer';
import {
  getMetaDataPromise,
  getTweetDataPromise,
  isValidUint64,
  isValidUrl,
  makeImageBase64UrlfromBuffer,
  makeTweetUrlWithId,
  pngPathFromTweetId,
} from '../helpers';
import { puppeteerDefaultConfig } from '../config';
import path from 'path';
import { processPWD } from '../prestart';
import { IGetScreenshotResponseData, IMetadata, ITweetPageMetaData, ITweetRawData } from '../types';

export const getScreenShot = async (request: Request, response: Response) => {
  try {
    const { tweetId } = request.query as {
      tweetId: string;
    };
    console.log('tweetId', tweetId);
    console.log('tweetId', isValidUint64(tweetId));
    if (!isValidUint64(tweetId)) {
      console.log('invalid');
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

    const fetchedData = await Promise.allSettled<string>([
      getTweetDataPromise(page, tweetId),
      getMetaDataPromise(page, tweetUrl),
      screenShotPromise,
    ]);

    const responseData = fetchedData.reduce<IGetScreenshotResponseData>(
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
