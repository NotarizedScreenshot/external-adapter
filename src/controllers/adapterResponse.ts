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
    const requestUrl = request.body.data.url;
    const tweetId = request.body.data.url as string;
    const metadataCidPath = path.resolve(processPWD, 'data', metadataCidPathFromTweetId(tweetId));
    const metadataCid = JSON.parse(await fs.readFile(metadataCidPath, 'utf-8'))[tweetId];

    const trimmedUrl = trimUrl(requestUrl);

    const metadataResponse = await axios.get(`${IPFS_GATEWAY_BASE_URL}${metadataCid}`);
    const metadata = metadataResponse.data;
    const screenshotPath = path.resolve(processPWD, 'data', pngPathFromUrl(trimmedUrl));

    const screenshotBuffer = await fs.readFile(screenshotPath);

    const trustedSha256sum = getTrustedHashSum(screenshotBuffer);

    const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });
    const screenshotCid = await uploadToCAS(screenshotBuffer, client);

    const name = 'Notarized Screenshot 0x' + trustedSha256sum;
    const image = 'ipfs://' + screenshotCid;
    const ts = Date.now();
    const time = new Date(ts).toUTCString();

    //TODO: to be revised as a template string
    const description =
      name +
      ' by QuantumOracle, result of verifying the image served at URL \n' +
      requestUrl +
      ' at ts ' +
      time +
      '\n' +
      ' Check metadata fields for more details.';

    const nftMetadataCid = await uploadToCAS(
      JSON.stringify({
        name,
        image,
        description,
        ts,
        time,
        url: requestUrl,
        attributes: metadataToAttirbutes(JSON.parse(metadata.metadata)),
      }),
      client,
    );

    const data = {
      data: {
        url: requestUrl,
        sha256sum: trustedSha256sum,
        cid: screenshotCid,
        metadataCid: nftMetadataCid,
      },
    };
    response.status(200).json(data);
  } catch (error: any) {
    if (error.message.includes('ENOENT')) {
      response.status(422).json({ error: error.message });
      return;
    }
    return response.status(502).json({ error: error.message });
  }
};
