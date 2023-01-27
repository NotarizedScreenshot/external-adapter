import express from "express";
import router from "./routes";
import dotenv from "dotenv";

dotenv.config({ path: process.env.PWD + "/config.env" });

const server = express();
server.use(express.json());
server.use(express.static("public"));

server.use("/", router);

server.listen(9000, () => {
  console.log("server started on port", 9000);
});
