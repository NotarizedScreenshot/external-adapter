import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import Queue from 'bull';
import { processPWD } from '../prestart';
import { getSocketByUserId, metadataCidPathFromTweetId } from '../helpers';
import { updloadTweetToCAS } from '../helpers/nftStorage';
import { IUploadJobData } from '../types';

export const uploadQueue = new Queue<IUploadJobData>('upload_screen_shot');

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

  const screenshotCid = await updloadTweetToCAS(Buffer.from(screenshotImageBuffer!));
  job.progress(10);

  const stampedScreenShotCid = await updloadTweetToCAS(Buffer.from(stampedImageBuffer!));
  job.progress(20);

  const mediaCidMap = await Promise.all<{ url: string; cid: string | null; error?: string }>(
    mediaUrls.map(async (url: string, index: number, array: any[]) => {
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
        });
        const buffer = response.data;

        const cid = (await updloadTweetToCAS(buffer)) as string;

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

  const metadataToSaveCid = await updloadTweetToCAS(JSON.stringify(metadataToSave));
  job.progress(90);

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
  });
});

uploadQueue.on('completed', async (job) => {
  console.log(`uploadQueue job id:${job.id} name: ${job.name} completed `);
  const data = await job.finished();
  const socket = getSocketByUserId(data.userId);
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
