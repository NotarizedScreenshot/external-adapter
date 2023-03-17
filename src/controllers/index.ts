import path from 'path';
import fs from 'fs/promises';
import { Request, Response } from 'express';
import puppeteer, { HTTPResponse } from 'puppeteer';
import {
  getHostWithoutWWW,
  trimUrl,
  isValidUrl,
  getDnsInfo,
  pngPathFromUrl,
  pngPathStampedFromUrl,
  metadataPathFromUrl,
  metadataPathFromTweetId,
  isValidBigInt,
  makeTweetUrlWithId,
  pngPathFromTweetId,
  tweetDataPathFromTweetId,
  processMetaData,
} from '../helpers';
import { makeStampedImage } from '../helpers/images';

import { IMetadata } from 'types';
import { processPWD } from '../prestart';

const VIEWPORT_DEFAULT_WIDTH = 1000;
const VIEWPORT_DEFAULT_HEIGHT = 1000;

const WATERMARK_DEFAULT_WIDTH = 818;
const WATERMARK_DEFAULT_HEIGHT = 1000;
const WATERMARK_IMAGE_PATH = path.resolve(processPWD, 'public/images/stamp_s.png');
const META_STAMP_FONT = '10px monospace';
const META_STAMP_COLOR = 'red';
const META_STAMP_CANVAS_DEFAULT_WIDTH = 900;
const META_STAMP_CANVAS_DEFAULT_HEIGHT = 1000;

const DEFAULT_USERAGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';

const getIndexPage = (_: Request, response: Response) => {
  try {
    response.set('Content-Type', 'text/html');
    response.status(200).sendFile(path.resolve(process.env.PWD!, 'public/index.html'));
  } catch (error) {
    console.log(error);
    response.status(502).send(error);
  }
};

//const meta: { [id: string]: any }[] = [];

// pngPathFromUrl,
// metadataPathFromUrl are not using client data in order to make available only the last version of the same URL
const getScreenShot = async (request: Request, response: Response) => {
  try {
    const { tweetId } = request.body;
    if (!isValidBigInt(tweetId)) {
      console.log('error: invalid tweet id');
      return response.status(422).json({ error: 'invalid tweet id' });
    }
    const tweetUrl = makeTweetUrlWithId(tweetId);
    if (!isValidUrl(tweetUrl)) {
      console.log('error: invalid url');
      return response.status(422).json({ error: 'invalid url' });
    }
    // const browser = await puppeteer.launch();
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    const url = tweetUrl;
    const clientCode = request.body.clientCode;

    page.on('response', async (pupperTerresponse: HTTPResponse) => {
      try {
        const responseUrl = pupperTerresponse.url();
        const trimmedResponseUrl = trimUrl(responseUrl);

        if (responseUrl.match(/TweetDetail/g)) {
          const responseData = await pupperTerresponse.json();
          const responseDataString = JSON.stringify(responseData.data);

          if (responseDataString.includes(`tweet-${request.body.tweetId}`)) {
            await fs.writeFile(
              path.resolve(processPWD, 'data', tweetDataPathFromTweetId(tweetId)),
              responseDataString,
            );
          }
        }

        if (trimmedResponseUrl === url) {
          const headers = pupperTerresponse.headers();
          const { ip } = pupperTerresponse.remoteAddress();
          const host = getHostWithoutWWW(url);

          const dnsResult = await getDnsInfo(host, ['+trace', 'any']).catch((e) => {
            console.log('dns catch', e);
          });
          const dns = typeof dnsResult === 'string' ? dnsResult.split('\n') : [];

          // if dns === [], no dns data
          const meta: IMetadata = {
            headers,
            ip: ip || 'n/a',
            url: responseUrl,
            dns: { host, data: dns },
          };
          await fs.writeFile(
            path.resolve(processPWD, 'data', metadataPathFromTweetId(tweetId)),
            JSON.stringify(meta),
          );
        }
      } catch (error) {
        console.log(`page error:  ${error}`);
        if (error instanceof Error) {
          // meta.splice(0, meta.length);
          // meta.push({ error: { ...error, message: error.message} });
        }
      }
    });

    await page.setViewport({
      width: VIEWPORT_DEFAULT_WIDTH,
      height: VIEWPORT_DEFAULT_HEIGHT,
      deviceScaleFactor: 1,
    });
    await page.setUserAgent(DEFAULT_USERAGENT);
    await page.goto(url, { waitUntil: 'networkidle0' });

    const screenshotPath = path.resolve(processPWD, 'data', pngPathFromTweetId(tweetId));

    const screenshotImageBuffer: Buffer = await page.screenshot({
      path: screenshotPath,
    });
    browser.close();

    response.set('Content-Type', 'image/png');
    return response.status(200).send(screenshotImageBuffer);
  } catch (error) {
    console.log(`controller error:  ${error}`);
    if (error instanceof Error) {
      return response.status(502).json({ error: error.message });
    }
    response.status(502).json({ error: `Unknown error: ${error}` });
  }
};

const getStampedImage = async (request: Request, response: Response) => {
  try {
    const { sourceUrl, clientCode } = request.query as {
      sourceUrl: string;
      clientCode: string;
    };

    if (!sourceUrl) {
      console.log(`Error: inValid query: sourceUrl = ${sourceUrl}`);
      return response.status(422).json({ error: `inValid query: sourceUrl = ${sourceUrl}` });
    }

    const metadataPath = path.resolve(
      processPWD,
      'data',
      metadataPathFromUrl(trimUrl(sourceUrl), clientCode),
    );
    const screenshotImagePath = path.resolve(
      processPWD,
      'data',
      pngPathFromUrl(trimUrl(sourceUrl), clientCode),
    );

    if (!metadataPath || !screenshotImagePath) {
      console.log(`Error: inValid file paths ${metadataPath} ${screenshotImagePath}`);
      return response.status(422).json({ error: `files lost` });
    }

    const metamarkedImageBuffer = await makeStampedImage(screenshotImagePath, metadataPath);
    const stampedFilePath = path.resolve(
      processPWD,
      'data',
      pngPathStampedFromUrl(trimUrl(sourceUrl), clientCode),
    );

    metamarkedImageBuffer && (await fs.writeFile(stampedFilePath, metamarkedImageBuffer));
    response.set('Content-Type', 'image/png');
    return response.status(200).send(metamarkedImageBuffer);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        response.status(422).json({ error: error.message });
        return;
      }
      return response.status(502).json({ error: error.message });
    }
    response.status(502).json({ error: `Unknown error ${error}` });
  }
};

export const getMetaData = async (request: Request, response: Response) => {
  try {
    const { tweetId } = request.query as { tweetId: string };
    if (!isValidBigInt(tweetId)) {
      console.log('error: invalid tweet id');
      return response.status(422).json({ error: 'invalid tweet id' });
    }
    const metadataPath = path.resolve(processPWD, 'data', metadataPathFromTweetId(tweetId));
    const metadata = processMetaData(await fs.readFile(metadataPath, 'utf-8'));
    response.status(200).json(metadata);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        response.status(422).json({ error: error.message });
        return;
      }
      return response.status(502).json({ error: error.message });
    }
    response.status(502).json({ error: `Unknown error ${error}` });
  }
};

export const getTweetData = async (request: Request, response: Response) => {
  console.log('get Tweet data');
  try {
    const { tweetId } = request.query as { tweetId: string };

    if (!isValidBigInt(tweetId)) {
      console.log('error: invalid tweet id');
      return response.status(422).json({ error: 'invalid tweet id' });
    }

    const tweetResponseDataPath = path.resolve(
      processPWD,
      'data',
      tweetDataPathFromTweetId(tweetId),
    );

    const tweetRawDataString = await fs.readFile(tweetResponseDataPath, 'utf-8');
    const tweetRawData = JSON.parse(tweetRawDataString);

    response.status(200).json(tweetRawData);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        response.status(422).json({ error: error.message });
        return;
      }
      console.log('error', error);
      return response.status(502).json({ error: error.message });
    }
    console.log('error', error);
    response.status(502).json({ error: `Unknown error ${error}` });
  }
};

import { adapterResponseJSON } from './adapterResponse';

export default {
  getIndexPage,
  getStampedImage,
  getScreenShot,
  adapterResponseJSON,
  getMetaData,
  getTweetData,
};
