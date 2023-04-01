import { Request, Response } from 'express';
import puppeteer from 'puppeteer';
import {
  getMetaDataPromise,
  getTrustedHashSum,
  getTweetDataPromise,
  isValidUint64,
  isValidUrl,
  makeImageBase64UrlfromBuffer,
  makeTweetUrlWithId,
  pngPathFromTweetId,
  tweetDataPathFromTweetId,
} from '../helpers';
import { puppeteerDefaultConfig } from '../config';
import path from 'path';
import { processPWD } from '../prestart';
import { IGetScreenshotResponseData, IMetadata, ITweetPageMetaData, ITweetRawData } from '../types';

// import Hash from 'ipfs-only-hash';
import { NFTStorage, Blob as NFTBlob } from 'nft.storage';

// import CID from 'cids';
// import multihashing from 'multihashing-async';

// import multiformats from 'multiformats';
// import { sha256 } from 'multiformats/hashes/sha2';
// import { sha256 as hasher } from 'multiformats/hashes/sha2';
// import * as Block from 'multiformats/block';
// import * as codec from '@ipld/dag-cbor';
import fs from 'fs/promises';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';

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

    const metadataToSave = {
      tweetdata: responseData.tweetdata,
      metadata: responseData.metadata,
    };

    // console.log(metadataToSave);

    //// TEXT
    const text = await fs.readFile(
      path.resolve(processPWD, 'data', 'test', tweetDataPathFromTweetId(tweetId)),
    );
    const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });

    const hashText = await sha256.digest(text);
    const cidText = CID.create(1, 85, hashText);
    console.log(cidText.toString());

    const metadataBlob = new NFTBlob([text]);
    const metadataCid = await client.storeBlob(metadataBlob);

    // console.log(metadataCid);
    //bafkreihp4n2z4bxyhwsa2kr2ontaporasoz5s7ckr7xpfczejcc7tkdmbu;
    // console.log(cidText.toString() === metadataCid);
    console.log(
      cidText.toString() === 'bafkreihp4n2z4bxyhwsa2kr2ontaporasoz5s7ckr7xpfczejcc7tkdmbu',
    );

    //// IMAGE
    const image = await fs.readFile(
      path.resolve(processPWD, 'data', 'test', '1640378758669520896.png'),
    );

    const hashImage = await sha256.digest(image);
    const cidImage = CID.create(1, 112, hashImage);
    console.log(cidImage.toString());

    const screenshotBlob = new NFTBlob([image]);
    const screenshotCid = await client.storeBlob(screenshotBlob);

    console.log(screenshotCid.toString());
    // bafybeihbpiryqgmzmq3w2buelaeznjfn72bexbpmlz5frjjydnjdxfdkyy
    console.log(cidText.toString() === screenshotCid);
    console.log(
      cidImage.toString() === 'bafybeihbpiryqgmzmq3w2buelaeznjfn72bexbpmlz5frjjydnjdxfdkyy',
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
