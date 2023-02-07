export interface IMetadata {
  headers: { [id: string] : string},
  ip: string,
  url: string,
  dns: { host: string, data: string[]};
}

export type TMetadataAttributes = { trait_type: string, value: string}[];
