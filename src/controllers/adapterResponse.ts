import { Request, Response } from 'express';

export const adapterResponse = async (request: Request, response: Response) => {
  try {
    //TODO: wrtie controller logic
    response.status(200).json({});
  } catch (error) {}
};
