import express, { Application } from 'express';
import router from './routes';
import morgan from 'morgan';
import { preStartJobs } from './prestart';
import { Server } from 'http';
import { Server as SocketServer } from 'socket.io';

// import Queue from 'bull';

// import { imageQueue } from './queue';
import { uploadQueue } from './queue';

export const server: Application = express();
async function startExpressInstance(port: string): Promise<Server> {
  server.use(express.json());
  server.use(express.static('public', { index: false }));
  server.use(morgan('dev'));
  server.use('/', router);

  await preStartJobs(server);

  // const imageQueue = new Queue('image transcoding');
  // sendQueue.add({ msg: 'World' });

  // imageQueue.process(function (job, done) {
  //   console.log('job in process', job.data);
  //   // transcode image asynchronously and report progress
  //   job.progress(42);

  //   console.log('do some stuff');

  //   // call done when finished
  //   done();

  //   // or give an error if error
  //   done(new Error('error transcoding'));

  //   // or pass it a result
  //   done(null, { width: 1280, height: 720 /* etc... */ });

  //   // If the job throws an unhandled exception it is also handled correctly
  //   throw new Error('some unexpected error');
  // });

  // imageQueue.add({ msg: 'some msg' });
  // receiveQueue
  //   .add('test data')
  //   .then((data) => console.log('job data'))
  //   .catch((err) => console.log(err))
  //   .finally(() => console.log('finally'));

  // const job = await receiveQueue.add({ msg: 'some data' });

  const httpServer = server.listen(port, () => {
    console.log('server started on port', port);
  });
  const io = new SocketServer(httpServer);

  uploadQueue.on('completed', (job) => {
    console.log('completed');
  });


  // imageQueue.on('completed', async (job) => {
  //   console.log('finished');
  //   // console.log(await job.finished());
  //   const cid = await job.finished();
  //   io.emit('uploadComplete', `screetsohot cid: ${cid}`);
  // });

  // imageQueue.on('progress', async (job, progress) => {
  //   console.log('job progress');
  //   console.log(progress);
  // });

  io.on('connection', (socket) => {
    console.log('a user connected');
    // socket.on('chat message', (msg) => {
    io.emit('connectMsg', 'connected');
    // });
  });

  return httpServer;
}

export default startExpressInstance;
