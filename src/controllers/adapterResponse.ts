import { Request, Response } from 'express';
import {
  getTweetTimelineEntries,
  metadataCidPathFromTweetId,
  metadataToAttirbutes,
} from '../helpers';
import path from 'path';
import { processPWD } from '../prestart';
import fs from 'fs/promises';
import axios from 'axios';
import { uploadToCAS } from '../helpers/nftStorage';
import { IPFS_GATEWAY_BASE_URL } from '../config';
import { NFTStorage } from 'nft.storage';
import { createMoment, createNftDescription, createNftName, createTweetData } from '../models';
import { ITweetTimelineEntry } from '../types';

/**
 * Recieves http request from chainlink node
 * Http request contians of tweetId (still name url)
 * reads locally saved data file and gets cid of metadata saved in the ipfs
 * fetches metadata frim IPFS
 * reads locally saved screenshot file, makes trusted hashsum of it
 * composes metadat for NFT, than saves it to ipfse
 * sends back to Chainlink node a response with reqeusted tweetId, hashsum and screenshot and metadata cids.
 */

export const adapterResponse = async (request: Request, response: Response) => {
  try {
    console.log('adapter response POST, url:', request.url);
    console.log('request body: ', request.body);
    const tweetId = request.body.tweetId as string;
    const cid = request.body.cid as string;
    console.log('tweet id: ', tweetId, 'cid: ', cid);

    const metadataCidPath = path.resolve(processPWD, 'data', metadataCidPathFromTweetId(tweetId));
    console.log('metadataCidPath:', metadataCidPath);
    const metadataCid = JSON.parse(await fs.readFile(metadataCidPath, 'utf-8'))[tweetId];
    console.log('metadataCid', metadataCid);

    console.log('metadata url:', `${IPFS_GATEWAY_BASE_URL}${metadataCid}`);
    console.log('metadata url2:', `${IPFS_GATEWAY_BASE_URL}${cid}`);

    const metadataResponse = await axios.get(`${IPFS_GATEWAY_BASE_URL}${cid}`);
    console.log('metadataResponse', metadataResponse);
    const metadata = metadataResponse.data;
    console.log('metadata: ', metadata);
    console.log('tweetId !== metadata.tweetId', tweetId, metadata.tweetId, tweetId !== metadata.tweetId);

    if (tweetId !== metadata.tweetId)
      return response.status(422).json({
        error: `tweetId do not match, received: ${tweetId}, metadata tweetId: ${metadata.tweetId}`,
      });

    const data = {
      cid,
      tweetId,
    };

    console.log('response data: ', data);
    response.status(200).json(data);
  } catch (error: any) {
    if (error.message.includes('ENOENT')) {
      response.status(422).json({ error: error.message });
      return;
    }
    console.log(error);
    return response.status(502).json({ error: error.message });
  }
};
