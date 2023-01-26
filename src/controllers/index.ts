import fs from 'fs/promises';
import * as fss from 'fs';
import { Request, Response, NextFunction } from 'express';
import images from 'images';
import puppeteer, { HTTPRequest, HTTPResponse } from 'puppeteer';
import axios from 'axios';
import enchex from 'crypto-js/enc-hex';
import sha256 from 'crypto-js/sha256';
import svgRender from 'svg-render';
import { getBlobHeaders, objectToAttributes } from '../helpers';
import { NFTStorage, Blob, CIDString } from 'nft.storage';

import { exec } from 'child_process';
import path from 'path';
import { URL } from 'url';

import { createCanvas } from 'canvas';


const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });

const getIndexPage = (_: Request, response: Response) => {
  fs.readFile('public/index.html', 'utf-8').then((data) => {
    response.set('Content-Type', 'text/html');
    return response.status(200).send(data)
  }).catch((error) => {
    response.status(502).send(error);
  });
};

const meta: { [id: string]: any}[] = [];

const makeScreenShot = async (request: Request, response: Response) => {
  
  try {
    const { url } = request.body;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    // exec(`dig ${url}`, (err, stdout, stderr) => {
    //   console.log(err);
    //   console.log(stdout);
    //   console.log(stderr);
    // })
    
    page.on('response', async (response: HTTPResponse) => {
      // console.log('response', await response.headers());
      const responseUrl = response.url();
      // console.log('responseUrl ', responseUrl, url);
      const trimmedResponseUrl = responseUrl[responseUrl.length - 1] === '/' ? responseUrl.slice(0, responseUrl.length - 1) : responseUrl;
      if (trimmedResponseUrl === url) {
        // console.log('response url', response.url());
        // console.log(response.headers());
        // console.log(response.remoteAddress());

        const headers = response.headers();

        // console.log(headers['content-type']);
        // console.log(headers['date']);
        // console.log(new Date(headers['date']))
        meta.splice(0, meta.length);
        meta.push({ date: new Date(headers['date']), contentType: headers['content-type']})


        const { ip, port } = response.remoteAddress();

        meta.push({ ip, port });

        const host = new URL(url).host.split('.').filter(el => el !== 'www').join('.');
        

      //   exec(`dig ${url} any +trace`, (err, stdout, stderr) => {
      //     // console.log('err:', err);
      //     if (!err) {
      //       console.log('result url:', stdout);
      //       // console.log('result:', stdout.split('\n'));
      //       // fss.existsSync()
      //       fs.writeFile(`diglog-url-any-trace${Date.now()}.txt`, stdout);

      //       console.log('stderr:', stderr);
      //     }
      // })
        exec(`dig ${host} any +trace`, (err, stdout, stderr) => {
          console.log('dns err', err);
          if (!err) {
            // console.log('result host1:', stdout);
            // console.log('result:', stdout.split('\n'));
            // fs.writeFile(`diglog-host-any-trace${Date.now()}.txt`, stdout);
            const x = stdout
              .split('\n')
              .filter((el) => el !== '')
              .map((el) => {
                return el.split('\t').filter((el) => el !== '');
              });
            
            const hostIndex = x.reduce<number>((acc, val, index) => {

              if (val[0].includes(host) && acc === 0) acc = index;
              
              return acc;

            }, 0)


            
            // console.log(hostIndex);
            // console.log(x);
            // console.log('meta===========\n', x[hostIndex!]);
            meta.push({ dns: x.slice(hostIndex)})
            // console.log('stderr:', stderr);
          }
        })
        // exec(`dig ${host} any +vc`, (err, stdout, stderr) => {
        //   if (!err) {
        //     console.log('result host2:', stdout);
        //     // console.log('result:', stdout.split('\n'));
        //     console.log('stderr:', stderr);
        //   }
        // })
      //   exec(`dig ${host} +trace`, (err, stdout, stderr) => {
      //     if (!err) {
      //       console.log('result host3:', stdout);
      //       fs.writeFile(`diglog-host-trace${Date.now()}.txt`, stdout);
      //       // console.log('result:', stdout.split('\n'));
      //       console.log('stderr:', stderr);
      //     }
      //   })
        // exec(`dig -x ${ip}`, (err, stdout, stderr) => {
        //   if (!err) {
        //     console.log('result ip:', stdout);
        //     // console.log('result:', stdout.split('\n'));
        //     fs.writeFile(`diglog-ip-trace${Date.now()}.txt`, stdout);
        //     console.log('stderr:', stderr);
        //   }
        // })
        // exec(`dig ${ip} +trace`, (err, stdout, stderr) => {
        //   if (!err) {
        //     console.log('result ip:', stdout);
        //     // console.log('result:', stdout.split('\n'));
        //     // fs.writeFile(`diglog-ip-trace${Date.now()}.txt`, stdout);
        //     console.log('stderr:', stderr);
        //   }
        // })



        // console.log()

      }     

    } )
    await page.setViewport({
      width: 1000,
      height: 1000,
      deviceScaleFactor: 1,
    });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle0' });
    const file = await page.screenshot({ path: 'test.png'});
    response.set('Content-Type', 'image/png');
    return response.status(200).send(file);
  } catch (error) {
    response.status(502).send(error);
  }

};

const stampImage = (request: Request, response: Response) => {
  try {
  
  const canvas = createCanvas(800, 1000);
  const ctx = canvas.getContext('2d');
  ctx.font = '15px monospace';

  // ctx.fillStyle = "green";
  // ctx.fillRect(0, 0, 500, 500);
  

  // ctx.rotate(0.1)
  ctx.fillStyle = "red";
  const metaText = meta
    .flatMap((el, index) => {
      if (index === 0 || index === 1) {
        const keys = Object.keys(el);
        return `${keys[0]}: ${el[keys[0]]}; ${keys[1]}: ${el[keys[1]]};`
      };
      
      return el.dns.flatMap((el: any[]) => {
        return el.join(' ');
      });
    }).join('\n');
  ctx.fillText(metaText, 0, 20);
  
  const buf = canvas.toBuffer();
  
    const image = images('test.png');
    const watermarkImage = images('stamp.png');
    const metaImage = images(buf);
    watermarkImage.resize(818, 1000);
    const newImage = image.draw(watermarkImage, (1000 - 818) / 2, 0);
    const anotherImage = newImage.draw(metaImage, 0, 0);
    // const newImageBuffer = newImage.encode("png");
    const anotherImageBuffer = anotherImage.encode("png");

    response.set('Content-Type', 'image/png');
    // return response.status(200).send(newImageBuffer);
    return response.status(200).send(anotherImageBuffer);
  } catch (error) {
    console.log('errorrrrr================');
    console.log(meta);
    console.log(meta[2]);
    // if (!meta[3].dns) {
    //   setTimeout(() => stampImage(request, response), 2000);
    //   return;
    // }
    response.status(502).send(error)
  }
};

const getMeta = (request: Request, response: Response) => {
  // const meta = [{ data1: 'data11' }, {data2: 'data22'}];
  // console.log(meta);
  
  response.status(200).json(meta);
  meta.splice(0, meta.length);
}

const getProxy = (request: Request, response: Response, next: NextFunction) => {
  try {
    console.log('get proxy request test');
    const url = request.url.split("/proxy/?")[1];
    return axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer', // important
    }).then((axiosresponse) => {
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

const getAdapterResponseJSON = (request: Request, response: Response, next: NextFunction) => {
  try {
    console.log(request.body);
    const promiseGetBlobHeaders: Promise<{
      blob: any;
      headers: any;
      trustedSha256sum: string;
      cid: CIDString | undefined;
      metadataCid: CIDString | undefined;
    }> = getBlobHeaders(request.body.data.url).then((blobHeaders) => {
      let trustedSha256sum =  enchex.stringify(sha256( CryptoJS.lib.WordArray.create(blobHeaders.blob)));
      console.log("trustedSha256sum", trustedSha256sum);
      return {
        blob: blobHeaders.blob,
        headers: blobHeaders.headers,
        trustedSha256sum,
        cid: undefined,
        metadataCid: undefined,
      }
    });

    const promisePutToStorage = promiseGetBlobHeaders.then(async (blobHeaderstTustedSha256sum)=>{
      const blobImage = images(blobHeaderstTustedSha256sum.blob);
      const height = Math.min(blobImage.height(), blobImage.width());
      //345x422 
      const watermarkBuffer = await svgRender({
        buffer: images('test.png').encode('png'),
        height: height
      });
      
      //let watermarkBuffer = Buffer.from(watermark, 'base64');
      const watermarkImage = images(watermarkBuffer);

      const left = (blobImage.width() - watermarkImage.width())/2;
      
      const newImage = blobImage.draw(watermarkImage, left, 0);
      const newImageBuffer = newImage.encode("png");
      
      const blob = new Blob([newImageBuffer]);
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
      let blob = new Blob(
        [JSON.stringify({
        name,
        image,
        description,
        ts,
        time,
        url,
        attributes: objectToAttributes(result.headers),
      })]);
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


export default { getIndexPage, stampImage, makeScreenShot, getProxy, getAdapterResponseJSON, getMeta };
