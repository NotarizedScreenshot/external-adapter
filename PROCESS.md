# Routes and controllers

## "/" GET

Runs getIndexPage controller, and sends index.html page in response. It is a service page for
testing purposes. Should be stubbed on prod. Issue:
https://github.com/NotarizedScreenshot/external-adapter/issues/33

## "/send" POST

Runs getScreenShot controller, request body:

```
{
    tweetId: string;
}
```

Process:

1. Validate if the received tweetId is Uint64.
2. Compose a tweet URL with a pattern:

```
`https://twitter.com/twitter/status/${tweetId}`;
```

3. Create an instance of a headless browser (the puppeteer) and a page.

As the adapter is not supposed to be run with root, the puppeteer is run without sandbox.

4. The page navigates to the tweet URL with the params:

```
{ waitUntil: 'networkidle0' }
```

to make sure the page is fully loaded before a screenshot is made.

5. While the page is loading, a listener on 'response' listens to the responses those the browser
   receives.

a. if the URL of the response is equal to the tweet URL, the listener extracts headers:

```
const headers = pupperTerresponse.headers();
```

and queries DNS information of the hos with DIG utility:

```
const dnsResult = await getDnsInfo(host, ['+trace', 'any']);
```

then saves fetched data into a metadata JSON file:

```
const headers = pupperTerresponse.headers();
const { ip } = pupperTerresponse.remoteAddress();
const host = getHostWithoutWWW(url);

const meta: {
  headers: { [id: string]: string };
  ip: string;
  url: string;
  dns: { host: string; data: string[] };
  } = {...}

fs.writeFile(path, JSON.stringify(meta));
```

NOTE: DNS results should be saved as a raw string and processed everywhere as raw string, in the
adapter, on the front and anywhere else.

b. if the URL of the response is equal to /TweetDetail/g (a request of tweet data):

Parse data related to the actual tweetId and temp save:

```
const responseDataString = JSON.stringify(responseData.data);

if (responseDataString.includes(`tweet-${request.body.tweetId}`)) {
  await fs.writeFile(
    path.resolve(processPWD, 'data', tweetDataPathFromTweetId(tweetId)),
    responseDataString,
  );
}
```

6. After the page loading completed, a screenshot is temporary saved in \*/data/ directory

7. Kill browser inststance

8. sent a response with screenshotImageBuffer.

At the moment, the default viewport is set to low values to save processing time of uploading to
ifps and comply with the ChainLink node default timeout. const VIEWPORT_DEFAULT_WIDTH = 450; const
VIEWPORT_DEFAULT_HEIGHT = 600;

#### TODO:

1. remove processing of DNS query data, and save it as a raw string.
2. listen to all the requests/responses those the puppeteer calls and those related to media files
   that the tweet contains (exclude chunks of the bundle). At the moment, as we save only the tweet
   without a full timeline it will require filtering the required responses.
3. save all the data, including metadata directly to ipfs without storing it locally. Save large
   media files in the background (with a kind of worker or a job).
4. send back in the response the screenshot image in base64 and metadata/tweet data to not store any
   data locally. OR
5. still save data locally. no need to load it up to the ipfs forever, if someone changes their mind
   and doesn't send the transaction.

## '/metaData' GET

Runs getMetaData controller. Extract tweetId from a query:

```
const { tweetId } = request.query as { tweetId: string };
```

Read locally saved metadata:

```
const metadata = processMetaData(await fs.readFile(metadataPath, 'utf-8'));
```

And send a JSON as the response:

```
response.status(200).json(metadata);
```

#### TODO:

1. It was supposed to be used by the frontend to get metadata for preview. As we will send metadata in response to the '/send' request, no need for it anymore.
2. Temporarily it makes and saved the watermarked image to save some time to comply with 15s of default http timeout of the chainlink node. Will get rid of it.

## '/tweetData' GET

Runs getTweetData controller. Extract tweetId from a query:

```
const { tweetId } = request.query as { tweetId: string };
```

Read locally saved metadata:

```
const tweetRawDataString = await fs.readFile(tweetResponseDataPath, 'utf-8');
```

And send a JSON as the response:

```
response.status(200).json(tweetRawData);
```

#### TODO:

1. Same as the /getMetaData: remove as the tweet data is sent in the '/sent' response.

## '/stamped' GET

Runs getStampedImage controller. Reads locally save metadata and screenshot, compiles a stamped
screenshot and send it back to the frontend as a buffer.

#### TODO:

1. To remove as we don't preview stamped screenshot images in the frontend.

## '/adapter_response.json' POST

Runs adapterResponseJSON controller, request body:

```
{
  data: { url: string }
}
```

Reads locally saved metadata, tweetRawData, screenshot image, and watermarked image. Processes data:

```
const metadata = processMetaData(await fs.readFile(metadataPath, 'utf-8'));
const tweetData = createTweetData(tweetResults);
```

Uploads data into IPFS with NFTStorage:

```
const cids = await Promise.all(
      [watermarkedSreenshotPath, screenshotPath].map(async (path) => {
        const buffer = await fs.readFile(path);
        const hashSum = getTrustedHashSum(buffer);
        const cid = await uploadBufferToNFTStorage(client, buffer);
        return { path, cid, hashSum };
      }),
    );
```

Compiles metadata:

```
const metadataBlob = new NFTBlob([
      JSON.stringify({
        name,
        image,
        description,
        ts,
        time,
        url: requestUrl,
        attributes,
        finalData,
      }),
    ]);

    const metadataCid = await client.storeBlob(metadataBlob);
```

Sends back a response:

```
const data: { data: IAdapterResponseData } = {
      data: {
        url: tweetId,
        sha256sum: BigInt('0x' + trustedSha256sum).toString(),
        // cid: String(watermarkedScreenshotCid),
        // cid: String('screenshotCid'),
        cid: String(cids[1].cid),

        metadataCid: metadataCid,
      },
    };
    response.status(200).json(data);
```

#### TODO:

1. Change "url" in the request body to "tweeId". It should be changed in the chainlink node request
   respectively.
2. If we upload a tweet-related media on the '/send/' request, no need to read any locally saved files,
   use content ids to fetch metadata from ipfs and create a metadata object required by
   NFTStorage. 3. The only media object to create at this moment is a watermarked image. It is
   required is we do not create a watermarked image at the preview stage before the user confirms
   submitMint transaction.

