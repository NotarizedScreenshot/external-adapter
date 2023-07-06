import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import Queue, { QueueOptions } from 'bull';
import { processPWD } from '../prestart';
import {
  getSocketByUserId,
  getTweetTimelineEntries,
  metadataCidPathFromTweetId,
  metadataToAttirbutes,
} from '../helpers';
import { uploadToCAS } from '../helpers/nftStorage';
import { ITweetTimelineEntry, IUploadJobData } from '../types';
import { NFTStorage } from 'nft.storage';
import { createMoment, createNftDescription, createNftName, createTweetData } from '../models';

const REDIS_DEFAULT_PORT = 6379;
const REDIS_DEFAULT_HOST = 'redis';

const redis = `redis://${process.env.REDIS_HOST ? process.env.REDIS_HOST : REDIS_DEFAULT_HOST}:${
  process.env.REDIS_PORT ? process.env.REDIS_PORT : REDIS_DEFAULT_PORT
}`;

export const uploadQueue = new Queue<IUploadJobData>('upload_screen_shot', redis);

uploadQueue.process(async (job) => {
  console.log(`uploadQueue job id:${job.id} name: ${job.name} started `);
  job.progress(1);
  const {
    tweetId,
    tweetdata,
    metadata,
    screenshotImageBuffer,
    stampedImageBuffer,
    mediaUrls,
    userId,
  } = job.data;

  const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });

  const screenshotCid = await uploadToCAS(Buffer.from(screenshotImageBuffer!), client);
  job.progress(10);

  const stampedScreenShotCid = await uploadToCAS(Buffer.from(stampedImageBuffer!), client);
  job.progress(20);

  const mediaCidMap = await Promise.all<{ url: string; cid: string | null; error?: string }>(
    mediaUrls.map(async (url: string, index: number, array: any[]) => {
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
        });
        const buffer = response.data;

        const cid = (await uploadToCAS(buffer, client)) as string;

        return { url, cid };
      } catch (error: any) {
        console.log(`axios error, url: ${url}, error: ${error.message}`);
        return { url, cid: null, error: error.message };
      }
    }),
  );
  job.progress(70);

  const metadataToSave = {
    tweetdata,
    metadata,
    mediaCidMap,
    screenshotCid,
    stampedScreenShotCid,
  };

  const metadataToSaveCid = await uploadToCAS(JSON.stringify(metadataToSave), client);
  job.progress(90);

  const tweetEntry: ITweetTimelineEntry = getTweetTimelineEntries(tweetdata).find(
    (entry) => entry.entryId === `tweet-${tweetId}`,
  )!;

  const tweetData = tweetEntry?.content
    ? createTweetData(tweetEntry.content.itemContent.tweet_results.result)
    : (() => {
        const tweetRawDataParsed = JSON.parse(tweetdata!);
        return createTweetData(tweetRawDataParsed.data.tweetResult.result);
      })();

  const author = tweetData?.user.screen_name ? tweetData?.user.screen_name : 'unknown autor';

  const ts = Date.now();
  const moment = createMoment(ts);
  const name = createNftName(tweetId, moment);
  const image = 'ipfs://' + screenshotCid;
  const time = new Date(ts).toUTCString();

  const description = createNftDescription(tweetId, author, moment);

  const attributes = metadata ? metadataToAttirbutes(JSON.parse(metadata)) : [];

  const nftMetadataCid = await uploadToCAS(
    JSON.stringify({
      name,
      image,
      description,
      ts,
      time,
      tweetId,
      attributes,
    }),
    client,
  );

  await fs.writeFile(
    path.resolve(processPWD, 'data', metadataCidPathFromTweetId(tweetId)),
    JSON.stringify({ [tweetId]: metadataToSaveCid }),
  );
  job.progress(100);

  return Promise.resolve({
    mediaCidMap,
    screenshotCid,
    stampedScreenShotCid,
    metadataToSaveCid,
    userId,
    nftMetadataCid,
  });
});

uploadQueue.on('completed', async (job) => {
  console.log(`uploadQueue job id:${job.id} name: ${job.name} completed `);
  const data = await job.finished();
  const socket = getSocketByUserId(data.userId);
  console.log(data);
  if (!!socket) socket.emit('uploadComplete', JSON.stringify(data));
  job.remove();
});

uploadQueue.on('progress', (job, progress) => {
  console.log(`uploadQueue job id:${job.id} name: ${job.name} progress ${progress} `);
  const socket = getSocketByUserId(job.data.userId);
  if (!!socket) socket.emit('uploadProgress', progress);
});

uploadQueue.on('error', (error) => {
  console.log('upload error', error);
});

uploadQueue.on('failed', (job, error) => {
  console.log(`Job id: ${job.id} failed with error:`, error);
});
