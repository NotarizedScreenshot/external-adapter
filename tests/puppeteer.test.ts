import chai, { expect } from 'chai';
import dotenv from 'dotenv';
import puppeteer, { Browser, HTTPResponse } from 'puppeteer';

dotenv.config({ path: process.env.PWD + '/config.env' });

//chai.use(chaiHttp);
describe('testing puppeteer', async () => {
  let browser: Browser;

  before(async (done) => {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    done()
  });

  after((done) => {
    browser.close();
    done();
  });

  describe('testing Browser is on', () => {
    it('browser already launched', (done) => {
      expect(browser.isConnected).to.true;
      expect(browser.process).to.equal(null);
      
      done();
    });
  });

  describe('loading pages', () => {
    const page = await browser.newPage();
    it('empty page', async () => {
      expect(page.url()).to.equal('');  
      // expect(res.text).to.contain('<html>');
    });

    it('some page', async () => {
      const page = await browser.newPage();
      expect(page.url()).to.equal('');  
    });

    it('some page 2', async () => {
      await page.goto('https://developer.mozilla.org/', { waitUntil: 'networkidle0' });
      expect(page.url()).to.equal('https://developer.mozilla.org/');  
    });

    it('twitter is accessible', async () => {
      await page.goto('https://twitter.com/', { waitUntil: 'networkidle0' });
      expect(page.url()).to.equal('https://twitter.com/');  
    });

  });

});
