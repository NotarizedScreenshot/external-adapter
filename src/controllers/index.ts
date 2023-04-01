import path from 'path';
import fs from 'fs/promises';
import fss from 'fs';
import { Request, Response } from 'express';
import enchex from 'crypto-js/enc-hex';
import sha256 from 'crypto-js/sha256';
import CryptoJS from 'crypto-js';
import { NFTStorage, Blob as NFTBlob } from 'nft.storage';
import {
  trimUrl,
  metadataToAttirbutes,
  pngPathFromUrl,
  pngPathStampedFromUrl,
  metadataPathFromUrl,
  metadataPathFromTweetId,
  isValidBigInt,
  tweetDataPathFromTweetId,
} from '../helpers';
import { makeStampedImage } from '../helpers/images';

import { IMetadata, ITweetData } from 'types';
import { processPWD } from '../prestart';
import { createTweetData } from '../models';

import {puppeteerScreenshot} from '../helpers/puppeteerScreenshot'


const WATERMARK_DEFAULT_WIDTH = 818;
const WATERMARK_DEFAULT_HEIGHT = 1000;
const WATERMARK_IMAGE_PATH = path.resolve(processPWD, 'public/images/stamp_s.png');
const META_STAMP_FONT = '10px monospace';
const META_STAMP_COLOR = 'red';
const META_STAMP_CANVAS_DEFAULT_WIDTH = 900;
const META_STAMP_CANVAS_DEFAULT_HEIGHT = 1000;


const getIndexPage = (_: Request, response: Response) => {
  try {
    response.set('Content-Type', 'text/html');
    response.status(200).sendFile(path.resolve(process.env.PWD!, 'public/index.html'));
  } catch (error) {
    console.log(error);
    response.status(502).send(error);
  }
};

const getScreenShot = async (request: Request, response: Response) => {
  console.log('getScreenShot:', request.body)

  try {
    const { tweetId } : {tweetId: string } = request.body;
    console.log('getScreenShot: tweetId = ', tweetId)

    if (!isValidBigInt(tweetId)) {
      console.log('getScreenShot: error: invalid tweet id ', tweetId);
      return response.status(422).json({ error: `invalid tweet id ${tweetId}` });
    }

    const screenshotImageBuffer = await puppeteerScreenshot(tweetId)

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
    const metadataPath = path.resolve(
      processPWD,
      'data',
      metadataPathFromUrl(trimUrl(requestUrl), ''),
    );
    const screenshotPath = path.resolve(
      processPWD,
      'data',
      pngPathFromUrl(trimUrl(requestUrl), ''),
    );

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
    const description =
      name +
      ' by QuantumOracle, result of verifying the image served at URL \n' +
      requestUrl +
      ' at ts ' +
      time +
      '\n' +
      ' Check metadata fields for more details.';

    const metadataBlob = new NFTBlob([
      JSON.stringify({
        name,
        image,
        description,
        ts,
        time,
        url: requestUrl,
        attributes: metadataToAttirbutes(metadata),
      }),
    ]);

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

export const getMetaData = async (request: Request, response: Response) => {
  try {
    const { tweetId } = request.query as { tweetId: string };
    if (!isValidBigInt(tweetId)) {
      console.log('error: invalid tweet id');
      return response.status(422).json({ error: 'invalid tweet id' });
    }
    const metadataPath = path.resolve(processPWD, 'data', metadataPathFromTweetId(tweetId));
    const metadata = await fs.readFile(metadataPath, 'utf-8');
    response.status(200).json(JSON.parse(metadata));
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

    const tweetResponseInstructions =
      tweetRawData['threaded_conversation_with_injections_v2'].instructions;

    const tweetTimeLineEntries = tweetResponseInstructions.reduce((acc: any, val: any) => {
      return val.type === 'TimelineAddEntries' ? val : acc;
    }, null).entries;

    const itemContents = tweetTimeLineEntries.reduce((acc: any, val: any) => {
      return val.entryId === `tweet-${tweetId}` ? val : acc;
    }, null).content.itemContent;

    const { legacy, views, core, card } = itemContents.tweet_results.result;

    const tweetData: ITweetData = createTweetData(legacy, views, core, card);

    response.status(200).json(tweetData);
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

export default {
  getIndexPage,
  getStampedImage,
  getScreenShot,
  adapterResponseJSON,
  getMetaData,
  getTweetData,
};
