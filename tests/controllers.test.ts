import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import { Server } from 'http';
import dotenv from 'dotenv';
import startServer from '../src/server';

dotenv.config({ path: process.env.PWD + '/config.env' });

chai.use(chaiHttp);
describe('testing routes', async () => {
  let server: Server;

  before((done) => {
    if (!process.env.DEFAULT_HTTP_TEST_PORT)
      throw new Error(`default test port: ${process.env.DEFAULT_HTTP_PORT}`);

    startServer(process.env.DEFAULT_HTTP_TEST_PORT).then((newServer) => {
      server = newServer;
      done();
    });
  });

  after((done) => {
    server.close();
    done();
  });

  describe('testing GET /', () => {
    it('test 1', (done) => {
      chai
        .request(server)
        .get('/')
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.status).to.equal(200);
          expect(res.ok).to.true;
          expect(res.text).to.contain('<html>');
          expect(res.text).to.contain('submit');
          done();
        });
    });
  });
});
