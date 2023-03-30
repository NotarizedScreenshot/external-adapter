import { Request, Response } from 'express';
import { isValidUint64, makeTweetUrlWithId } from '../helpers';
import path from 'path';

export const getScreenShot = async (request: Request, response: Response) => {
  try {
    const { tweetId } = request.query as {
      tweetId: string;
    };
    console.log('tweetId', tweetId);
    console.log('tweetId', isValidUint64(tweetId));
    if (!isValidUint64(tweetId)) {
      console.log('invalid');
      return response.status(422).json({ error: 'invalid tweet id' });
    }
    console.log('valid');
    const tweetUrl = makeTweetUrlWithId(tweetId);

    //TODO: write controller logic
    const imageUrl: string = 'imageUrl';
    const metaData: string = 'metaData';
    const tweetData: string = 'tweetData';

    response.status(200).send({ imageUrl, metaData, tweetData });
  } catch (error) {
    console.log(`controller error:  ${error}`);
    if (error instanceof Error) {
      return response.status(502).json({ error: error.message });
    }
    response.status(502).json({ error: `Unknown error: ${error}` });
  }
};
