import { Request, Response } from 'express';
import { screenshotWithPuppeteer } from '../helpers';

export const getScreenShot = async (request: Request, response: Response) => {
  try {
    return screenshotWithPuppeteer(request, response);
  } catch (error) {
    console.log(`controller error:  ${error}`);
    if (error instanceof Error) {
      return response.status(502).json({ error: error.message });
    }
    response.status(502).json({ error: `Unknown error: ${error}` });
  }
};
// 