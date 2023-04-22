import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import { getStampMetaString } from '../helpers';

import { IMetadata } from 'types';
import { processPWD } from '../prestart';
import {
  META_STAMP_CANVAS_DEFAULT_HEIGHT,
  META_STAMP_CANVAS_DEFAULT_WIDTH,
  META_STAMP_COLOR,
  META_STAMP_FONT,
  WATERMARK_IMAGE_PATH,
} from '../config';

export const makeStampedImage = async (srcImgPath: string | Buffer, metaDataString: string) => {
  try {
    const canvas = createCanvas(META_STAMP_CANVAS_DEFAULT_WIDTH, META_STAMP_CANVAS_DEFAULT_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.font = META_STAMP_FONT;
    ctx.fillStyle = META_STAMP_COLOR;
    const ctxFillTextX = 10;
    const ctxFillTextY = 20;

    const screenshotImage = await loadImage(srcImgPath);
    const watermarkImage = await loadImage(
      path.resolve(processPWD, 'public', WATERMARK_IMAGE_PATH),
    );
    const metadata = JSON.parse(metaDataString) as IMetadata;

    ctx.drawImage(
      screenshotImage,
      0,
      0,
      META_STAMP_CANVAS_DEFAULT_WIDTH,
      META_STAMP_CANVAS_DEFAULT_HEIGHT,
    );
    ctx.drawImage(
      watermarkImage,
      0,
      0,
      META_STAMP_CANVAS_DEFAULT_WIDTH,
      META_STAMP_CANVAS_DEFAULT_HEIGHT,
    );
    ctx.fillText(getStampMetaString(metadata), ctxFillTextX, ctxFillTextY);

    const canvasBuffer = canvas.toBuffer('image/png');

    return canvasBuffer;
  } catch (error: any) {
    console.log('makeStampedImage error: ', error.message);
    return null;
  }
};

export const makeBufferFromBase64ImageUrl = (imgageUrl: string): Buffer => {
  const clearUrl = imgageUrl.includes('data:image/png;base64,')
    ? imgageUrl.replace('data:image/png;base64,', '')
    : imgageUrl;
  return Buffer.from(clearUrl, 'base64');
};

export const saveStampedImage = () => {};
