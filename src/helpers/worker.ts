import {Job} from "bull";

module.exports = async function (job: Job<string>): Promise<string> {
  console.log("tweetQueue job start")
  job.progress(42)
  const tweetId = job.data
  console.log(`bullQueues: processing tweet ${tweetId}`)
  //return Promise.resolve(tweetDataPathFromTweetId(tweetId))
  return Promise.resolve("some result")
}