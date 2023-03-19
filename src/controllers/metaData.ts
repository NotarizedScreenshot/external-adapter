import fs from 'fs/promises';
import { Request, Response } from 'express';
import {
  isValidBigInt,
  metadataPathFromTweetId,
  pngPathFromTweetId,
  pngPathStampedFromTweetId,
  processMetaData,
  tweetDataPathFromTweetId,
} from '../helpers';
import path from 'path';

import { processPWD } from '../prestart';
import { makeStampedImage } from '../helpers/images';

export const getMetaData = async (request: Request, response: Response) => {
  try {
    const { tweetId } = request.query as { tweetId: string };
    if (!isValidBigInt(tweetId)) {
      console.log('error: invalid tweet id');
      return response.status(422).json({ error: 'invalid tweet id' });
    }
    const metadataPath = path.resolve(processPWD, 'data', metadataPathFromTweetId(tweetId));
    const metadata = processMetaData(await fs.readFile(metadataPath, 'utf-8'));

    //MAKE STAMPED SCREENSHOT HERE TO SHORTEN ADAPTER_RESPONSE PROCESSING TIME (SHORT TIMEOUT) -- START
    const screenshotPath = path.resolve(processPWD, 'data', pngPathFromTweetId(tweetId));
    const watermarkedImageBuffer = await makeStampedImage(screenshotPath, metadataPath);
    const watermarkedImagePath = path.resolve(
      processPWD,
      'data',
      pngPathStampedFromTweetId(tweetId),
    );
    if (!!watermarkedImageBuffer) {
      await fs.writeFile(watermarkedImagePath, watermarkedImageBuffer);
    }
    //MAKE STAMPED SCREENSHOT HERE TO SHORTEN ADAPTER_RESPONSE PROCESSING TIME (SHORT TIMEOUT) -- END
    response.status(200).json(metadata);
  } catch (error) {
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
