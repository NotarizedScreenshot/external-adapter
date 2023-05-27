FROM node:18-alpine AS builder

WORKDIR /app

RUN apk add --update build-base pkgconfig python3 cairo-dev librsvg-dev pango-dev pixman-dev

COPY . .

RUN yarn global add typescript

RUN yarn install --production --frozen-lockfile
RUN mkdir /prod_dependencies
RUN cp -R ./node_modules /prod_dependencies
RUN yarn install --frozen-lockfile
RUN tsc


FROM node:18-alpine
WORKDIR /app

RUN apk add --update --no-cache bind-tools cairo librsvg pango

ARG user=quantumoracle
ARG group=quantumoracle
ARG uid=2000
ARG gid=2000

RUN addgroup --gid ${gid} ${group}
RUN adduser -D -G ${group} -u ${uid} ${user}

COPY --from=builder /app/dist/ ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/config.env ./
COPY --from=builder /prod_dependencies/node_modules ./node_modules

RUN chown ${user} /app
ENV REDIS_HOST=redis
ENV CHROME_HOST=chrome
USER ${uid}:${gid}

CMD ["node", "index.js"]
