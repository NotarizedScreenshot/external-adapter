import dotenv from 'dotenv';
import startExpressInstance from './server';
import { Server as SocketServer } from 'socket.io';

dotenv.config({ path: process.env.PWD + '/config.env' });

if (!process.env.DEFAULT_HTTP_PORT) {
  throw new Error(`default port: ${process.env.DEFAULT_HTTP_PORT}`);
}

export const startServer = startExpressInstance;
// Had to use addtional export of start server function
// as if use direct import from src/server.ts get ab error:
// TypeError: (0 , server_1.default) is not a function

export const server = startExpressInstance(process.env.DEFAULT_HTTP_PORT);

export const io = new SocketServer(server);

export const getSocketServer = () => io;
io.on('connection', (socket) => {
  socket.on('disconnect', () => {
    console.log(`socket disconnected, socket id: ${socket.id}`);
  });
  socket.emit('connected', socket.id);

  socket.on('userIdSaved', (userId) => {
    console.log(`saved userId: ${userId} for socket id: ${socket.id}`);
    socket.userId = userId;
  });
});
