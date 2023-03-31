import { getDnsInfo, getHostWithoutWWW, trimUrl, tweetDataPathFromTweetId } from '../helpers';
import { HTTPResponse, Page } from 'puppeteer';
import { IMetadata } from '../types';
import { DEFAULT_TIMEOUT_MS } from '../config';
import fs from 'fs/promises';
import path from 'path';
import { processPWD } from '../prestart';

export const getMetaDataPromise = (page: Page, tweetUrl: string) =>
  new Promise<string>((resolve, reject) => {
    page.on('response', async (pupperTerresponse: HTTPResponse) => {
      const responseUrl = pupperTerresponse.url();
      const trimmedResponseUrl = trimUrl(responseUrl);
      if (trimmedResponseUrl === tweetUrl) {
        const headers = pupperTerresponse.headers();
        const { ip } = pupperTerresponse.remoteAddress();
        const host = getHostWithoutWWW(tweetUrl);

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
        resolve(JSON.stringify(meta));
      }
      setTimeout(() => reject('failed to get metadata'), DEFAULT_TIMEOUT_MS);
    });
  });

export const getTweetDataPromise = (page: Page, tweetId: string) =>
  new Promise<string>((resolve, reject) => {
    page.on('response', async (pupperTerresponse: HTTPResponse) => {
      const responseUrl = pupperTerresponse.url();
      if (responseUrl.match(/TweetDetail/g)) {
        const responseData = await pupperTerresponse.text();

        if (responseData.includes(`tweet-${tweetId}`)) {
          await fs.writeFile(
            path.resolve(processPWD, 'data', tweetDataPathFromTweetId(tweetId)),
            responseData,
          );
          resolve(responseData);
        }
      }
      setTimeout(() => reject('failed to get tweet data'), DEFAULT_TIMEOUT_MS);
    });
  });
