import { Request, Response } from 'express';
import {
  metadataPathFromTweetId,
  metadataPathFromUrl,
  metadataToAttirbutes,
  pngPathFromTweetId,
  pngPathFromUrl,
  trimUrl,
  tweetDataPathFromTweetId,
  getTrustedHashSum,
  getTweetResultsFromTweetRawData,
} from '../helpers';
import path from 'path';
import { processPWD } from '../prestart';
import fs from 'fs/promises';
import enchex from 'crypto-js/enc-hex';
import sha256 from 'crypto-js/sha256';
import { NFTStorage, Blob as NFTBlob } from 'nft.storage';
import CryptoJS from 'crypto-js';

import { createTweetData } from '../models';
// import { buffer } from 'stream/consumers';

import axios from 'axios';
import { ITweetCard } from 'types';

export const adapterResponseJSON = async (request: Request, response: Response) => {
  try {
    const requestUrl = request.body.data.url;
    // const metadataPath = path.resolve(
    //   processPWD,
    //   'data',
    //   metadataPathFromUrl(trimUrl(requestUrl), ''),
    // );
    // const screenshotPath = path.resolve(
    //   processPWD,
    //   'data',
    //   pngPathFromUrl(trimUrl(requestUrl), ''),
    // );

    const tweetId = request.body.data.url as string;

    // const tweetDataPath = path.resolve(processPWD, 'data', tweetDataPathFromTweetId(tweetId));
    const metadataPath = path.resolve(
      processPWD,
      'src',
      'temp',
      metadataPathFromTweetId('1636039872002785287'),
    );
    const screenshotPath = path.resolve(
      processPWD,
      'src',
      'temp',
      pngPathFromTweetId('1636039872002785287'),
    );

    // console.log(tweetDataPath);
    // console.log(metadataPath);
    // console.log(screenshotPath);

    // const tweetRawData = await fs.readFile(tweetDataPath, 'utf-8');

    // const tweetRawDataTrustedSum = getTrustedHashSum(tweetRawData);
    //
    // const tweetResults = getTweetResultsFromTweetRawData(tweetRawData, tweetId);

    // const { legacy, views, core, card } = tweetResults;

    // const tweetData = createTweetData(legacy, views, core, card);

    // const { body } = tweetData;

    // const mediaFiles = body.media
    //   ? body.media.map(async ({ type, src, thumb }, index) => {
    //       const response = await axios.get(src, { responseType: 'arraybuffer' });
    //       // console.log(response2);
    //       // const response = await fetch(src);
    //       // console.log(response.data);
    //       // const blob = await response.blob();

    //       // console.log('blob', blob);

    //       // const arrayBuffer = await blob.arrayBuffer();
    //       // const buffer = await Buffer.from(arrayBuffer);

    //       const buffer = Buffer.from(response.data);

    //       // const checkSum1 = getTrustedHashSum(buffer);
    //       const checkSum = getTrustedHashSum(buffer);
    //       // const checkSum3 = getTrustedHashSum(response2.data);

    //       // console.log(checkSum1);
    //       console.log(checkSum);
    //       // console.log(checkSum1 === checkSum2);
    //       console.log('---------');

    //       // fs.writeFile(`${index}-1.jpg`, buffer);

    //       // return { src, buffer, checkSum };
    //     })
    //   : [];

    // const buffers = await Promise.all(mediaFiles);

    // console.log(buffers);

    // const cardKeys = body.card ? (Object.keys(body.card!) as [keyof ITweetCard]) : [];

    // const cardFiles = cardKeys
    //   .filter((key) => ['thumbnail_image_original', 'player_image_original'].includes(key))
    //   .map(async (key) => {
    //     const response = await axios.get(body.card![key], { responseType: 'arraybuffer' });
    //     const buffer = Buffer.from(response.data);
    //     const checkSum = getTrustedHashSum(buffer);
    //     return { src: body.card![key], buffer, checkSum };
    //   });

    // // .map((key) => {
    // //   if (!!body.card && ['thumbnail_image_original', 'player_image_original'].includes(key)) {
    // //     return body.card[key];
    // //   }

    // //   return false;
    // // })
    // // .filter((el) => el);

    // console.log(await Promise.all(cardFiles));

    // thumbnail_image_original : [];

    // buffers.map(async (buffer, index) => {
    //   const file = await fs.readFile(path.resolve(processPWD, 'data', `${tweetId}-${index}.mp4`));
    //   console.log(file);
    //   console.log(getTrustedHashSum(file));
    //   console.log(buffer);
    //   console.log(getTrustedHashSum(buffer));

    //   // fs.writeFile(path.resolve(processPWD, 'data', `${tweetId}-${index}.jpg`), buffer);
    // });

    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    console.log('metadata', metadata);

    const screenshotBuffer = await fs.readFile(screenshotPath);

    const trustedSha256sum = enchex.stringify(
      // @ts-ignore
      sha256(CryptoJS.lib.WordArray.create(screenshotBuffer)),
    );
    // const trustedSha256sum1 = enchex.stringify(
    //   // @ts-ignore
    //   sha256(CryptoJS.lib.WordArray.create(x)),
    // );

    const screenshotBlob = new NFTBlob([screenshotBuffer]);

    const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });
    const screenshotCid = await client.storeBlob(screenshotBlob);

    // '0x09e789c62c58992bfdb7aa24c2c9362bf383bd5060008b3c9e8e41e6162843e7'

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
        url: tweetId,
        sha256sum: trustedSha256sum,
        cid: screenshotCid,
        metadataCid: metadataCid,
      },
    };
    response.status(200).json(data);
    // response.status(200).json({ ok: 'ok', tweetRawDataTrustedSum, tweetData });
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
