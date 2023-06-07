# QuantrumOracle external adapter
External adapter for Chainlink nodes providing NTF metadata to mint with QuantumOracle, aka backend

## Development

### Deploy via Github Actions
```shell
git tag v0.1.5
git push origin v0.1.5
```

run in Docker:
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


### Compile Typescript and run the server:
```shell
yarn install
yarn dev:ts
```  
http://localhost:9000/


### Browser access:
Link: 

Put link into input field and press submit:

![image](https://user-images.githubusercontent.com/51874367/214381212-deaa8934-56d8-4b62-b314-d0761800a49e.png)

Check result: 

![image](https://user-images.githubusercontent.com/51874367/214381404-d4075793-dd26-4213-8088-a72427bfcb0c.png)
