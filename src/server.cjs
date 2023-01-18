// import { text } from 'express';

const express = require('express');
const cookieParser = require('cookie-parser');
const sha256 = require('crypto-js/sha256');
const images = require("images");
const svgRender = require('svg-render');
const watermark = require('./assets/watermark.js');
const puppeteer = require('puppeteer');
const fs = require('fs/promises');


const enchex = require('crypto-js/enc-hex');
const CryptoJS = require('crypto-js');

const {NFTStorage, Blob} = require('nft.storage')

const NFT_STORAGE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweDY3Y2NmMWU0OEU4NWViNzVFQzUzRmEzODU2NzZGOEVEM0Q2OWYxOWMiLCJpc3MiOiJuZnQtc3RvcmFnZSIsImlhdCI6MTY1NzcxMDM1NDA0OSwibmFtZSI6Im15a2V5In0.uem5KZz7-dLM4cgMoYgiBj9wwn4RV7hvhbvAtmrriQI';
const client = new NFTStorage({token: NFT_STORAGE_TOKEN});
const axios = require('axios');

const server = express();
server.use(cookieParser());
server.use(express.static('public'));
server.use(express.json());

const JSONstrict = require('json-bigint')({strict: true});

JSON.parse = JSONstrict.parse;
JSON.stringify = JSONstrict.stringify;

function getBlobHeaders(url) {
  return axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer', // important
  }).then((response) => {
    return {
      blob: response.data,
      headers: response.headers
    }
  });

};

function objectToAttributes(object) {
  let attributes = [];
  for(const key of Object.keys(object)) {
    attributes.push({
      trait_type:key,
      value:object[key]
    })
  }
  return attributes;
}

server.get('/screen', (request, response, next) => {
  puppeteer.launch().then((browser) => {
    return browser.newPage();
  }).then(page => {
    page.goto('https://www.google.com/').then(() => {
      page.screenshot({ path: 'test.png' }).then((file) => {
        response.set('Content-Type', 'image/png')
        return response.status(200).send(file)
      });
    })
  })
  // return response.status(200).send('test');
})

server.get('/', (request, response) => {
  fs.readFile('src/assets/index.html', 'utf-8').then((data) => {
    response.set('Content-Type', 'text/html');
    return response.status(200).send(data)

  }).catch((error) => {
    response.status(502).send(error)
  });
})

server.post('/send', (request, response) => {
  const { url } = request.body;

  puppeteer.launch().then((browser) => {
    return browser.newPage();
  }).then(page => {
    page.goto(url).then(() => {
      page.screenshot({ path: 'test.png' }).then((file) => {
        response.set('Content-Type', 'image/png')
        return response.status(200).send(file)
      });
    })
  })

  // response.status(200).send(url)
})

server.get('/proxy/', (request, response, next) => {
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
});

server.post('/adapter_response.json', (request, response, next) => {
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

});



server.listen(9000, () => {
  console.log('Server started on port', 9000);
});
