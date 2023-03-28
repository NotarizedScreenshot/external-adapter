import { Request, Response } from 'express';
import {
  metadataPathFromTweetId,
  metadataToAttirbutes,
  pngPathFromTweetId,
  tweetDataPathFromTweetId,
  getTrustedHashSum,
  getTweetResultsFromTweetRawData,
  uploadToNFTStorageWithHash,
  uploadBufferToNFTStorage,
  processMetaData,
  tweeetDataToAttributes,
  pngPathStampedFromTweetId,
} from '../helpers';
import path from 'path';
import { processPWD } from '../prestart';
import fs from 'fs/promises';

import { NFTStorage, Blob as NFTBlob } from 'nft.storage';

import { createTweetData } from '../models';

import { IAdapterResponseData, ITweetCard, ITweetResults } from 'types';
import { makeStampedImage } from '../helpers/images';

export const adapterResponseJSON = async (request: Request, response: Response) => {
  try {
    const requestUrl = request.body.data.url;

    const tweetId = request.body.data.url as string;

    const tweetDataPath = path.resolve(processPWD, 'data', tweetDataPathFromTweetId(tweetId));
    const metadataPath = path.resolve(processPWD, 'data', metadataPathFromTweetId(tweetId));
    const screenshotPath = path.resolve(processPWD, 'data', pngPathFromTweetId(tweetId));
    const watermarkedSreenshotPath = path.resolve(
      processPWD,
      'data',
      pngPathStampedFromTweetId(tweetId),
    );

    const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });

    const metadata = processMetaData(await fs.readFile(metadataPath, 'utf-8'));

    const tweetRawData = await fs.readFile(tweetDataPath, 'utf-8');
    const tweetResults = getTweetResultsFromTweetRawData(tweetRawData, tweetId) as ITweetResults;

    const tweetData = createTweetData(tweetResults);

    const { body, user } = tweetData;
    const { card, media } = body;

    //UPLOADING TIME EXCEEDS CHAINLINK NODE TIMEOUT (15s). UNCOMMENT WHEN SOLVE// -- START
    // const mediaFilesUploadedData = media
    //   ? await Promise.all(
    //       media.map(async ({ src }) => await uploadToNFTStorageWithHash(client, src)),
    //     )
    //   : [];
    //UPLOADING TIME EXCEEDS CHAINLINK NODE TIMEOUT (15s). UNCOMMENT WHEN SOLVE// -- END

    const cardImageKeys =
      card &&
      (Object.keys(card).filter((key) =>
        ['thumbnail_image_original', 'player_image_original'].includes(key),
      ) as [keyof ITweetCard]);
    //UPLOADING TIME EXCEEDS CHAINLINK NODE TIMEOUT (15s). UNCOMMENT WHEN SOLVE// -- START
    // const cardImagesData = cardImageKeys
    //   ? await Promise.all(
    //       cardImageKeys?.map(async (key) => await uploadToNFTStorageWithHash(client, card![key])),
    //     )
    //   : [];
    //UPLOADING TIME EXCEEDS CHAINLINK NODE TIMEOUT (15s). UNCOMMENT WHEN SOLVE// -- END

    //UPLOADING TIME EXCEEDS CHAINLINK NODE TIMEOUT (15s). UNCOMMENT WHEN SOLVE// -- START
    // const userImageUploadedData =
    //   user.profile_image_url_https &&
    //   (await uploadToNFTStorageWithHash(client, user.profile_image_url_https));
    //UPLOADING TIME EXCEEDS CHAINLINK NODE TIMEOUT (15s). UNCOMMENT WHEN SOLVE// -- END

    // const screenshotBuffer = await fs.readFile(screenshotPath);
    // const screenshotHashSum = getTrustedHashSum(screenshotBuffer);

    // const watermarkedImageBuffer = await fs.readFile(watermarkedSreenshotPath);

    // const watermarkedImageBuffer = await makeStampedImage(screenshotPath, metadataPath);
    // const watermarkedImageHashSum =
    //   watermarkedImageBuffer && getTrustedHashSum(watermarkedImageBuffer);

    // const screenshotCid = await uploadBufferToNFTStorage(client, screenshotBuffer);
    // const watermarkedScreenshotCid =
    //   watermarkedImageBuffer && (await uploadBufferToNFTStorage(client, watermarkedImageBuffer));

    const cids = await Promise.all(
      [watermarkedSreenshotPath, screenshotPath].map(async (path) => {
        const buffer = await fs.readFile(path);
        const hashSum = getTrustedHashSum(buffer);
        const cid = await uploadBufferToNFTStorage(client, buffer);
        return { path, cid, hashSum };
      }),
    );

    // console.log(cids);

    const finalData = {
      screenshot: {
        cid: cids[0].cid,
        // hashSum: screenshotHashSum,
        hashSum: cids[0].hashSum,
      },
      watermarkedScreenshot: {
        // cid: watermarkedScreenshotCid,
        cid: cids[1].cid,
        hashSum: cids[1].hashSum,
      },
      // media: [userImageUploadedData, ...cardImagesData, ...mediaFilesUploadedData],
      tweetRawData,
      parsedTweetData: tweetData,
      metadata,
    };

    // console.log('screenshothash', cids[1].hashSum);
    // console.log('screenshothash', screenshotHashSum);

    const finalTrustedDataToHash = {
      // screenShotHash: screenshotHashSum,
      screenShotHash: cids[1].hashSum,
      tweetRawData,
      parsedTweetData: tweetData,
      metadata,
    };

    const trustedSha256sum = getTrustedHashSum(JSON.stringify(finalTrustedDataToHash));
    console.log('trustedSha256sum', trustedSha256sum);

    const attributes = [...tweeetDataToAttributes(tweetData), ...metadataToAttirbutes(metadata)];

    const name = 'Notarized Screenshot 0x' + trustedSha256sum;
    const image = 'ipfs://' + cids[1].cid;
    // const image = 'ipfs://' + screenshotCid;
    // const image = 'ipfs://' + '';
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
        // cid: String(watermarkedScreenshotCid),
        // cid: String('screenshotCid'),
        cid: String(cids[1].cid),

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
