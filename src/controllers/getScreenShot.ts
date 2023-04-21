import { Request, Response } from 'express';
import { screenshotWithPuppeteer } from '../helpers';

export const getScreenShot = async (request: Request, response: Response) => {
  try {
    return screenshotWithPuppeteer(request, response);
  } catch (error: any) {
    response.status(502).json({ error: error.message });
  }
};
