import dotenv from 'dotenv';
import startExpressInstance from './server';

dotenv.config({ path: process.env.PWD + '/config.env' });

if (!process.env.DEFAULT_HTTP_PORT) {
  throw new Error(`default port: ${process.env.DEFAULT_HTTP_PORT}`);
}
startExpressInstance(process.env.DEFAULT_HTTP_PORT);
