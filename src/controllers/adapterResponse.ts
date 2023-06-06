import { Request, Response } from 'express';
import {
  getTrustedHashSum,
  metadataCidPathFromTweetId,
  metadataToAttirbutes,
  pngPathFromUrl,
  trimUrl,
} from '../helpers';
import path from 'path';
import { processPWD } from '../prestart';
import fs from 'fs/promises';
import axios from 'axios';
import { uploadToCAS } from '../helpers/nftStorage';
import { IPFS_GATEWAY_BASE_URL } from '../config';
import { NFTStorage } from 'nft.storage';
import { createDescription } from '../models';

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
    const tweetId = request.body.data.tweetId as string;
    console.log('tweet id: ', tweetId);

    const metadataCidPath = path.resolve(processPWD, 'data', metadataCidPathFromTweetId(tweetId));
    console.log('metadataCidPath:', metadataCidPath);
    const metadataCid = JSON.parse(await fs.readFile(metadataCidPath, 'utf-8'))[tweetId];
    console.log('metadataCid', metadataCid);

    console.log('metadata url:', `${IPFS_GATEWAY_BASE_URL}${metadataCid}`);

    const metadataResponse = await axios.get(`${IPFS_GATEWAY_BASE_URL}${metadataCid}`);
    const metadata = metadataResponse.data;

    const trustedSha256sum = getTrustedHashSum(String(metadata));

    const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });
    const screenshotCid = metadata.stampedScreenShotCid;

    const name = 'Notarized Screenshot 0x' + trustedSha256sum;
    const image = 'ipfs://' + screenshotCid;
    const ts = Date.now();
    const time = new Date(ts).toUTCString();

    const description = createDescription(tweetId, Date.now());

    const nftMetadataCid = await uploadToCAS(
      JSON.stringify({
        name,
        image,
        description,
        ts,
        time,
        tweetId,
        attributes: metadataToAttirbutes(JSON.parse(metadata.metadata)),
      }),
      client,
    );

    const data = {
      data: {
        cid: nftMetadataCid,
      },
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
