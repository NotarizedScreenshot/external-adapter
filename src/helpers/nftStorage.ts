import { NFTStorage, Blob as NFTBlob } from 'nft.storage';

export const updloadTweetToCAS = async (dataBuffer: Buffer | string): Promise<string> => {
  const client = new NFTStorage({ token: process.env.NFT_STORAGE_TOKEN! });
  const blob = new NFTBlob([dataBuffer]);
  const cid = await client.storeBlob(blob);
  return cid;
};
