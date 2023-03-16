# external-adapter

External adapter for chainlink node aka backend

### To compile ts and run the server:

```
npm install
npm run dev:ts
```

### Browser access:

Link: http://localhost:9000/

Put link into input field and press submit:

![image](https://user-images.githubusercontent.com/51874367/214381212-deaa8934-56d8-4b62-b314-d0761800a49e.png)

Check result:

![image](https://user-images.githubusercontent.com/51874367/214381404-d4075793-dd26-4213-8088-a72427bfcb0c.png)

## Data structure

<br>

### Adapter response data interface

```
{
  url: string;
  sha256sum: string;
  cid: string;
  metadataCid: string;
}
```

1. url: tweed id
2. sha256sum: stringified BigInt of trusted hashsun
3. cid: ipfs stored waterwarked screenshot cid
4. metadataCid: ipfs stored metadata json cid

<br>

### Media stored

1. Tweet screenshot
2. Watermarked screenshot
3. Mediafiles from tweet media (images, videos)
4. Mediafiles from tweet card (images, thumbnails)
5. Mediafiles from tweet user (avatar)
