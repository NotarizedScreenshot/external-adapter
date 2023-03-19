import fs from 'fs/promises';
import { Request, Response } from 'express';
import { isValidBigInt, tweetDataPathFromTweetId } from '../helpers';
import path from 'path';
import { processPWD } from '../prestart';

export const getTweetData = async (request: Request, response: Response) => {
  console.log('run getTweetData', new Date().toString());
  try {
    const { tweetId } = request.query as { tweetId: string };

    if (!isValidBigInt(tweetId)) {
      console.log('error: invalid tweet id');
      return response.status(422).json({ error: 'invalid tweet id' });
    }

    const tweetResponseDataPath = path.resolve(
      processPWD,
      'data',
      tweetDataPathFromTweetId(tweetId),
    );

    const tweetRawDataString = await fs.readFile(tweetResponseDataPath, 'utf-8');
    const tweetRawData = JSON.parse(tweetRawDataString);

    response.status(200).json(tweetRawData);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        response.status(422).json({ error: error.message });
        return;
      }
      console.log('error', error);
      return response.status(502).json({ error: error.message });
    }
    console.log('error', error);
    response.status(502).json({ error: `Unknown error ${error}` });
  }
};
