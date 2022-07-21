const express = require('express');
const cookieParser = require('cookie-parser');
const sha256 = require('crypto-js/sha256');

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


server.post('/adapter_response.json', (request, response) => {
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
    let blob = new Blob([blobHeaderstTustedSha256sum.blob]);
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
      name: name,
      image: image,
      description: description,
      ts: ts,
      time: time,
      url: url,
      verificationData: {
        headers: result.headers
      }
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
  })

});



// server.post('/storeBlob', (request, response) => {
//   const bb = busboy({ headers: request.headers });
//   bb.on('file', (name, file, info) => {
//     const { filename, encoding, mimeType } = info;
//     console.log(
//       `File [${name}]: filename: %j, encoding: %j, mimeType: %j`,
//       filename,
//       encoding,
//       mimeType
//     );
//     file.on('data', (data) => {
//       console.log(`File [${name}] got ${data.length} bytes`);
//     }).on('close', () => {
//       console.log(`File [${name}] done`);
//     });
//   });
//   bb.on('field', (name, val, info) => {
//     console.log(`Field [${name}]: value: %j`, val);
//   });
//   bb.on('close', () => {
//     console.log('Done parsing form!');
//     if (!response.headersSent) {
//       response.writeHead(303, { Connection: 'close', Location: '/' });
//       response.end();
//     }
//   });
//   bb.on('error', (error) => {
//     response.writeHead(500, { Connection: 'close', Location: '/' });
//     response.end();
//     console.log(error);
//   });  
//   request.pipe(bb);
//   //response.writeHead(204, {'Content-Type': 'application/json'});
//   // bb.on('file', (name, file, info) => {
//   //   const blob = new Blob(file);
//   //   //
//   // });
//   // bb.on('field', (name, value, info) => {
//   //   // ...
//   // });
// });

server.listen(9000, () => {
  console.log('Server started on port', 9000);
});
