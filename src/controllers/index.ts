import fs from "fs/promises";
import { Request, Response, NextFunction } from "express";
import images from "images";
import puppeteer, { HTTPResponse } from "puppeteer";
import axios from "axios";
import enchex from "crypto-js/enc-hex";
import sha256 from "crypto-js/sha256";
import svgRender from "svg-render";
import { NFTStorage, Blob, CIDString } from "nft.storage";
import { createCanvas } from "canvas";
import {
  getBlobHeaders,
  getClearHost,
  getDomainInformation,
  getIncludesSubstringElementIndex,
  objectToAttributes,
  trimUrl,
} from "../helpers";

const VIEWPORT_DEFAULT_WIDTH = 1000;
const VIEWPORT_DEFAULT_HEIGHT = 1000;
const WATERMARK_DEFAULT_WIDTH = 818;
const WATERMARK_DEFAULT_HEIGHT = 1000;
const DEFAULT_USERAGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36";

const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });

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
        const host = getClearHost(url);

        meta.splice(0, meta.length);
        meta.push({
          date: new Date(headers["date"]),
          contentType: headers["content-type"],
        });
        meta.push({ ip, port });

        const domainInfo = await getDomainInformation(host);
        const hostIndex = getIncludesSubstringElementIndex(domainInfo, host, 1);
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

    const path = `${url.split("/").join("-")}.png`;
    console.log("path", path);

    const file = await page.screenshot({ path });
    response.set("Content-Type", "image/png");
    return response.status(200).send(file);
  } catch (error) {
    response.status(502).send(error);
  }
};

const getStampedImage = (request: Request, response: Response) => {
  const { file } = request.query as { file: string };
  const fileName = trimUrl(file).split("/").join("-") + ".png";
  try {
    const canvas = createCanvas(800, 1000);
    const ctx = canvas.getContext("2d");
    ctx.font = "15px monospace";
    ctx.fillStyle = "red";
    const metaText = meta
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
    ctx.fillText(metaText, 0, 20);

    const buf = canvas.toBuffer();

    const image = images(fileName);
    const watermarkImage = images("stamp.png");
    const metaImage = images(buf);
    watermarkImage.resize(WATERMARK_DEFAULT_WIDTH, WATERMARK_DEFAULT_HEIGHT);
    const newImage = image.draw(
      watermarkImage,
      (VIEWPORT_DEFAULT_WIDTH - WATERMARK_DEFAULT_WIDTH) / 2,
      0
    );
    const anotherImage = newImage.draw(metaImage, 0, 0);
    const anotherImageBuffer = anotherImage.encode("png");

    response.set("Content-Type", "image/png");
    return response.status(200).send(anotherImageBuffer);
  } catch (error) {
    console.error("error", error);
    response.status(502).send(error);
  }
};

const getMeta = (request: Request, response: Response) => {
  response.status(200).json(meta);
};

const getProxy = (request: Request, response: Response, next: NextFunction) => {
  try {
    console.log("get proxy request test");
    const url = request.url.split("/proxy/?")[1];
    return axios({
      url,
      method: "GET",
      responseType: "arraybuffer", // important
    })
      .then((axiosresponse) => {
        response.set(axiosresponse.headers);
        response.status(axiosresponse.status).send(axiosresponse.data);
        return axiosresponse;
      })
      .catch((error) => {
        next(error);
      });
  } catch (error) {
    next(error);
  }
};

const getAdapterResponseJSON = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  try {
    console.log(request.body);
    const promiseGetBlobHeaders: Promise<{
      blob: any;
      headers: any;
      trustedSha256sum: string;
      cid: CIDString | undefined;
      metadataCid: CIDString | undefined;
    }> = getBlobHeaders(request.body.data.url).then((blobHeaders) => {
      let trustedSha256sum = enchex.stringify(
        sha256(CryptoJS.lib.WordArray.create(blobHeaders.blob))
      );
      console.log("trustedSha256sum", trustedSha256sum);
      return {
        blob: blobHeaders.blob,
        headers: blobHeaders.headers,
        trustedSha256sum,
        cid: undefined,
        metadataCid: undefined,
      };
    });

    const promisePutToStorage = promiseGetBlobHeaders.then(
      async (blobHeaderstTustedSha256sum) => {
        const blobImage = images(blobHeaderstTustedSha256sum.blob);
        const height = Math.min(blobImage.height(), blobImage.width());
        //345x422
        const watermarkBuffer = await svgRender({
          buffer: images("test.png").encode("png"),
          height: height,
        });
        const watermarkImage = images(watermarkBuffer);
        const left = (blobImage.width() - watermarkImage.width()) / 2;

        const newImage = blobImage.draw(watermarkImage, left, 0);
        const newImageBuffer = newImage.encode("png");

        const blob = new Blob([newImageBuffer]);
        const cid = await client.storeBlob(blob);
        blobHeaderstTustedSha256sum.cid = cid;
        return blobHeaderstTustedSha256sum;
      }
    );

    let promisePutMetadata = promisePutToStorage.then(async (result) => {
      let name = "Notarized Screenshot 0x" + result.trustedSha256sum;
      let image = "ipfs://" + result.cid;
      let ts = Date.now();
      let time = new Date(ts).toUTCString();
      let url = request.body.data.url;
      let description =
        name +
        " by QuantumOracle, result of verifying the image served at URL \n" +
        url +
        " at ts " +
        time +
        "\n" +
        " Check metadata fields for more details.";
      let blob = new Blob([
        JSON.stringify({
          name,
          image,
          description,
          ts,
          time,
          url,
          attributes: objectToAttributes(result.headers),
        }),
      ]);
      const metadataCid = await client.storeBlob(blob);
      result.metadataCid = metadataCid;
      return result;
    });

    promisePutMetadata
      .then((result) => {
        let json = {
          data: {
            url: request.body.data.url,
            sha256sum: BigInt("0x" + result.trustedSha256sum).toString(),
            cid: result.cid,
            metadataCid: result.metadataCid,
          },
        };
        console.log(json);
        response.json(json);
      })
      .catch((error) => {
        next(error);
      });
  } catch (error) {
    next(error);
  }
};

export default {
  getIndexPage,
  getStampedImage,
  getScreenShot,
  getProxy,
  getAdapterResponseJSON,
  getMeta,
};
