import { Request, Response } from 'express';
import path from 'path';

export const getIndexPage = (_: Request, response: Response) => {
  try {
    response.set('Content-Type', 'text/html');
    response.status(200).sendFile(path.resolve(process.env.PWD!, 'public/index.html'));
  } catch (error) {
    console.log(error);
    response.status(502).send(error);
  }
};
