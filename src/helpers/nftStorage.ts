import { NFTStorage, Blob as NFTBlob } from 'nft.storage';

export const uploadToCAS = async (
  dataBuffer: Buffer | string,
  client: NFTStorage,
): Promise<string> => {
  const blob = new NFTBlob([dataBuffer]);
  const cid = await client.storeBlob(blob);
  return cid;
};
