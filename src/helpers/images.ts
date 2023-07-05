import path from 'path';
import { createCanvas, loadImage } from 'canvas';

import { processPWD } from '../prestart';
import {
  META_STAMP_COLOR,
  META_STAMP_FONT,
  WATERMARK_DEFAULT_HEIGHT,
  WATERMARK_DEFAULT_WIDTH,
  WATERMARK_IMAGE_PATH,
} from '../config';

export const makeStampedImage = async (srcImgPath: string | Buffer | null) => {
  try {
    if (!srcImgPath) return null;
    const screenshotImage = await loadImage(srcImgPath);

    const canvas = createCanvas(screenshotImage.width, screenshotImage.height);
    const ctx = canvas.getContext('2d');
    ctx.font = META_STAMP_FONT;
    ctx.fillStyle = META_STAMP_COLOR;

    const watermarkImage = await loadImage(
      path.resolve(processPWD, 'public', WATERMARK_IMAGE_PATH),
    );

    ctx.drawImage(screenshotImage, 0, 0);
    ctx.drawImage(
      watermarkImage,
      screenshotImage.width - WATERMARK_DEFAULT_WIDTH,
      0,
      WATERMARK_DEFAULT_WIDTH,
      WATERMARK_DEFAULT_HEIGHT,
    );

    return canvas.toBuffer('image/png');
  } catch (error: any) {
    console.log('makeStampedImage error: ', error.message);
    return null;
  }
};

export const makeBufferFromBase64ImageUrl = (imgageUrl: string | null): Buffer | null => {
  if (!imgageUrl) return null;
  const clearUrl = imgageUrl.includes('data:image/png;base64,')
    ? imgageUrl.replace('data:image/png;base64,', '')
    : imgageUrl;
  return Buffer.from(clearUrl, 'base64');
};

export const saveStampedImage = () => {};
