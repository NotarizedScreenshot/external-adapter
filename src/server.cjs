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
    // console.log(response);
    return {
      blob: response.data,
      headers: response.headers
    }
  });

};


server.post('/adapter_response.json', (request, response) => {
  // console.log(request.body);

  console.log(request.body.data.sha256sum.toString(16));

  let promise = getBlobHeaders(request.body.data.url).then((blobHeaders) => {
    console.log("blob base64     --------------------------------------------------------------------------------------")
    console.log(new Buffer(blobHeaders.blob).toString('base64'));
    var wa = CryptoJS.lib.WordArray.create(blobHeaders.blob);
    let hashBlob = sha256(wa);
    console.log("blob sha256sum  --------------------------------------------------------------------------------------")
    console.log(hashBlob);
    console.log(enchex.stringify(hashBlob));
  });


  response.writeHead(204, {'Content-Type': 'application/json'});
  response.end();
});


// getFile(url, ) {

//   let proxy = window.location.host.match(/^localhost/) ? "static/pic.jpeg" : ('/proxy/?' + this.state.val)

//   fetch(proxy)
//       .then((response) => {
//           if (!response.ok) {
//               throw `HTTP error! Status: ${response.status}`;
//           } else {
//               let headers = {};

//               response.headers.forEach(function (val, key) {
//                   headers[key] = val;
//               })
//               response.blob().then((myBlob) => {
//                   const objectURL = URL.createObjectURL(myBlob);
//                   this.setState({
//                       file: {
//                           headers: headers,
//                           image: objectURL,
//                           imageHash: sha256(myBlob).toString(encHex)
//                       },
//                       procedure: 2,
//                   })
//               })
//           }
//       }).catch((err) => {
//       this.setState({file: {error: err}});
//   });
// }


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
//   //   //const cid = await client.storeBlob(blob)
//   // });
//   // bb.on('field', (name, value, info) => {
//   //   // ...
//   // });
// });

server.listen(9000, () => {
  console.log('Server started on port', 9000);
});
