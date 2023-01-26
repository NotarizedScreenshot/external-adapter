const fs = require('fs/promises');
const images = require('images');
const puppeteer = require('puppeteer');
const axios = require('axios');
const sha256 = require('crypto-js/sha256');
const svgRender = require('svg-render');
const enchex = require('crypto-js/enc-hex');
const CryptoJS = require('crypto-js');
const {NFTStorage, Blob} = require('nft.storage');

const { getBlobHeaders, objectToAttributes } = require('../helpers/index.cjs');
const watermark = require('../assets/watermark.js');

const NFT_STORAGE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweDY3Y2NmMWU0OEU4NWViNzVFQzUzRmEzODU2NzZGOEVEM0Q2OWYxOWMiLCJpc3MiOiJuZnQtc3RvcmFnZSIsImlhdCI6MTY1NzcxMDM1NDA0OSwibmFtZSI6Im15a2V5In0.uem5KZz7-dLM4cgMoYgiBj9wwn4RV7hvhbvAtmrriQI';
const client = new NFTStorage({token: NFT_STORAGE_TOKEN});


const getIndexPage = (request, response) => {
  fs.readFile('src/assets/index.html', 'utf-8').then((data) => {
    response.set('Content-Type', 'text/html');
    return response.status(200).send(data)

  }).catch((error) => {
    response.status(502).send(error)
  });
};

const stampImage = (request, response) => {
  const image = images('test.png');
  const watermarkImage = images('stamp.png');
  watermarkImage.resize(818, 1000);
  const newImage = image.draw(watermarkImage, (1000 - 818) / 2, 0);
  const newImageBuffer = newImage.encode("png");
  response.set('Content-Type', 'image/png');
  return response.status(200).send(newImageBuffer);
}

const makeScreenShot = async (request, response) => {
  const { url } = request.body;

  const browser = await puppeteer.launch();
  console.log(await browser.userAgent());
  console.log(request.headers);

  const page = await browser.newPage();
  await page.setViewport({
    width: 1000,
    height: 1000,
    deviceScaleFactor: 1,
  });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
  await page.goto(url, { waitUntil: 'networkidle0' });
  const file = await page.screenshot({ path: 'test.png' });
  response.set('Content-Type', 'image/png');
  return response.status(200).send(file);

};

const getProxy = (request, response, next) => {
  try {
    console.log('get proxy request test');
    let url = request.url.split("/proxy/?")[1];
    let headers = request.headers; //don't need
    return axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer', // important
    }).then((axiosresponse) => {
      let axiosHeaders = axiosresponse.headers;
      response.set(axiosresponse.headers);
      response.status(axiosresponse.status).send(axiosresponse.data);
      return axiosresponse;
    }).catch((error) => {
      next(error);
    })
  } catch(error) {
    next(error);
  }
}

const getAdapterResponseJSON = (request, response, next) => {
  try {
    console.log(request.body);
    let promiseGetBlobHeaders = getBlobHeaders(request.body.data.url).then((blobHeaders) => {
      let trustedSha256sum =  enchex.stringify(sha256( CryptoJS.lib.WordArray.create(blobHeaders.blob)));
      console.log("trustedSha256sum", trustedSha256sum);

      return {
        blob: blobHeaders.blob,
        headers: blobHeaders.headers,
        trustedSha256sum
      }

    });

    let promisePutToStorage = promiseGetBlobHeaders.then(async (blobHeaderstTustedSha256sum)=>{

      
      let blobImage = images(blobHeaderstTustedSha256sum.blob);

      let height = Math.min(blobImage.height(), blobImage.width());

      //345x422 
      const watermarkBuffer = await svgRender({
        buffer: Buffer.from(watermark, 'base64'),
        height: height
      });
      
      //let watermarkBuffer = Buffer.from(watermark, 'base64');
      let watermarkImage = images(watermarkBuffer);

      let left = (blobImage.width() - watermarkImage.width())/2;
      
      let newImage = blobImage.draw(watermarkImage, left, 0);
      let newImageBuffer = newImage.encode("png");
      
      let blob = new Blob([newImageBuffer]);
      const cid = await client.storeBlob(blob);
      blobHeaderstTustedSha256sum.cid = cid;
      return blobHeaderstTustedSha256sum;
    });


    let promisePutMetadata = promisePutToStorage.then(async (result) => {
      let name = "Notarized Screenshot 0x" + result.trustedSha256sum;
      let image = "ipfs://" + result.cid;
      let ts = Date.now()
      let time = new Date(ts).toUTCString();
      let url = request.body.data.url;
      let description = name +
        " by QuantumOracle, result of verifying the image served at URL \n" +
        url +
        " at ts " + time + "\n" +
        " Check metadata fields for more details."
      let blob = new Blob(JSON.stringify({
        name,
        image,
        description,
        ts,
        time,
        url,
        attributes: objectToAttributes(result.headers),
      }));
      const metadataCid = await client.storeBlob(blob);
      result.metadataCid = metadataCid;
      return result;
    });

    promisePutMetadata.then((result) => {
      let json = {
        data: {
          url: request.body.data.url,
          sha256sum: BigInt("0x" + result.trustedSha256sum).toString(),
          cid: result.cid,
          metadataCid: result.metadataCid
        }
      }
      console.log(json);
      response.json(json);
    }).catch((error)=>{
      next(error);
    })
  } catch(error) {
    next(error);
  }

}

const controllers = { getIndexPage, stampImage, makeScreenShot, getProxy, getAdapterResponseJSON };

module.exports = controllers;
