import path from 'path';
import { Request, Response } from "express";
import images from "images";
import puppeteer, { HTTPResponse } from "puppeteer";
import { createCanvas } from "canvas";
import {
  getHostWithoutWWW,
  getDomainInformation,
  getIncludeSubstringElementIndex,
  trimUrl,
  isValidUrl,
} from "../helpers";

const VIEWPORT_DEFAULT_WIDTH = 1000;
const VIEWPORT_DEFAULT_HEIGHT = 1000;
const WATERMARK_DEFAULT_WIDTH = 818;
const WATERMARK_DEFAULT_HEIGHT = 1000;
const DEFAULT_USERAGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36";

const getIndexPage = (_: Request, response: Response) => {
  try {
    response.set("Content-Type", "text/html");
    response.status(200).sendFile(path.resolve(process.env.PWD!, 'public/index.html'));
  } catch (error) {
    response.status(502).send(error);
  }
};

const meta: { [id: string]: any }[] = [];

const getScreenShot = async (request: Request, response: Response) => {
  try {
    if (!isValidUrl(request.body.url)) {
    return response.status(422).json({ error: 'inValid url'});
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
          const { ip, port } = pupperTerresponse.remoteAddress();
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
      } catch (error) {
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
    
    const path = `${url.split("/").join("-")}.png`;

    const file = await page.screenshot({ path });

    browser.close();
    response.set("Content-Type", "image/png");
    return response.status(200).send(file);
  } catch (error) {
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
      return response.status(422).json({ error: `inValid query: sourceUrl = ${sourceUrl}`});
    }
    if (!!meta[0].error) {
      return response.status(502).json({ error: 'can not get meta data'})
    }

    const fileName = trimUrl(sourceUrl).split("/").join("-") + ".png";

    const screenshotImage = images(fileName);
    const watermarkImage = images("public/images/stamp.png");

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
    
    watermarkImage.resize(WATERMARK_DEFAULT_WIDTH, WATERMARK_DEFAULT_HEIGHT);

    const metaImage = images(canvasBuffer);

    const watermarkedScreenshotImage = screenshotImage.draw(
      watermarkImage,
      (VIEWPORT_DEFAULT_WIDTH - WATERMARK_DEFAULT_WIDTH) / 2,
      0
    );
    const metamarkedImage = watermarkedScreenshotImage.draw(metaImage, 0, 0);
    const metamarkedImageBuffer = metamarkedImage.encode("png");

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
    response.status(502).json({ error: `Unknown error ${error}`})
  }
};

export default {
  getIndexPage,
  getStampedImage,
  getScreenShot,
};
