import express, { Application } from "express";
import router from "./routes";
import dotenv from "dotenv";
import morgan from "morgan";
import { preStartJobs } from './prestart'

dotenv.config({ path: process.env.PWD + "/config.env" });

async function startExpressInstance() {
  const server : Application  = express();
  server.use(express.json());
  server.use(express.static("public"));
  server.use(morgan('dev'))
  server.use("/", router);

  await preStartJobs(server);

  server.listen(9000, () => {
      console.log("server started on port", 9000);
  });
}

startExpressInstance()
