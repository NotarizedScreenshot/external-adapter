import path from 'path';
// import fs from 'fs/promises';
import { Request, Response } from 'express';
// import puppeteer, { HTTPResponse } from 'puppeteer';
// import {
//   getHostWithoutWWW,
//   trimUrl,
//   isValidUrl,
//   getDnsInfo,
//   pngPathFromUrl,
//   pngPathStampedFromUrl,
//   metadataPathFromUrl,
//   metadataPathFromTweetId,
//   isValidBigInt,
//   makeTweetUrlWithId,
//   pngPathFromTweetId,
//   tweetDataPathFromTweetId,
//   processMetaData,
// } from '../helpers';
// import { makeStampedImage } from '../helpers/images';

// import { IMetadata } from 'types';
// import { processPWD } from '../prestart';

import { adapterResponseJSON } from './adapterResponse';
import { getTweetData } from './tweetData';
import { getMetaData } from './metaData';
import { getStampedImage } from './stampsImage';
import { getScreenShot } from './screenShot';

// const VIEWPORT_DEFAULT_WIDTH = 1000;
// const VIEWPORT_DEFAULT_HEIGHT = 1000;

// const WATERMARK_DEFAULT_WIDTH = 818;
// const WATERMARK_DEFAULT_HEIGHT = 1000;
// const WATERMARK_IMAGE_PATH = path.resolve(processPWD, 'public/images/stamp_s.png');
// const META_STAMP_FONT = '10px monospace';
// const META_STAMP_COLOR = 'red';
// const META_STAMP_CANVAS_DEFAULT_WIDTH = 900;
// const META_STAMP_CANVAS_DEFAULT_HEIGHT = 1000;

// const DEFAULT_USERAGENT =
//   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';

const getIndexPage = (_: Request, response: Response) => {
  try {
    response.set('Content-Type', 'text/html');
    response.status(200).sendFile(path.resolve(process.env.PWD!, 'public/index.html'));
  } catch (error) {
    console.log(error);
    response.status(502).send(error);
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
