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
  pngPathStampedFromUrl,
  getImageBuffer,
  uploadToNFTStorageWithHash,
  uploadBufferToNFTStorage,
  processMetaData,
  tweeetDataToAttributes,
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
import { IAdapterResponseData, ITweetCard, ITweetResults } from 'types';
import { makeStampedImage } from '../helpers/images';
import { copyFileSync } from 'fs';
import images from 'images';
import { time } from 'console';

export const adapterResponseJSON = async (request: Request, response: Response) => {
  try {
    const requestUrl = request.body.data.url;
    console.log('run adapterRescponse controller');
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

    // const tweetId = request.body.data.url as string;
    const tweetId = '1636039872002785287';

    const tweetDataPath = path.resolve(
      processPWD,
      'src',
      'temp',
      tweetDataPathFromTweetId(tweetId),
    );
    const metadataPath = path.resolve(processPWD, 'src', 'temp', metadataPathFromTweetId(tweetId));
    const screenshotPath = path.resolve(processPWD, 'src', 'temp', pngPathFromTweetId(tweetId));

    console.log('paths', tweetDataPath, metadataPath, screenshotPath);

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

    const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });

    const metadata = processMetaData(await fs.readFile(metadataPath, 'utf-8'));
    // console.log(metadata);

    const tweetRawData = await fs.readFile(tweetDataPath, 'utf-8');
    const tweetResults = getTweetResultsFromTweetRawData(tweetRawData, tweetId) as ITweetResults;

    const tweetData = createTweetData(tweetResults);
    // console.log(tweetData);

    const { body, user } = tweetData;
    const { card, media } = body;

    const mediaFilesUploadedData = media
      ? await Promise.all(
          media.map(async ({ src }) => await uploadToNFTStorageWithHash(client, src)),
        )
      : [];

    const cardImageKeys =
      card &&
      (Object.keys(card).filter((key) =>
        ['thumbnail_image_original', 'player_image_original'].includes(key),
      ) as [keyof ITweetCard]);

    const cardImagesData = cardImageKeys
      ? await Promise.all(
          cardImageKeys?.map(async (key) => await uploadToNFTStorageWithHash(client, card![key])),
        )
      : [];

    const userImageUploadedData =
      user.profile_image_url_https &&
      (await uploadToNFTStorageWithHash(client, user.profile_image_url_https));

    const screenshotBuffer = await fs.readFile(screenshotPath);
    const screenshotHashSum = getTrustedHashSum(screenshotBuffer);

    const watermarkedImageBuffer = await makeStampedImage(screenshotPath, metadataPath);
    const watermarkedImageHashSum =
      watermarkedImageBuffer && getTrustedHashSum(watermarkedImageBuffer);

    const screenshotCid = await uploadBufferToNFTStorage(client, screenshotBuffer);
    const watermarkedScreenshotCid =
      watermarkedImageBuffer && (await uploadBufferToNFTStorage(client, watermarkedImageBuffer));

    console.log('screenshotCid', screenshotCid);
    // // console.log('watermarkedScreenshotCid', watermarkedScreenshotCid);
    // // console.log('userImageUploadedData', userImageUploadedData);
    // // console.log('cardImagesData', cardImagesData);
    // // console.log('mediaFilesUploadData', mediaFilesUploadedData);

    const finalData = {
      screenshot: {
        cid: screenshotCid,
        hashSum: screenshotHashSum,
      },
      watermarkedScreenshot: {
        cid: watermarkedScreenshotCid,
        hashSum: watermarkedImageHashSum,
      },
      media: [userImageUploadedData, ...cardImagesData, ...mediaFilesUploadedData],
      tweetRawData,
      parsedTweetData: tweetData,
      metadata,
    };

    const trustedSha256sum = getTrustedHashSum(JSON.stringify(finalData));

    // console.log(metadata);
    // console.log(metadataToAttirbutes(metadata));
    // console.log(tweeetDataToAttributes(tweetData));

    const attributes = [...tweeetDataToAttributes(tweetData), ...metadataToAttirbutes(metadata)];

    // console.log(attributes);

    // processMetaData(await fs.readFile(metadataPath, 'utf-8'));

    // const trustedSha256sum = enchex.stringify(
    //   // @ts-ignore
    //   sha256(CryptoJS.lib.WordArray.create(watermarkedImageBuffer)),
    // );

    // const screenshotCid = await client.storeBlob(screenshotBlob);

    // '0x09e789c62c58992bfdb7aa24c2c9362bf383bd5060008b3c9e8e41e6162843e7'

    const name = 'Notarized Screenshot 0x' + trustedSha256sum;
    const image = 'ipfs://' + watermarkedScreenshotCid;
    const ts = Date.now();
    const time = new Date(ts).toUTCString();
    const description =
      name +
      ' by QuantumOracle, result of verifying the tweet served by ID \n' +
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
        attributes,
        finalData,
      }),
    ]);

    const metadataCid = await client.storeBlob(metadataBlob);

    const data: { data: IAdapterResponseData } = {
      data: {
        url: tweetId,
        sha256sum: BigInt('0x' + trustedSha256sum).toString(),
        cid: String(watermarkedScreenshotCid),
        metadataCid: metadataCid,
      },
    };
    console.log('data complete', data);
    // const data = { ok: 'ok', trustedSha256sum, finalData };
    // const data = { ok: 'ok' };
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
