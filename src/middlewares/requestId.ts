import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const requestId = (request: Request, response: Response, next: NextFunction) => {
  console.log('run my middle');
  const prevId = request.get('X-Request-Id');
  const newId = prevId === undefined ? uuidv4() : prevId;
  console.log(newId);
  response.set('X-Request-Id', newId);

  request['id'] = newId;
  next();
};
