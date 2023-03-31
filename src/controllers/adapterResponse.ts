import { Request, Response } from 'express';
import { metadataPathFromUrl, metadataToAttirbutes, pngPathFromUrl, trimUrl } from '../helpers';
import path from 'path';
import { processPWD } from '../prestart';
import fs from 'fs/promises';
import { NFTStorage, Blob as NFTBlob } from 'nft.storage';
import enchex from 'crypto-js/enc-hex';
import sha256 from 'crypto-js/sha256';
import CryptoJS from 'crypto-js';

export const adapterResponse = async (request: Request, response: Response) => {
  try {
    const requestUrl = request.body.data.url;
    const metadataPath = path.resolve(
      processPWD,
      'data',
      metadataPathFromUrl(trimUrl(requestUrl), ''),
    );
    const screenshotPath = path.resolve(
      processPWD,
      'data',
      pngPathFromUrl(trimUrl(requestUrl), ''),
    );

    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    const screenshotBuffer = await fs.readFile(screenshotPath);

    const trustedSha256sum = enchex.stringify(
      // @ts-ignore
      sha256(CryptoJS.lib.WordArray.create(screenshotBuffer)),
    );

    const screenshotBlob = new NFTBlob([screenshotBuffer]);

    const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });
    const screenshotCid = await client.storeBlob(screenshotBlob);

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

    const metadataBlob = new NFTBlob([
      JSON.stringify({
        name,
        image,
        description,
        ts,
        time,
        url: requestUrl,
        attributes: metadataToAttirbutes(metadata),
      }),
    ]);

    const metadataCid = await client.storeBlob(metadataBlob);
    const data = {
      data: {
        url: requestUrl,
        sha256sum: trustedSha256sum,
        cid: screenshotCid,
        metadataCid: metadataCid,
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
