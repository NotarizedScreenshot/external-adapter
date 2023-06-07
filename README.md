# QuantrumOracle external adapter
External adapter for Chainlink nodes providing NTF metadata to mint with QuantumOracle, aka backend

## Deploy
```shell
docker compose up -d
```

### Chainlink Job Definition
```toml
name = "Get Mintable Screenshot Metadata CID by tweetId"
externalJobID = "5f26bf32-4517-4615-8e11-edb088eb3312"
schemaVersion = 1
type = "directrequest"
contractAddress = "0xea85b380B28FA3A95E46B6817e3CB6ae7F467F57"
evmChainID = 137
minIncomingConfirmations = 0

observationSource = """
    decode_log   [type="ethabidecodelog"
                  abi="OracleRequest(bytes32 indexed specId, address requester, bytes32 requestId, uint256 payment, address callbackAddr, bytes4 callbackFunctionId, uint256 cancelExpiration, uint256 dataVersion, bytes data)"
                  data="$(jobRun.logData)"
                  topics="$(jobRun.logTopics)"]

    decode_cbor  [type="cborparse" data="$(decode_log.data)"]
    send_to_bridge [type="bridge" name="get_mintable_screenshot_cid_by_tweet_id" requestData="{\\"data\\": { \\"tweetId\\": $(decode_cbor.tweetId) }, \\"tweetId\\": $(decode_cbor.tweetId)}"]
    parseCid       [type="jsonparse" path="data,cid" data="$(send_to_bridge)"]

    encode_large [type="ethabiencode"
                abi="(bytes32 requestId, string cid)"
                data="{\\"requestId\\": $(decode_log.requestId), \\"cid\\": $(parseCid)}"
                ]

    encode_tx    [type="ethabiencode"
                  abi="fulfillOracleRequest2(bytes32 requestId, uint256 payment, address callbackAddress, bytes4 callbackFunctionId, uint256 expiration, bytes calldata data)"
                  data="{\\"requestId\\": $(decode_log.requestId), \\"payment\\": $(decode_log.payment), \\"callbackAddress\\": $(decode_log.callbackAddr), \\"callbackFunctionId\\": $(decode_log.callbackFunctionId), \\"expiration\\": $(decode_log.cancelExpiration), \\"data\\": $(encode_large)}"
                 ]
    submit_tx    [type="ethtx" to="0xea85b380B28FA3A95E46B6817e3CB6ae7F467F57" data="$(encode_tx)"]

    decode_log -> decode_cbor -> send_to_bridge -> parseCid -> encode_large -> encode_tx -> submit_tx
"""
```

## Development

#### Deploy via Github Actions
```shell
git tag v0.1.5
git push origin v0.1.5
```

#### run in Docker:
```shell
docker compose up
#[+] Running 2/0
# ✔ Container external-adapter-redis-1               Created                                         0.0s 
# ✔ Container external-adapter-notaryshot-adapter-1  Crea...                                         0.0s
# external-adapter-notaryshot-adapter-1  | server started on port 9000

# send a GET request to see it working
curl 'http://localhost:9000/previewData?tweetId=1639773626709712896&userId=8gZ5NgQYD9KGBAUcAAAJ'

# then see the upload queue in action in Docker logs
# external-adapter-notaryshot-adapter-1  | uploadQueue job id:3 name: __default__ started 
# external-adapter-notaryshot-adapter-1  | {
# external-adapter-notaryshot-adapter-1  |   tweetId: '1639773626709712896',
# external-adapter-notaryshot-adapter-1  |   userId: '8gZ5NgQYD9KGBAUcAAAJ',
```


#### Compile Typescript and run the server:
```shell
yarn install
yarn dev:ts
```  
http://localhost:9000/

![1666010630854148097_birds](https://github.com/NotarizedScreenshot/external-adapter/assets/15115/aa2aec88-080e-4504-bc7e-1710e7d66121)  
https://opensea.io/assets/matic/0xdd1b2a01c37239f1a6b323fa63d3f5be3ecfaf5d/10  

