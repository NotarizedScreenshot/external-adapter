import express, { Application } from 'express';
import { Server } from 'http';
import morgan from 'morgan';
import router from './routes';
import { preStartJobs } from './prestart';
import { requestId } from './middlewares';

export const server: Application = express();
function startExpressInstance(port: string): Server {
  server.use(express.json());
  server.use(express.static('public', { index: false }));
  server.use(morgan('dev'));
  server.use(requestId);
  server.use('/', router);

  preStartJobs(server);

  const httpServer = server.listen(port, () => {
    console.log('server started on port', port);
  });
  return httpServer;
}

export default startExpressInstance;
