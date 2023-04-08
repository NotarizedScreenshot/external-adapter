import Queue from 'bull';
import { NFTStorage, Blob as NFTBlob } from 'nft.storage';
import { IScreenShotBuffersToUpload } from '../types';

// export const imageQueue = new Queue('image transcoding');

export const uploadQueue = new Queue('uploaad media');

uploadQueue.process((job) => {
  console.log('upload Queue');
  return Promise.resolve('resoled');
});

// imageQueue.process((job, done) => {
//   const {
//     allUrlsToUpload,
//     screenShotsToUpload: { screenshotImageBuffer, stampedImageBuffer },
//     metadataToUpload,
//   } = job.data as {
//     allUrlsToUpload: any;
//     screenShotsToUpload: IScreenShotBuffersToUpload;
//     metadataToUpload: string;
//   };
//   console.log('job started');
//   done();
//   // const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });
//   // job.progress(0);

//   // console.log()

//   // const xxx = screenShotsToUpload.screenshotImageUrl.replace('data:image/png;base64,', '');
//   // const buf = Buffer.from(xxx, 'base64');

//   // const screenshotBlob = screenshotImageBuffer && new NFTBlob([screenshotImageBuffer]);
//   // console.log(screenshotBlob);
//   // const screenshotCid = screenshotBlob && (await client.storeBlob(screenshotBlob));
//   // job.progress(10);
//   // console.log('job in process', screenshotCid);

//   // const stampedScreenShotBlob = stampedImageBuffer && new NFTBlob([stampedImageBuffer]);
//   // const stampedScreenShotCid =
//   //   stampedScreenShotBlob && (await client.storeBlob(stampedScreenShotBlob));

//   // job.progress(20);
//   // console.log('job in process', stampedScreenShotCid);

//   // transcode image asynchronously and report progress

//   console.log('do some stuff');

//   // return Promise.resolve(';jh;kh;kjh');

//   // call done when finished
//   // done();

//   // // or give an error if error
//   // done(new Error('error transcoding'));

//   // // or pass it a result
//   // done(null, { width: 1280, height: 720 /* etc... */ });

//   // // If the job throws an unhandled exception it is also handled correctly
//   // throw new Error('some unexpected error');
// });
