import path from 'path';
import fs from 'fs/promises';
import fss from "fs";
import { Request, Response } from "express";
import images from "images";
import puppeteer, { HTTPResponse } from "puppeteer";
import { createCanvas } from "canvas";
import enchex from 'crypto-js/enc-hex';
import sha256 from 'crypto-js/sha256';
import CryptoJS from 'crypto-js';
import { NFTStorage, Blob as NFTBlob } from 'nft.storage';
import {
  getHostWithoutWWW,
  trimUrl,
  isValidUrl,
  getDnsInfo,
  metadataToAttirbutes,
  getStampMetaString,
} from "../helpers";

import { IMetadata } from 'types';

const VIEWPORT_DEFAULT_WIDTH = 1000;
const VIEWPORT_DEFAULT_HEIGHT = 1000;
const WATERMARK_DEFAULT_WIDTH = 818;
const WATERMARK_DEFAULT_HEIGHT = 1000;
const WATERMARK_IMAGE_PATH = "public/images/stamp.png";
const META_STAMP_FONT = "10px monospace";
const META_STAMP_COLOR = "red";
const META_STAMP_CANVAS_DEFAULT_WIDTH = 900;
const META_STAMP_CANVAS_DEFAULT_HEIGHT = 1000;
const DEFAULT_USERAGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36";

const getIndexPage = (_: Request, response: Response) => {
  try {
    response.set("Content-Type", "text/html");
    response.status(200).sendFile(path.resolve(process.env.PWD!, 'public/index.html'));
  } catch (error) {
    console.log(error);
    response.status(502).send(error);
  }
};

const meta: { [id: string]: any }[] = [];

const getScreenShot = async (request: Request, response: Response) => {
  try {
    if (!isValidUrl(request.body.url)) {
    console.log('error: invalid url')
    return response.status(422).json({ error: 'invalid url'});
  }
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const url = trimUrl(request.body.url);

    page.on("response", async (pupperTerresponse: HTTPResponse) => {
      try {
        const responseUrl = pupperTerresponse.url();
        const trimmedResponseUrl = trimUrl(responseUrl);

        if (trimmedResponseUrl === url) {
          const headers = pupperTerresponse.headers();
          const { ip } = pupperTerresponse.remoteAddress();
          const host = getHostWithoutWWW(url);
          const dns = (await getDnsInfo(host, ['+trace', 'any'])).split('\n');

          const meta: IMetadata = { headers, ip: ip || 'n/a', url: responseUrl, dns: { host, data: dns } };
          
          if (!fss.existsSync(path.resolve(process.env.PWD!, 'data'))) {
            await fs.mkdir(path.resolve(process.env.PWD!, 'data'));
          }

          const metadataPath = `${url.split("/").join("-")}.json`;
          await fs.writeFile(path.resolve(process.env.PWD!, 'data', metadataPath), JSON.stringify(meta));
        }
      } catch (error) {
        console.log(error);
        if (error instanceof Error) {
          meta.splice(0, meta.length);
          meta.push({ error: { ...error, message: error.message} });
        }        
      }
    });

    await page.setViewport({
      width: VIEWPORT_DEFAULT_WIDTH,
      height: VIEWPORT_DEFAULT_HEIGHT,
      deviceScaleFactor: 1,
    });

    await page.setUserAgent(DEFAULT_USERAGENT);

    await page.goto(url, { waitUntil: "networkidle0" });
    
    const screenshotPath = path.resolve(process.env.PWD!, 'data', `${url.split("/").join("-")}.png`);

    const screenshotImageBuffer = await page.screenshot({ path: screenshotPath });

    browser.close();
    response.set("Content-Type", "image/png");
    return response.status(200).send(screenshotImageBuffer);
  } catch (error) {
    console.log(error);
    if (error instanceof Error) {
      return response.status(502).json({ error: error.message});
    }
    response.status(502).json({ error: `Unknown error: ${error}`})
  }
};

const getStampedImage = async (request: Request, response: Response) => {
  try {
    const { sourceUrl } = request.query as { sourceUrl: string };
    if (!sourceUrl) {
      console.log(`Error: inValid query: sourceUrl = ${sourceUrl}`);
      return response.status(422).json({ error: `inValid query: sourceUrl = ${sourceUrl}`});
    }
    const metadataPath = path.resolve(process.env.PWD!, 'data', trimUrl(sourceUrl).split("/").join("-") + '.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as IMetadata;
    const screenshotImagePath = path.resolve(process.env.PWD!, 'data', trimUrl(sourceUrl).split("/").join("-") + ".png");

    const screenshotImage = images(screenshotImagePath);
    const watermarkImage = images(WATERMARK_IMAGE_PATH);

    const canvas = createCanvas(META_STAMP_CANVAS_DEFAULT_WIDTH, META_STAMP_CANVAS_DEFAULT_HEIGHT);
    const ctx = canvas.getContext("2d");
    ctx.font = META_STAMP_FONT;
    ctx.fillStyle = META_STAMP_COLOR;
    const ctxFillTextX = 10;
    const ctxFillTextY = 20;
    ctx.fillText(getStampMetaString(metadata), ctxFillTextX, ctxFillTextY);

    const canvasBuffer = canvas.toBuffer();
    
    watermarkImage.resize(WATERMARK_DEFAULT_WIDTH, WATERMARK_DEFAULT_HEIGHT);

    const metaImage = images(canvasBuffer);

    const watermarkedScreenshotImage = screenshotImage.draw(
      watermarkImage,
      (VIEWPORT_DEFAULT_WIDTH - WATERMARK_DEFAULT_WIDTH) / 2,
      0
    );

    const metamarkedImage = watermarkedScreenshotImage.draw(metaImage, 0, 0);
    const metamarkedImageBuffer = metamarkedImage.encode("png");

    const stampedFilePath = path.resolve(process.env.PWD!, 'data', trimUrl(sourceUrl).split("/").join("-") + "-stamp.png");

    await fs.writeFile(stampedFilePath, metamarkedImageBuffer);
    response.set("Content-Type", "image/png");
    return response.status(200).send(metamarkedImageBuffer);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        response.status(422).json({ error: error.message});
        return;
      }
      return response.status(502).json({ error: error.message});
    }
    response.status(502).json({ error: `Unknown error ${error}`});
  }
};

export const adapterResponseJSON = async (request: Request, response: Response) => {
  try {
    const requestUrl = request.body.data.url;
    const metadataPath = path.resolve(process.env.PWD!, 'data', trimUrl(requestUrl).split("/").join("-") + '.json');
    const screenshotPath = path.resolve(process.env.PWD!, 'data', trimUrl(requestUrl).split("/").join("-") + '-stamp.png');
       
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    const screenshotBuffer = await fs.readFile(screenshotPath);

    // @ts-ignore
    const trustedSha256sum =  enchex.stringify(sha256(CryptoJS.lib.WordArray.create(screenshotBuffer)));

    const screenshotBlob = new NFTBlob([screenshotBuffer]);

    const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });
    const screenshotCid = await client.storeBlob(screenshotBlob);

    const name = "Notarized Screenshot 0x" + trustedSha256sum;
    const image = "ipfs://" + screenshotCid;
    const ts = Date.now()
    const time = new Date(ts).toUTCString();
    const description = name +
          " by QuantumOracle, result of verifying the image served at URL \n" +
          requestUrl +
          " at ts " + time + "\n" +
          " Check metadata fields for more details."

    const metadataBlob = new NFTBlob([JSON.stringify({
      name,
      image,
      description,
      ts,
      time,
      url: requestUrl,
      attributes: metadataToAttirbutes(metadata),
    })]);

    const metadataCid = await client.storeBlob(metadataBlob);
    const data = {
      data: {
        url: requestUrl,
        sha256sum: trustedSha256sum,
        cid: screenshotCid,
        metadataCid: metadataCid,
      }
    }
    response.status(200).json(data);
  } catch (error) {
    console.log(error);
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        response.status(422).json({ error: error.message});
        return;
      }
      return response.status(502).json({ error: error.message});
    }
    response.status(502).json({ error: `Unknown error ${error}`});
  }
};

export default {
  getIndexPage,
  getStampedImage,
  getScreenShot,
  adapterResponseJSON,
};
