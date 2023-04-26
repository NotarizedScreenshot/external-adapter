import { IGetScreenshotResponseData } from '../types';

export * from './puppeteerConfig';
export * from './constants';

export const screenshotResponseDataOrderedKeys: (keyof IGetScreenshotResponseData)[] = [
  'tweetdata',
  'metadata',
  'imageUrl',
];
