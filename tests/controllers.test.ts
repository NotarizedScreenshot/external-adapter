import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import { Server } from 'http';
import dotenv from 'dotenv';
import { startServer } from '../src/index';
// import startServer from '../src/server';
// Had to use addtional export of start server function
// as if use direct import from src/server.ts get ab error:
// TypeError: (0 , server_1.default) is not a function

dotenv.config({ path: process.env.PWD + '/config.env' });

chai.use(chaiHttp);
describe('testing routes', async () => {
  let server: Server;

  before((done) => {
    if (!process.env.DEFAULT_HTTP_TEST_PORT)
      throw new Error(`default test port: ${process.env.DEFAULT_HTTP_TEST_PORT}`);

    server = startServer(process.env.DEFAULT_HTTP_TEST_PORT);
    done();
  });

  after((done) => {
    server.close();
    done();
  });

  describe('testing GET /', () => {
    it('get index page html', (done) => {
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

  describe('testing GET /previewData', () => {
    //TODO: tests a incorrect, puppeteer requests are to be stubed
    it('without tweetId in query', () => {
      chai
        .request(server)
        .get('/previewData')
        .end((err, res) => {
          expect(res.ok).to.be.false;
          expect(res.status).to.equal(422);
          const json = JSON.parse(res.text);
          expect(json.error).to.equal('invalid tweet id');
        });
    });
    it('invalid tweet id in query', () => {
      chai
        .request(server)
        .get('/previewData?tweetId=123a124')
        .end((err, res) => {
          expect(res.ok).to.be.false;
          expect(res.status).to.equal(422);
          const json = JSON.parse(res.text);
          expect(json.error).to.equal('invalid tweet id');
        });

      chai
        .request(server)
        .get('/previewData?tweetId=-123123')
        .end((err, res) => {
          expect(res.ok).to.be.false;
          expect(res.status).to.equal(422);
          const json = JSON.parse(res.text);
          expect(json.error).to.equal('invalid tweet id');
        });
    });
    it('valid tweet id, unavailable tweet', (done) => {
      chai
        .request(server)
        .get('/previewData?tweetId=123123')
        .end((err, res) => {
          expect(res.ok).to.be.true;
          expect(res.status).to.equal(200);
          const { imageUrl, tweetdata, metadata } = JSON.parse(res.text);

          expect(!!imageUrl).to.be.true;
          expect(!!tweetdata).to.be.true;
          expect(metadata).to.be.string;
          done();
        });
    });
    it('valid tweet id, available tweet', (done) => {
      chai
        .request(server)
        .get('/previewData?tweetId=1639773626709712896')
        .end((err, res) => {
          expect(res.ok).to.be.true;
          expect(res.status).to.equal(200);
          const { imageUrl, tweetdata, metadata } = JSON.parse(res.text);

          expect(!!imageUrl).to.be.true;
          expect(!!tweetdata).to.be.true;
          expect(metadata).to.be.string;
          done();
        });
    });
  });

  describe('testing POST /adapter_response', () => {
    //TODO: write tests
    it('empty request body', (done) => {
      chai
        .request(server)
        .post('/adapter_response.json')
        .end((err, res) => {
          expect(res.ok).to.be.false;
          done();
        });
    });
    it('unknown tweet id', (done) => {
      chai
        .request(server)
        .post('/adapter_response.json')
        .send({ url: '1234566' })
        .end((err, res) => {
          expect(res.ok).to.be.false;
          done();
        });
    });
  });
});
