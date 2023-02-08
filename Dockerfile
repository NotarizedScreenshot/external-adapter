FROM node:16-bullseye

WORKDIR /app
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && apt-get install -y dnsutils \
    && apt-get install -y nano \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm i && npm install typescript -g
RUN tsc

ARG user=appuser
ARG group=appuser
ARG uid=2000
ARG gid=2000

RUN groupadd -g ${gid} ${group}
RUN useradd -u ${uid} -g ${group} -s /bin/sh -m ${user}

RUN chown appuser /app
RUN chown root:root /app/.cache/puppeteer/chrome/linux-1083080/chrome-linux/chrome_sandbox
RUN chmod 4755 /app/.cache/puppeteer/chrome/linux-1083080/chrome-linux/chrome_sandbox
RUN cp -p /app/.cache/puppeteer/chrome/linux-1083080/chrome-linux/chrome_sandbox /usr/local/sbin/chrome-devel-sandbox
RUN export CHROME_DEVEL_SANDBOX=/usr/local/sbin/chrome-devel-sandbox

USER ${uid}:${gid}


CMD ["npm", "start"]
