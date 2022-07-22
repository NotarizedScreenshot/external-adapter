FROM node:16.16.0-bullseye-slim
WORKDIR /app
RUN addgroup --gid 2000 hf22 && adduser -u 2000 --ingroup hf22 --shell /bin/sh --disabled-password hf22 && chown hf22:hf22 /app
COPY . .
RUN npm install --no-optional &&  npm run build:server

RUN mkdir node_modules/.cache
RUN chown hf22:hf22 node_modules/.cache
USER hf22

CMD ["npm","run","serve"]