FROM node:16.16.0-alpine3.15
WORKDIR /app
RUN addgroup -g 2000 hf22 && adduser -u 2000 -G hf22 -s /bin/sh -D hf22 && chown hf22:hf22 /app
COPY . .
RUN npm install --no-optional &&  npm run build:server

RUN mkdir node_modules/.cache
RUN chown hf22:hf22 node_modules/.cache
USER hf22

CMD ["npm","run","serve"]