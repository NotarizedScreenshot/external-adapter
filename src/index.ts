import dotenv from 'dotenv';
import startExpressInstance from './server';
import { Server as SocketServer } from 'socket.io';

dotenv.config({ path: process.env.PWD + '/config.env' });

if (!process.env.DEFAULT_HTTP_PORT) {
  throw new Error(`default port: ${process.env.DEFAULT_HTTP_PORT}`);
}
export const server = startExpressInstance(process.env.DEFAULT_HTTP_PORT);

export const socketServer = new SocketServer(server);
