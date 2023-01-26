const axios = require('axios');
function getBlobHeaders(url) {
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

function objectToAttributes(object) {
  let attributes = [];
  for(const key of Object.keys(object)) {
    attributes.push({
      trait_type:key,
      value:object[key]
    })
  }
  return attributes;
}

module.exports = { getBlobHeaders, objectToAttributes };
