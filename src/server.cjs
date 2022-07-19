const express = require('express');
const cookieParser = require('cookie-parser');
const busboy = require('busboy');
const { NFTStorage, Blob } = require('nft.storage')
const NFT_STORAGE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweDY3Y2NmMWU0OEU4NWViNzVFQzUzRmEzODU2NzZGOEVEM0Q2OWYxOWMiLCJpc3MiOiJuZnQtc3RvcmFnZSIsImlhdCI6MTY1NzcxMDM1NDA0OSwibmFtZSI6Im15a2V5In0.uem5KZz7-dLM4cgMoYgiBj9wwn4RV7hvhbvAtmrriQI';
const client = new NFTStorage({ token: NFT_STORAGE_TOKEN })

const server = express();
server.use(cookieParser());
server.use(express.static('public'));

server.post('/storeBlob', (request, response) => {
  const bb = busboy({ headers: request.headers });
  bb.on('file', (name, file, info) => {
    const { filename, encoding, mimeType } = info;
    console.log(
      `File [${name}]: filename: %j, encoding: %j, mimeType: %j`,
      filename,
      encoding,
      mimeType
    );
    file.on('data', (data) => {
      console.log(`File [${name}] got ${data.length} bytes`);
    }).on('close', () => {
      console.log(`File [${name}] done`);
    });
  });
  bb.on('field', (name, val, info) => {
    console.log(`Field [${name}]: value: %j`, val);
  });
  bb.on('close', () => {
    console.log('Done parsing form!');
    if (!response.headersSent) {
      response.writeHead(303, { Connection: 'close', Location: '/' });
      response.end();
    }
  });
  bb.on('error', (error) => {
    response.writeHead(500, { Connection: 'close', Location: '/' });
    response.end();
    console.log(error);
  });  
  request.pipe(bb);
  //response.writeHead(204, {'Content-Type': 'application/json'});
  // bb.on('file', (name, file, info) => {
  //   const blob = new Blob(file);
  //   //const cid = await client.storeBlob(blob)
  // });
  // bb.on('field', (name, value, info) => {
  //   // ...
  // });
});

server.listen(9000, () => {
  console.log('Server started on port', 9000);
});
