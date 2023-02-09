
import path from 'path';
import fs from 'fs/promises';
import images from "images";
import { createCanvas } from "canvas";
import {
  trimUrl,
  getStampMetaString
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


export const makeStampedImage = async  (srcImgPath: string, metaDataPath: string) => {

    const screenshotImage = images(srcImgPath);
    const watermarkImage = images(WATERMARK_IMAGE_PATH);
    const metadata = JSON.parse(await fs.readFile(metaDataPath, 'utf-8')) as IMetadata;

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

    //const stampedFilePath = path.resolve(processPWD, 'data', trimUrl(sourceUrl).split("/").join("-") + "-stamp.png");

    return metamarkedImageBuffer

}

export const saveStampedImage = () => {

}