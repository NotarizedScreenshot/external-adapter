FROM node:18-bullseye

WORKDIR /app
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
&& sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
&& apt update \
&& apt upgrade -y \
&& apt install -y dnsutils lsb-release google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 --no-install-recommends \
&& rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm install typescript -g
RUN npm install
RUN tsc

ARG user=quantumoracle
ARG group=quantumoracle
ARG uid=2000
ARG gid=2000

RUN groupadd -g ${gid} ${group}
RUN useradd -u ${uid} -g ${group} -s /bin/sh -m ${user}

RUN chown appuser /app

USER ${uid}:${gid}

CMD ["npm", "start"]
