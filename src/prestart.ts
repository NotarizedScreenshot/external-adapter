import { Application } from 'express';
import path from 'path';
import fs from 'fs';

export const processPWD: string = process.env.PWD ? process.env.PWD : process.cwd();

export const preStartJobs = (sv: Application) => {
  //create tmp dirs
  if (process.env.PWD) process.env.PWD = process.cwd();

  if (!fs.existsSync(path.resolve(processPWD, 'data'))) {
    fs.mkdirSync(path.resolve(processPWD, 'data'));
  }

  //image processing

  //connect to storages here ...
};
