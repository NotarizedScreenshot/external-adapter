import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import Queue from 'bull';
import { processPWD } from '../prestart';
import { metadataCidPathFromTweetId } from '../helpers';
import { updloadTweetToCAS } from '../helpers/nftStorage';

// export const uploadQueue = new Queue('uploaad media');

export const createQueue = (id: string) => {
  const uploadQueue = new Queue(id);
  uploadQueue.process(async (job) => {
    console.log(`uploadQueue job id:${job.id} name: ${job.name} started `);
    job.progress(1);
    const {
      tweetId,
      mediaUrlsToUpload,
      screenShotBuffersToUpload: { screenshotImageBuffer, stampedImageBuffer },
      metadataToUpload: { metadata, tweetData },
      requestId,
    } = job.data as {
      tweetId: string;
      metadataToUpload: { metadata: string; tweetData: string };
      screenShotBuffersToUpload: { screenshotImageBuffer: Buffer; stampedImageBuffer: Buffer };
      mediaUrlsToUpload: string[];
      requestId: string;
    };

    console.log(requestId);

    const screenshotCid = await updloadTweetToCAS(Buffer.from(screenshotImageBuffer));
    job.progress(10);

    const stampedScreenShotCid = await updloadTweetToCAS(Buffer.from(stampedImageBuffer));

    console.log(stampedScreenShotCid);
    job.progress(20);

    const mediaCidMap = await Promise.all<{ url: string; cid: string | null; error?: string }>(
      mediaUrlsToUpload.map(async (url: string, index: number, array: any[]) => {
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
      tweetData,
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
      requestId,
    });
  });

  return uploadQueue;
};

// uploadQueue.process(async (job) => {
//   console.log(`uploadQueue job id:${job.id} name: ${job.name} started `);
//   job.progress(1);
//   const {
//     tweetId,
//     mediaUrlsToUpload,
//     screenShotBuffersToUpload: { screenshotImageBuffer, stampedImageBuffer },
//     metadataToUpload: { metadata, tweetData },
//     requestId,
//   } = job.data as {
//     tweetId: string;
//     metadataToUpload: { metadata: string; tweetData: string };
//     screenShotBuffersToUpload: { screenshotImageBuffer: Buffer; stampedImageBuffer: Buffer };
//     mediaUrlsToUpload: string[];
//     requestId: string;
//   };

//   console.log(requestId);

//   const screenshotCid = await updloadTweetToCAS(Buffer.from(screenshotImageBuffer));
//   job.progress(10);

//   const stampedScreenShotCid = await updloadTweetToCAS(Buffer.from(stampedImageBuffer));

//   console.log(stampedScreenShotCid);
//   job.progress(20);

//   const mediaCidMap = await Promise.all<{ url: string; cid: string | null; error?: string }>(
//     mediaUrlsToUpload.map(async (url: string, index: number, array: any[]) => {
//       try {
//         const response = await axios.get(url, {
//           responseType: 'arraybuffer',
//         });
//         const buffer = response.data;

//         const cid = (await updloadTweetToCAS(buffer)) as string;

//         return { url, cid };
//       } catch (error: any) {
//         console.log(`axios error, url: ${url}, error: ${error.message}`);
//         return { url, cid: null, error: error.message };
//       }
//     }),
//   );
//   job.progress(70);

//   const metadataToSave = {
//     tweetData,
//     metadata,
//     mediaCidMap,
//     screenshotCid,
//     stampedScreenShotCid,
//   };

//   const metadataToSaveCid = await updloadTweetToCAS(JSON.stringify(metadataToSave));
//   job.progress(90);

//   await fs.writeFile(
//     path.resolve(processPWD, 'data', metadataCidPathFromTweetId(tweetId)),
//     JSON.stringify({ [tweetId]: metadataToSaveCid }),
//   );
//   job.progress(100);

//   return Promise.resolve({
//     mediaCidMap,
//     screenshotCid,
//     stampedScreenShotCid,
//     metadataToSaveCid,
//     requestId,
//   });
// });
