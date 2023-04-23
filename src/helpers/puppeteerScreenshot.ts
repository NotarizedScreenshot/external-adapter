const VIEWPORT_DEFAULT_WIDTH = 1000;
const VIEWPORT_DEFAULT_HEIGHT = 1000;

const DEFAULT_USERAGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';

import {
  trimUrl,
  pngPathFromTweetId,
  tweetDataPathFromTweetId,
  getHostWithoutWWW,
  getDnsInfo,
  makeTweetUrlWithId,
  metadataPathFromTweetId
} from '.';
import puppeteer, {HTTPResponse} from 'puppeteer';
import fs from "fs/promises";
import path from 'path';
import {processPWD} from '../prestart';
import {IMetadata} from 'types';

export const puppeteerScreenshot = async (tweetId: string): Promise<Buffer> => {
  const tweetUrl = makeTweetUrlWithId(tweetId);
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const url = tweetUrl;

  page.on('response', async (pupperTerresponse: HTTPResponse) => {
    try {
      const responseUrl = pupperTerresponse.url();
      const trimmedResponseUrl = trimUrl(responseUrl);

      if (responseUrl.match(/TweetDetail/g)) {
        const responseData = await pupperTerresponse.json();
        const responseDataString = JSON.stringify(responseData.data);

        if (responseDataString.includes(`tweet-${tweetId}`)) {
          await fs.writeFile(
            path.resolve(processPWD, 'data', tweetDataPathFromTweetId(tweetId)),
            responseDataString,
          );
        }
      }

      if (trimmedResponseUrl === url) {
        const headers = pupperTerresponse.headers();
        const {ip} = pupperTerresponse.remoteAddress();
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
          dns: {host, data: dns},
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
  await page.goto(url, {waitUntil: 'networkidle0'});

  const screenshotPath = path.resolve(processPWD, 'data', pngPathFromTweetId(tweetId));

  const screenshotImageBuffer: Buffer = await page.screenshot({
    path: screenshotPath,
  });
  browser.close();
  return screenshotImageBuffer
}