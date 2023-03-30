import express, { Application } from 'express';
import router from './routes';
import morgan from 'morgan';
import { preStartJobs } from './prestart';
import { Server } from 'http';

export const server: Application = express();
async function startExpressInstance(port: string): Promise<Server> {
  server.use(express.json());
  server.use(express.static('public', { index: false }));
  server.use(morgan('dev'));
  server.use('/', router);

  await preStartJobs(server);

  return server.listen(port, () => {
    console.log('server started on port', port);
  });
}

export default startExpressInstance;
