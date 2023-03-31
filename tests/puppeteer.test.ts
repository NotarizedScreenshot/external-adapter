import chai, { expect } from 'chai';
import dotenv from 'dotenv';
import puppeteer, { Browser, HTTPResponse } from 'puppeteer';

dotenv.config({ path: process.env.PWD + '/config.env' });

//chai.use(chaiHttp);
describe('testing puppeteer', async () => {
  let browser: Browser;

  before((done) => {
    (async () => {
      browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      done()
    })();
  });

  after((done) => {
    browser.close();
    done();
  });

  describe('testing Browser is on', () => {
    it('browser already launched', (done) => {
      expect(browser.isConnected()).to.true;
      expect(browser.process()).not.to.equal(null);
      
      done();
    });
  });

  describe('loading pages', async () => {
    
    it('empty page', async () => {
      const page = await browser.newPage();
      expect(page.url()).to.equal('about:blank');  
      // expect(res.text).to.contain('<html>');
    });

    it('not existing url page', async () => {
      const page = await browser.newPage();
      const p = await page.goto('https://frrfgrtgtrgtg.rtgtg/', { waitUntil: 'networkidle0' }).catch(e => {});
      expect(p).to.equal(undefined)

      // expect ((async () => {
      //   const p = await page.goto('https://frrfgrtgtrgtg.rtgtg/', { waitUntil: 'networkidle0' }).catch(e => { throw (new Error() )});
      // })).to.throw()
      
    });

    it('some page 2', async () => {
      const page = await browser.newPage();
      await page.goto('https://developer.mozilla.org/', { waitUntil: 'networkidle0' });
      expect(page.url()).to.have.string('https://developer.mozilla.org/');  
    });

    it('twitter is accessible', async () => {
      const page = await browser.newPage();
      await page.goto('https://twitter.com/', { waitUntil: 'networkidle0' });
      expect(page.url()).to.have.string('https://twitter.com/');  
    });

  });

});
