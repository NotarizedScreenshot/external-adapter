FROM node:12.14.1-alpine3.11
WORKDIR /app
RUN addgroup -g 2000 hf22 && adduser -u 2000 -G hf22 -s /bin/sh -D hf22 && chown hf22:hf22 /app
USER hf22
COPY . .
RUN npm install --no-optional && npm run build:client && npm run build:server && npm run build:client
CMD ["npm","run","serve"]
