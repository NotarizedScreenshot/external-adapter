FROM node:18-bullseye-slim AS builder

WORKDIR /app

COPY . .

RUN yarn global add typescript
RUN yarn install --frozen-lockfile
RUN tsc


FROM node:18-bullseye-slim
WORKDIR /app

RUN apt update \
&& apt install -y dnsutils --no-install-recommends \
&& rm -rf /var/lib/apt/lists/*

ARG user=quantumoracle
ARG group=quantumoracle
ARG uid=2000
ARG gid=2000

RUN groupadd -g ${gid} ${group}
RUN useradd -u ${uid} -g ${group} -s /bin/sh -m ${user}

COPY --from=builder /app/dist/ ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./
COPY --from=builder /app/config.env ./
RUN yarn install --production --frozen-lockfile && yarn cache clean && rm -Rf /root/.cache/ && rm -Rf /tmp/*

RUN chown ${user} /app
ENV REDIS_HOST=redis
ENV CHROME_HOST=chrome
USER ${uid}:${gid}

CMD ["node", "index.js"]
