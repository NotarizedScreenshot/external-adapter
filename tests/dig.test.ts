import chai, { expect } from 'chai';
import dotenv from 'dotenv';
import puppeteer, { Browser, HTTPResponse } from 'puppeteer';
import { spawn } from 'child_process';
import { getDnsInfo } from '../src/helpers';

dotenv.config({ path: process.env.PWD + '/config.env' });

//chai.use(chaiHttp);
describe('testing puppeteer', async () => {
  let browser: Browser;

  before(async (done) => {
    done()
  });

  after((done) => {
    done();
  });

  describe('dig is working', () => {
    
    it('dig is in system', (done) => {
      const process = spawn('dig');
      let hasError = false;
      process.on('error', ()=> hasError = true);
      process.stdout.on('error', ()=> hasError = true);
      process.stdout.on('end', () => {
        expect(hasError).to.equal(false)
      });
      done();
    });
  });

  describe('dig has results', () => {

    it('dig loads data', (done) => {
      const process = spawn('dig', ['google.com']);
      let hasError = false;
      let result = ''
      process.on('error', ()=> hasError = true);
      process.stdout.on('error', ()=> hasError = true);
      process.stdout.on('data', (chunk) => {
        result += chunk;
      });
      process.stdout.on('end', () => {
        expect(hasError).to.equal(false)
        expect(result).not.to.equal('')
      });
      done();
    });

    it('twitter is available', (done) => {
      const process = spawn('dig', ['twitter.com']);
      let hasError = false;
      let result = ''
      process.on('error', ()=> hasError = true);
      process.stdout.on('error', ()=> hasError = true);
      process.stdout.on('data', (chunk) => {
        result += chunk;
      });
      process.stdout.on('end', () => {
        expect(hasError).to.equal(false)
        expect(result).not.to.equal('')
        expect(result.length).to.be.above(100)
      });
      done();
    });

  });

});
