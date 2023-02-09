import { Application } from "express";
import path from 'path';
import fs from 'fs/promises';
import fss from "fs";

export const processPWD : string = process.env.PWD ? process.env.PWD : process.cwd()

export const preStartJobs = async (sv: Application) => {
  //create tmp dirs
  if (process.env.PWD) process.env.PWD = process.cwd();

  if (!fss.existsSync(path.resolve(processPWD, 'data'))) {
    await fs.mkdir(path.resolve(processPWD, 'data'));
  }
  //connect to storages here ...
};

