import { spawn } from 'child_process';
import { IMetadata, TMetadataAttributes } from 'types';

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

export const isValidUint64 = (data: string | number) => {
  const stringified = String(data);
  if (!stringified || stringified.length === 0) return false;
  if (!/^\d+$/.test(stringified)) return false;
  if (BigInt(stringified) > BigInt(2 ** 64 - 1)) return false;
  return true;
};

export const makeTweetUrlWithId = (tweetId: string): string =>
  `https://twitter.com/twitter/status/${tweetId}`;
