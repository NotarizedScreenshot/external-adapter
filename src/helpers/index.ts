import { spawn } from "child_process";
import { IMetadata, TMetadataAttributes } from 'types';

export const getIncludeSubstringElementIndex = (
  array: string[],
  substring: string,
  start: number = 0
): number | null =>
  array.reduce<number | null>(
    (acc, val, index) =>
      val.includes(substring) && acc === null && index >= start ? index : acc,
    null
  );

export const getHostWithoutWWW = (url: string) => {
  const host = new URL(url).host;
  return host.slice(host.includes("www") ? 4 : 0);
};

export const trimUrl = (url: string): string => {
  const trimmedUrl = url.trim();
  return trimmedUrl[trimmedUrl.length - 1] === "/"
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
}

export const getDnsInfo = (url: string, args: string[] = []): Promise<string> => {
  const cmd = 'dig';

  return new Promise((resolve, reject) => {
    const process = spawn(cmd, [url, ...args]); 
    let output = ''; 

    process.on('error', reject)
    process.stdout.on('error', reject);
    process.stdout.on('data', (chunk) => {
      output += chunk;
    })

    process.stdout.on('end', () => {
      if(output.includes('connection timed out')) reject('dig timed out')
      resolve(output.trim());
    })
  })
}

export const metadataToAttirbutes = (metadata: IMetadata): TMetadataAttributes => {
  const attributes: TMetadataAttributes = [];
  const { headers, ip, url, dns } = metadata;
  attributes.push(
    { trait_type: 'ip', value: ip}, 
    { trait_type: 'url', value: url }, 
    { trait_type: 'dns', value: dns.data.join('\n')},
    );

  for (const key of Object.keys(headers)) {
    attributes.push({ trait_type: key, value: headers[key]})
  }

  return attributes;
}

export const getStampMetaString = (metadata: IMetadata) => {
  const { headers, ip, url, dns } = metadata;
  const data = [ `url: ${url}`, `ip: ${ip}` ];

  for (const key of Object.keys(headers)) {
    data.push(`${key}: ${headers[key]}`)
  }
  
  const hostIndex = getIncludeSubstringElementIndex(dns.data, dns.host, 2);      
  data.push(dns.data.slice(!!hostIndex ? hostIndex : 0).join('\n'));
  return data.join('\n');
}
