import express from "express";
import router from "./routes";
import dotenv from "dotenv";
import morgan from "morgan";
import fs from 'fs';
import path from 'path'

dotenv.config({ path: process.env.PWD + "/config.env" });

if (!fs.existsSync(path.resolve(process.env.PWD!, 'data'))) {
  fs.mkdirSync(path.resolve(process.env.PWD!, 'data'));
}

const server = express();
server.use(express.json());
server.use(express.static("public"));
server.use(morgan('dev'))

server.use("/", router);

server.listen(9000, () => {
  console.log("server started on port", 9000);
});
