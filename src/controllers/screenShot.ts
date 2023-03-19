import { Request, Response } from 'express';
import fs from 'fs/promises';
import {
  getDnsInfo,
  getHostWithoutWWW,
  isValidBigInt,
  isValidUrl,
  makeTweetUrlWithId,
  metadataPathFromTweetId,
  pngPathFromTweetId,
  trimUrl,
  tweetDataPathFromTweetId,
} from '../helpers';
import puppeteer, { HTTPResponse } from 'puppeteer';
import path from 'path';
import { processPWD } from '../prestart';
import { IMetadata } from 'types';

const VIEWPORT_DEFAULT_WIDTH = 450;
const VIEWPORT_DEFAULT_HEIGHT = 600;

const WATERMARK_DEFAULT_WIDTH = 818;
const WATERMARK_DEFAULT_HEIGHT = 1000;
const WATERMARK_IMAGE_PATH = path.resolve(processPWD, 'public/images/stamp_s.png');
const META_STAMP_FONT = '10px monospace';
const META_STAMP_COLOR = 'red';
const META_STAMP_CANVAS_DEFAULT_WIDTH = 900;
const META_STAMP_CANVAS_DEFAULT_HEIGHT = 1000;

const DEFAULT_USERAGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';

export const getScreenShot = async (request: Request, response: Response) => {
  try {
    console.log('run getScreenShot', new Date().toString());
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
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    const url = tweetUrl;
    const clientCode = request.body.clientCode;

    console.log('url', url);

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
