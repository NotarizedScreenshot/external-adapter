import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import Queue from 'bull';
import { NFTStorage, Blob as NFTBlob } from 'nft.storage';
import { processPWD } from '../prestart';
import { metadataCidPathFromTweetId } from '../helpers';

export const uploadQueue = new Queue('uploaad media');

uploadQueue.process(async (job) => {
  console.log('uploadQueue job started');
  job.progress(1);
  const {
    tweetId,
    mediaUrlsToUpload,
    screenShotBuffersToUpload: { screenshotImageBuffer, stampedImageBuffer },
    metadataToUpload: { metadata, tweetData },
  } = job.data as {
    tweetId: string;
    metadataToUpload: { metadata: string; tweetData: string };
    screenShotBuffersToUpload: { screenshotImageBuffer: Buffer; stampedImageBuffer: Buffer };
    mediaUrlsToUpload: string[];
  };

  const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });

  const screenshotBlob = screenshotImageBuffer && new NFTBlob([Buffer.from(screenshotImageBuffer)]);
  const screenshotCid = screenshotBlob && ((await client.storeBlob(screenshotBlob)) as string);
  job.progress(10);

  const stampedScreenShotBlob =
    stampedImageBuffer && new NFTBlob([Buffer.from(stampedImageBuffer)]);
  const stampedScreenShotCid =
    stampedScreenShotBlob && (await client.storeBlob(stampedScreenShotBlob));
  console.log(stampedScreenShotCid);
  job.progress(20);

  const mediaCidMap = await Promise.all<{ url: string; cid: string | null; error?: string }>(
    mediaUrlsToUpload.map(async (url: string, index: number, array: any[]) => {
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
        });
        const buffer = response.data;

        const blob = new NFTBlob([buffer]);
        const cid = (await client.storeBlob(blob)) as string;

        return { url, cid };
      } catch (error: any) {
        console.log(`axios error, url: ${url}, error: ${error.message}`);
        return { url, cid: null, error: error.message };
      }
    }),
  );
  job.progress(70);

  const metadataToSave = {
    tweetData,
    metadata,
    mediaCidMap,
    screenshotCid,
    stampedScreenShotCid,
  };

  const metadataToSaveBlob = new NFTBlob([JSON.stringify(metadataToSave)]);
  const metadataToSaveCid = await client.storeBlob(metadataToSaveBlob);
  job.progress(90);

  await fs.writeFile(
    path.resolve(processPWD, 'data', metadataCidPathFromTweetId(tweetId)),
    JSON.stringify({ [tweetId]: metadataToSaveCid }),
  );
  job.progress(100);

  return Promise.resolve({ mediaCidMap, screenshotCid, stampedScreenShotCid });
});
