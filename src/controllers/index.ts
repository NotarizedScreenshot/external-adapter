import fs from "fs/promises";
import fss from "fs";
import { Request, Response } from "express";
import images from "images";
import puppeteer, { HTTPResponse } from "puppeteer";
import { createCanvas } from "canvas";
import { NFTStorage, Blob as NFTBlob } from 'nft.storage';
import enchex from 'crypto-js/enc-hex';
import sha256 from 'crypto-js/sha256';
import CryptoJS from 'crypto-js';

import {
  getHostWithoutWWW,
  getDomainInformation,
  getIncludeSubstringElementIndex,
  trimUrl,
} from "../helpers";
import path from 'path';

const VIEWPORT_DEFAULT_WIDTH = 1000;
const VIEWPORT_DEFAULT_HEIGHT = 1000;
const WATERMARK_DEFAULT_WIDTH = 818;
const WATERMARK_DEFAULT_HEIGHT = 1000;
const DEFAULT_USERAGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36";

const getIndexPage = (_: Request, response: Response) => {
  fs.readFile("public/index.html", "utf-8")
    .then((data) => {
      response.set("Content-Type", "text/html");
      return response.status(200).send(data);
    })
    .catch((error) => {
      response.status(502).send(error);
    });
};

const meta: { [id: string]: any }[] = [];

const getScreenShot = async (request: Request, response: Response) => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const url = trimUrl(request.body.url);

    page.on("response", async (response: HTTPResponse) => {
      const responseUrl = response.url();
      const trimmedResponseUrl = trimUrl(responseUrl);

      if (trimmedResponseUrl === url) {
        const headers = response.headers();
        const { ip, port } = response.remoteAddress();
        const host = getHostWithoutWWW(url);

        meta.splice(0, meta.length);
        meta.push({
          date: new Date(headers["date"]),
          contentType: headers["content-type"],
        });
        meta.push({ ip, port });

        const domainInfo = await getDomainInformation(host);
        const hostIndex = getIncludeSubstringElementIndex(domainInfo, host, 1);
        meta.push({ dns: domainInfo.slice(hostIndex!) });
      }
    });

    await page.setViewport({
      width: VIEWPORT_DEFAULT_WIDTH,
      height: VIEWPORT_DEFAULT_HEIGHT,
      deviceScaleFactor: 1,
    });

    await page.setUserAgent(DEFAULT_USERAGENT);

    await page.goto(url, { waitUntil: "networkidle0" });

    if (!fss.existsSync(path.resolve(process.env.PWD!, 'data'))) {
      await fs.mkdir(path.resolve(process.env.PWD!, 'data'));
    }

    const screenshotPath = `${path.resolve(process.env.PWD!, 'data', url.split("/").join("-"))}.png`;
    console.log(screenshotPath);

    const file = await page.screenshot({ path: screenshotPath });
    response.set("Content-Type", "image/png");
    return response.status(200).send(file);
  } catch (error) {
    response.status(502).send(error);
  }
};

const getStampedImage = async (request: Request, response: Response) => {

  const { path: filePath } = request.query as { path: string };
  const fileName = path.resolve(process.env.PWD!, 'data', trimUrl(filePath).split("/").join("-") + ".png");

  try {
    const canvas = createCanvas(800, 1000);
    const ctx = canvas.getContext("2d");
    ctx.font = "15px monospace";
    ctx.fillStyle = "red";
    const metaString = meta
      .flatMap((el, index) => {
        if (index < 2) {
          const keys = Object.keys(el);
          return `${keys[0]}: ${el[keys[0]]}; ${keys[1]}: ${el[keys[1]]};`;
        }
        return el.dns.flatMap((el: any[]) => {
          return el;
        });
      })
      .join("\n");
    ctx.fillText(metaString, 0, 20);

    const canvasBuffer = canvas.toBuffer();

    const screenshotImage = images(fileName);
    const watermarkImage = images("public/images/stamp.png");
    watermarkImage.resize(WATERMARK_DEFAULT_WIDTH, WATERMARK_DEFAULT_HEIGHT);

    const metaImage = images(canvasBuffer);

    const watermarkedScreenshotImage = screenshotImage.draw(
      watermarkImage,
      (VIEWPORT_DEFAULT_WIDTH - WATERMARK_DEFAULT_WIDTH) / 2,
      0
    );
    const metamarkedImage = watermarkedScreenshotImage.draw(metaImage, 0, 0);
    const metamarkedImageBuffer = metamarkedImage.encode("png");

    await fs.writeFile(path.resolve(process.env.PWD!, 'data', trimUrl(filePath).split("/").join("-") + "-stamped.png"), metamarkedImageBuffer);

    const markedImageBlob = new NFTBlob([metamarkedImageBuffer]);

    // @ts-ignore
    const trustedSha256sum = enchex.stringify(sha256( CryptoJS.lib.WordArray.create(metamarkedImageBuffer)));

    const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });

    const markedImageContentId = await client.storeBlob(markedImageBlob);

    console.log('markedImageContentId', markedImageContentId)



    const name = "Notarized Screenshot 0x" + trustedSha256sum;
    const image = "ipfs://" + markedImageContentId;
    // const image = "ipfs://" + 'markedImageContentId';;
    const ts = Date.now()
    const time = new Date(ts).toUTCString();
    const url = filePath;
    const description = name +
        " by QuantumOracle, result of verifying the image served at URL \n" +
        url +
        " at ts " + time + "\n" +
        " Check metadata fields for more details."

    const metadata = {
        name,
        image,
        description,
        ts,
        time,
        url,
        meta: metaString
        
    }

    // console.log(metadata);

    const metadataBlob = new NFTBlob([JSON.stringify(metadata)]);

    const metadataBlobContentId = await client.storeBlob(metadataBlob);

    console.log('metadataBlobContentId', metadataBlobContentId);

    const storedData = { 
      imageLink: `https://ipfs.io/ipfs/${markedImageContentId}`,
      jsonLink: `https://ipfs.io/ipfs/${metadataBlobContentId}`,
      openseaLink: `https://opensea.io/assets/matic/0xa567349bdd3d4f2c3e25f65745a020162c202ef2/${BigInt(
                '0x' + trustedSha256sum,
              ).toString(10)}`,  
    }

    await fs.writeFile(path.resolve(process.env.PWD!, 'data', trimUrl(filePath).split("/").join("-") + "-data.json"), JSON.stringify(storedData), "utf-8");

    response.set("Content-Type", "image/png");
    return response.status(200).send(metamarkedImageBuffer);
  } catch (error) {
    console.error("error", error);
    response.status(502).send(error);
  }
};

const getStoredData = async (request: Request, response: Response) => {
  try {
    const { path: filePath } = request.query as { path: string };
    const fileName = path.resolve(process.env.PWD!, 'data', trimUrl(filePath).split("/").join("-") + "-data.json");
    const data = await fs.readFile(fileName, 'utf-8');
    console.log(data)
    response.status(200).json(data);
  } catch (error) {
    response.status(502).send(error);
  }

}

export default {
  getIndexPage,
  getStampedImage,
  getScreenShot,
  getStoredData,
};
