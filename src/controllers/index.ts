import path from 'path';
import fs from 'fs/promises';
import fss from "fs";
import { Request, Response } from 'express';
import puppeteer, { HTTPResponse, HTTPRequest } from 'puppeteer';
import enchex from 'crypto-js/enc-hex';
import sha256 from 'crypto-js/sha256';
import CryptoJS, { pad } from 'crypto-js';
import { NFTStorage, Blob as NFTBlob } from 'nft.storage';
import {
  getHostWithoutWWW,
  trimUrl,
  isValidUrl,
  getDnsInfo,
  metadataToAttirbutes,
  getStampMetaString,
  pngPathFromUrl,
  pngPathStampedFromUrl,
  metadataPathFromUrl,
  tweetDataPathFromUrl,
} from '../helpers';
import { makeStampedImage } from '../helpers/images';

import { IMetadata } from 'types';
import { processPWD } from '../prestart';
import images from 'images';
import { createCanvas } from 'canvas';

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

const getIndexPage = (request: Request, response: Response) => {
  console.log('get index request', request.query.url);
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
const getMetaData = async (request: Request, response: Response) => {
  try {
    const tweetId = request.query.tweetId;
    if (!tweetId) {
      //TODO; add tweetId validator
      return response.status(422).json({ error: 'invalid tweetId' });
    }
    const metaData = await fs.readFile(
      path.resolve(processPWD, 'data', tweetId + '-meta.json'),
      'utf-8',
    );
    response.status(200).json(JSON.parse(metaData));
  } catch (error) {
    console.log(`getMetaData controller error:  ${error}`);
    if (error instanceof Error) {
      return response.status(502).json({ error: error.message });
    }
    response.status(502).json({ error: `Unknown error: ${error}` });
  }
};

const getTweetData = async (request: Request, response: Response) => {
  console.log('aaaaaaaaaaaa', request.query.tweetId);
  try {
    const tweetId = request.query.tweetId;
    if (!tweetId) {
      //TODO; add tweetId validator
      return response.status(422).json({ error: 'invalid tweetId' });
    }

    const tweetData = await fs.readFile(
      path.resolve(processPWD, 'data', tweetId + '.json'),
      'utf-8',
    );
    response.status(200).json(JSON.parse(tweetData));
  } catch (error) {
    console.log(`getTweetData controller error:  ${error}`);
    if (error instanceof Error) {
      return response.status(502).json({ error: error.message });
    }
    response.status(502).json({ error: `Unknown error: ${error}` });
  }
};

const getScreenShot = async (request: Request, response: Response) => {
  try {
    const tweetUrl = `https://twitter.com/twitter/status/${request.body.tweetId}`;
    if (!isValidUrl(tweetUrl)) {
      console.log('error: invalid url');
      return response.status(422).json({ error: 'invalid url' });
    }
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const url = trimUrl(tweetUrl);
    const clientCode = request.body.clientCode;

    page.on('response', async (pupperTerresponse: HTTPResponse) => {
      try {
        const responseUrl = pupperTerresponse.url();

        if (responseUrl.match(/TweetDetail/g)) {
          pupperTerresponse
            .json()
            .then(async (data) => {
              const { tweet_results } = data.data[
                'threaded_conversation_with_injections_v2'
              ].instructions
                .reduce((acc: any, val: any) => {
                  return val.type === 'TimelineAddEntries' ? val : acc;
                }, null)
                .entries.reduce((acc: any, val: any) => {
                  return val.entryId === `tweet-${request.body.tweetId}` ? val : acc;
                }, null).content.itemContent;

              const { legacy, views, core, card } = tweet_results.result;

              const { profile_image_url_https, name, screen_name } =
                core.user_results.result.legacy;

              const props = [
                'vanity_url',
                'card_url',
                'title',
                'description',
                'domain',
                'thumbnail_image_original',
                // 'photo_image_full_size_original',
                // 'summary_photo_image_original',
              ];

              const cardData = !card
                ? null
                : card?.legacy.binding_values.reduce((acc: any, val: any) => {
                    if (props.includes(val.key)) {
                      if (val.value.type === 'STRING') {
                        acc[val.key] = val.value.string_value;
                      }

                      if (val.value.type === 'IMAGE') {
                        acc[val.key] = val.value.image_value.url;
                      }
                    }
                    return acc;
                  }, {});

              const {
                full_text,
                created_at,
                favorite_count,
                // favorited,
                quote_count,
                retweet_count,
                // reply_count,
                // retweeted,
                entities,
              } = legacy;
              const { count: views_count } = views;

              const { media, user_mentions, urls, hashtags, symbols } = entities;
              console.log('entities', media, user_mentions, urls, hashtags, symbols);

              const tweetMentions = !user_mentions
                ? []
                : user_mentions.map((mention: any) => mention.screen_name);

              const tweetMedia = !media ? [] : media.map((el: any) => el.media_url_https);
              const tweetUrls =
                !urls || url.length === 0 ? [] : urls?.map((url: any) => url.expanded_url);
              // console.log(hashtags);
              const tweetHashTags =
                !hashtags || hashtags.length === 0
                  ? []
                  : hashtags?.map((hashtag: any) => hashtag.text);

              const tweetSymbols =
                !symbols || symbols.length === 0 ? [] : symbols?.map((symbol: any) => symbol.text);

              const tweetData = {
                body: {
                  full_text,
                  card: cardData,
                  urls: tweetUrls,
                  hashtags: tweetHashTags,
                  symbols: tweetSymbols,
                  media: tweetMedia,
                  user_mentions: tweetMentions,
                },
                user: { profile_image_url_https, name, screen_name },
                details: {
                  retweet_count,
                  quote_count,
                  favorite_count,
                  views_count,
                  created_at,
                },
              };
              // console.log('tweetData', tweetData);
              // console.log('tweetData', tweetData.body);
              await fs.writeFile(
                path.resolve(processPWD, 'data', request.body.tweetId + '.json'),
                JSON.stringify(tweetData),
              );
            })
            .catch((error) => {
              // console.log('url', responseUrl);
              console.log(error);
              return undefined;
            });
        }

        const trimmedResponseUrl = trimUrl(responseUrl);

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
            path.resolve(processPWD, 'data', metadataPathFromUrl(url, clientCode)),
            JSON.stringify(meta),
          );

          await fs.writeFile(
            path.resolve(processPWD, 'data', request.body.tweetId + '-meta.json'),
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

    const screenshotPath = path.resolve(processPWD, 'data', pngPathFromUrl(url, clientCode));

    const screenshotImageBuffer: Buffer = await page.screenshot({ path: screenshotPath });
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

    await fs.writeFile(stampedFilePath, metamarkedImageBuffer);
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


//
export const adapterResponseJSON = async (request: Request, response: Response) => {
  try {
    const requestUrl = request.body.data.url;
    const metadataPath = path.resolve(processPWD, 'data', metadataPathFromUrl(trimUrl(requestUrl), ''));
    const screenshotPath = path.resolve(processPWD, 'data', pngPathFromUrl(trimUrl(requestUrl), ''));
       
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    const screenshotBuffer = await fs.readFile(screenshotPath);

    const trustedSha256sum = enchex.stringify(
      // @ts-ignore
      sha256(CryptoJS.lib.WordArray.create(screenshotBuffer)),
    );

    const screenshotBlob = new NFTBlob([screenshotBuffer]);

    const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });
    const screenshotCid = await client.storeBlob(screenshotBlob);

    const name = 'Notarized Screenshot 0x' + trustedSha256sum;
    const image = 'ipfs://' + screenshotCid;
    const ts = Date.now();
    const time = new Date(ts).toUTCString();
    const description = name +
          " by QuantumOracle, result of verifying the image served at URL \n" +
          requestUrl +
          " at ts " + time + "\n" +
          " Check metadata fields for more details."

    const metadataBlob = new NFTBlob([JSON.stringify({
      name,
      image,
      description,
      ts,
      time,
      url: requestUrl,
      attributes: metadataToAttirbutes(metadata)
    })]);

    const metadataCid = await client.storeBlob(metadataBlob);
    const data = {
      data: {
        url: requestUrl,
        sha256sum: trustedSha256sum,
        cid: screenshotCid,
        metadataCid: metadataCid,
      },
    };
    response.status(200).json(data);
  } catch (error) {
    console.log(error);
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

export default {
  getIndexPage,
  getStampedImage,
  getScreenShot,
  adapterResponseJSON,
  getTweetData,
  getMetaData,
};
