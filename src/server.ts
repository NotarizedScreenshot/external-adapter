import express, { Application } from 'express';
import router from './routes';
import morgan from 'morgan';
import { preStartJobs } from './prestart';
import { Server } from 'http';
import { Server as SocketServer } from 'socket.io';

import { uploadQueue } from './queue';

export const server: Application = express();
async function startExpressInstance(port: string): Promise<Server> {
  server.use(express.json());
  server.use(express.static('public', { index: false }));
  server.use(morgan('dev'));
  server.use('/', router);

  await preStartJobs(server);

  const httpServer = server.listen(port, () => {
    console.log('server started on port', port);
  });
  const io = new SocketServer(httpServer);

  uploadQueue.on('completed', async (job) => {
    console.log('completed');
    const data = await job.finished();
    io.emit('uploadComplete', JSON.stringify(data));
  });

  uploadQueue.on('progress', (job, progress) => {
    console.log(`upload job progress: ${progress}`);
    io.emit('uploadProgress', progress);
  });

  uploadQueue.on('error', (error) => {
    console.log('upload error', error);
  });

  uploadQueue.on('failed', (job, error) => {
    console.log('failed', error);
  });

  io.on('connection', (socket) => {
    io.emit('connectMsg', 'connected');
  });

  return httpServer;
}

export default startExpressInstance;
