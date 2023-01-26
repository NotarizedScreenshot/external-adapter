import axios from "axios";

export function getBlobHeaders(url: string): Promise<any> {
  return axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer', // important
  }).then((response) => {
    return {
      blob: response.data,
      headers: response.headers
    }
  });

};

export function objectToAttributes(object: any) {
  let attributes = [];
  for(const key of Object.keys(object)) {
    attributes.push({
      trait_type:key,
      value:object[key]
    })
  }
  return attributes;
}

export default { objectToAttributes, getBlobHeaders };
