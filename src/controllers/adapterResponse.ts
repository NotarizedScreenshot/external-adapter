import { Request, Response } from 'express';
import {
  metadataCidPathFromTweetId,
  metadataToAttirbutes,
  pngPathFromUrl,
  trimUrl,
} from '../helpers';
import path from 'path';
import { processPWD } from '../prestart';
import fs from 'fs/promises';
import enchex from 'crypto-js/enc-hex';
import sha256 from 'crypto-js/sha256';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { updloadTweetToCAS } from '../helpers/nftStorage';

export const adapterResponse = async (request: Request, response: Response) => {
  try {
    const requestUrl = request.body.data.url;
    const tweetId = request.body.data.url as string;
    const metadataCidPath = path.resolve(processPWD, 'data', metadataCidPathFromTweetId(tweetId));
    const metadataCid = JSON.parse(await fs.readFile(metadataCidPath, 'utf-8'))[tweetId];
    console.log('metadataCid', metadataCid);

    const trimmedUrl = trimUrl(requestUrl);

    const metadataResponse = await axios.get(`https://ipfs.io/ipfs/${metadataCid}`);
    const metadata = metadataResponse.data;    
    const screenshotPath = path.resolve(processPWD, 'data', pngPathFromUrl(trimmedUrl));

    const screenshotBuffer = await fs.readFile(screenshotPath);

    const trustedSha256sum = enchex.stringify(
      // @ts-ignore
      sha256(CryptoJS.lib.WordArray.create(screenshotBuffer)),
    );

    const screenshotCid = await updloadTweetToCAS(screenshotBuffer);

    const name = 'Notarized Screenshot 0x' + trustedSha256sum;
    const image = 'ipfs://' + screenshotCid;
    const ts = Date.now();
    const time = new Date(ts).toUTCString();
    const description =
      name +
      ' by QuantumOracle, result of verifying the image served at URL \n' +
      requestUrl +
      ' at ts ' +
      time +
      '\n' +
      ' Check metadata fields for more details.';

    const nftMmetadataCid = await updloadTweetToCAS(
      JSON.stringify({
        name,
        image,
        description,
        ts,
        time,
        url: requestUrl,
        attributes: metadataToAttirbutes(JSON.parse(metadata.metadata)),
      }),
    );

    const data = {
      data: {
        url: requestUrl,
        sha256sum: trustedSha256sum,
        cid: screenshotCid,
        metadataCid: nftMmetadataCid,
      },
    };
    response.status(200).json(data);
  } catch (error) {
    console.log(error);
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
