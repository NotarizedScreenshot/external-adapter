import { Job } from "bull";
import { tweetDataPathFromTweetId } from ".";

const Queue = require('bull');

export const tweetQueue = new Queue('tweet screenshots');
//
//tweetQueue.process(async function (job: Job<string>): Promise<string> {
//  console.log("tweetQueue job start")
//  job.progress(42)
//  const tweetId = job.data
//  console.log(`bullQueues: processing tweet ${tweetId}`)
//  //return Promise.resolve(tweetDataPathFromTweetId(tweetId))
//  return Promise.resolve("some result")
//
//});


tweetQueue.process('/home/etsvigun/devenv/crypto/hackfs/2022/src/external-adapter/src/helpers/worker.ts');

import { Request, Response } from 'express';

export const testBull = async (request: Request, response: Response) => {
  console.log("bull processing")
  const tweetId = request.body.tweetId
  
  tweetQueue.on('progress', function(job: Job<string>, progress: number){
    console.log(`${job.id} is in progress`)
  })
  tweetQueue.on('completed', function (job: Job<string>, result: string) {
    console.log(`result: ${result}`)
  })

  const res = await tweetQueue.add(tweetId)
  console.log(res)
  console.log("---")
  response.status(200)
}


//1639773626709712896
//1635999673646186499
//1643648248916082691

