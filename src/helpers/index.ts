import { spawn } from 'child_process';
import {
  IMetadata,
  ITweetBody,
  ITweetCard,
  ITweetData,
  ITweetDetails,
  ITweetUser,
  TMetadataAttributes,
} from 'types';
import enchex from 'crypto-js/enc-hex';
import sha256 from 'crypto-js/sha256';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { response } from 'express';
import { NFTStorage, Blob as NFTBlob } from 'nft.storage';

export const getIncludeSubstringElementIndex = (
  array: string[],
  substring: string,
  start: number = 0,
): number | null =>
  array.reduce<number | null>(
    (acc, val, index) => (val.includes(substring) && acc === null && index >= start ? index : acc),
    null,
  );

export const getHostWithoutWWW = (url: string) => {
  const host = new URL(url).host;
  return host.slice(host.includes('www') ? 4 : 0);
};

export const trimUrl = (url: string): string => {
  const trimmedUrl = url.trim();
  return trimmedUrl[trimmedUrl.length - 1] === '/'
    ? trimmedUrl.substring(0, trimmedUrl.length - 1)
    : trimmedUrl;
};

export const isValidUrl = (url: string, protocols: string[] = ['http:', 'https:']): boolean => {
  try {
    const urlToCheck = new URL(url);
    return protocols.includes(urlToCheck.protocol);
  } catch (error) {
    return false;
  }
};

export const getDnsInfo = (url: string, args: string[] = []): Promise<string> => {
  const cmd = `dig`;

  return new Promise((resolve, reject) => {
    //reject('dns not done')
    const process = spawn(cmd, [url, ...args]);
    let output = '';
    process.on('error', reject);
    process.stdout.on('error', reject);
    process.stdout.on('data', (chunk) => {
      output += chunk;
    });

    process.stdout.on('end', () => {
      console.log('dig process end');
      if (output.includes('connection timed out')) reject('dig timed out');
      resolve(output.trim());
    });

    /*
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error(`exec error: ${err}`);
        reject()
      }
    
      console.log(`Number of files ${stdout}`);
      resolve(stdout)
    });
    */
  });
};

export const metadataToAttirbutes = (metadata: IMetadata): TMetadataAttributes => {
  const attributes: TMetadataAttributes = [];
  const { headers, ip, url, dns } = metadata;
  attributes.push(
    { trait_type: 'ip', value: ip },
    { trait_type: 'url', value: url },
    { trait_type: 'dns', value: dns.data.join('\n') },
  );

  for (const key of Object.keys(headers)) {
    attributes.push({ trait_type: key, value: headers[key] });
  }

  return attributes;
};

export const tweeetDataToAttributes = (tweetData: ITweetData) => {
  const { body, user, details } = tweetData;
  const attributes: TMetadataAttributes = [];

  const userKeys = Object.keys(user) as [keyof ITweetUser];
  for (const key of userKeys) {
    attributes.push({ trait_type: `user-${key}`, value: user[key] });
  }

  const detailsKeys = Object.keys(details) as [keyof ITweetDetails];
  for (const key of detailsKeys) {
    attributes.push({ trait_type: key, value: String(details[key]) });
  }
  const bodyKeys = Object.keys(body) as [keyof ITweetBody];
  for (const key of bodyKeys) {
    if (key === 'full_text') attributes.push({ trait_type: key, value: String(body[key]) });
    if (key === 'hashtags' || key === 'symbols' || key === 'urls' || key === 'user_mentions') {
      body[key] && attributes.push({ trait_type: key, value: body[key]!.join(' ') });
    }
    if (key === 'media') {
      body[key] &&
        attributes.push({
          trait_type: key,
          value: String(body[key]?.map((el) => el.src).join(', ')),
        });
    }
    if (!!body.card && key === 'card') {
      const { card } = body;
      const cardKeys = Object.keys(card) as [keyof ITweetCard];
      for (const cardKey of cardKeys) {
        if (!!card[cardKey])
          attributes.push({ trait_type: `card-${cardKey}`, value: card[cardKey] });
      }
    }
  }

  return attributes;
};
export const getStampMetaString = (metadata: IMetadata) => {
  const { headers, ip, url, dns } = metadata;
  const data = [`url: ${url}`, `ip: ${ip}`];

  for (const key of Object.keys(headers)) {
    data.push(`${key}: ${headers[key]}`);
  }

  const hostIndex = getIncludeSubstringElementIndex(dns.data, dns.host, 2);
  data.push(dns.data.slice(!!hostIndex ? hostIndex : 0).join('\n'));
  return data.join('\n');
};

export const pngPathFromUrl = (url: string, signCode: string): string => {
  return `${url.split(':').join('_').split('/').join('_').split('.').join('_')}.png`;
};

export const pngPathFromTweetId = (tweetId: string): string => {
  return `${tweetId}.png`;
};

export const pngPathStampedFromUrl = (url: string, signCode: string): string => {
  return `${url.split(':').join('_').split('/').join('_').split('.').join('_')}_stamp.png`;
};

export const metadataPathFromUrl = (url: string, signCode: string): string => {
  return `${url.split(':').join('_').split('/').join('_').split('.').join('_')}.json`;
};

export const metadataPathFromTweetId = (tweetId: string): string => {
  return `${tweetId}-meta.json`;
};

export const tweetDataPathFromTweetId = (tweetId: string): string => {
  return `${tweetId}-tweet.json`;
};

export const isValidBigInt = (data: string) => {
  if (!data || data.length === 0) return false;
  if (!/^\d+$/.test(data)) return false;
  if (BigInt(data) > BigInt(2 ** 64 - 1)) return false;
  return true;
};

export const makeTweetUrlWithId = (tweetId: string): string =>
  `https://twitter.com/twitter/status/${tweetId}`;

export const getTrustedHashSum = (data: string | Buffer) =>
  enchex.stringify(
    // @ts-ignore
    sha256(CryptoJS.lib.WordArray.create(data)),
  );

export const getTweetResultsFromTweetRawData = (tweetRawDataString: string, tweetId: string) => {
  const tweetRawData = JSON.parse(tweetRawDataString);
  const tweetResponseInstructions =
    tweetRawData['threaded_conversation_with_injections_v2'].instructions;

  const tweetTimeLineEntries = tweetResponseInstructions.reduce((acc: any, val: any) => {
    return val.type === 'TimelineAddEntries' ? val : acc;
  }, null).entries;

  const itemContents = tweetTimeLineEntries.reduce((acc: any, val: any) => {
    return val.entryId === `tweet-${tweetId}` ? val : acc;
  }, null).content.itemContent;

  return itemContents.tweet_results.result;
};

export const getImageBuffer = async (src: string): Promise<Buffer | null> => {
  try {
    const response = await axios.get(src, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const uploadToNFTStorageWithHash = async (client: NFTStorage, src: string) => {
  try {
    const buffer = await getImageBuffer(src);
    if (!buffer) throw new Error(`fail to download resource: ${src}`);
    const hashSum = getTrustedHashSum(buffer);
    const blob = new NFTBlob([buffer]);
    const cid = await client.storeBlob(blob);

    return { src, hashSum, cid };
  } catch (error: any) {
    console.error('uploadToNFTStorageWithHash error', error);
    return { src, error: error.message };
  }
};

export const uploadBufferToNFTStorage = async (client: NFTStorage, buffer: Buffer) => {
  try {
    const blob = new NFTBlob([buffer]);
    const cid = await client.storeBlob(blob);
    return cid;
  } catch (error: any) {
    console.error('uploadBufferToNFTStorage', error);
    return null;
  }
};

export const processMetaData = (rawDataJSON: string) => {
  const parsedMetaData = JSON.parse(rawDataJSON);
  const { host, data } = parsedMetaData.dns;
  const dnsData = data
    .filter((el: string) => !el.includes('DiG') && !el.includes('global options'))
    .map((el: string) => {
      const splitted = el.split('\t').join(' ');
      return splitted;
    });

  return { ...parsedMetaData, dns: { host, data: dnsData } };
};
