import fs from 'fs/promises';
import { Request, Response } from 'express';
import {
  isValidBigInt,
  metadataPathFromTweetId,
  metadataPathFromUrl,
  pngPathFromUrl,
  pngPathStampedFromUrl,
  processMetaData,
  trimUrl,
  tweetDataPathFromTweetId,
} from '../helpers';
import path from 'path';
import { processPWD } from '../prestart';
import { makeStampedImage } from '../helpers/images';

export const getStampedImage = async (request: Request, response: Response) => {
  try {
    const { sourceUrl, clientCode } = request.query as {
      sourceUrl: string;
      clientCode: string;
    };

    if (!sourceUrl) {
      console.log(`Error: inValid query: sourceUrl = ${sourceUrl}`);
      return response.status(422).json({ error: `inValid query: sourceUrl = ${sourceUrl}` });
    }

    const metadataPath = path.resolve(
      processPWD,
      'data',
      metadataPathFromUrl(trimUrl(sourceUrl), clientCode),
    );
    const screenshotImagePath = path.resolve(
      processPWD,
      'data',
      pngPathFromUrl(trimUrl(sourceUrl), clientCode),
    );

    if (!metadataPath || !screenshotImagePath) {
      console.log(`Error: inValid file paths ${metadataPath} ${screenshotImagePath}`);
      return response.status(422).json({ error: `files lost` });
    }

    const metamarkedImageBuffer = await makeStampedImage(screenshotImagePath, metadataPath);
    const stampedFilePath = path.resolve(
      processPWD,
      'data',
      pngPathStampedFromUrl(trimUrl(sourceUrl), clientCode),
    );

    metamarkedImageBuffer && (await fs.writeFile(stampedFilePath, metamarkedImageBuffer));
    response.set('Content-Type', 'image/png');
    return response.status(200).send(metamarkedImageBuffer);
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
