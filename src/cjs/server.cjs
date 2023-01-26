const express = require('express');
const cookieParser = require('cookie-parser');
const router = require('./routes/index.cjs');

const server = express();
server.use(cookieParser());
server.use(express.static('public'));
server.use(express.json());

const JSONstrict = require('json-bigint')({strict: true});

JSON.parse = JSONstrict.parse;
JSON.stringify = JSONstrict.stringify;

server.use('/', router);

server.listen(9000, () => {
  console.log('Server started on port', 9000);
});
