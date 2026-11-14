# Playwright with its browsers, plus the tools that turn recordings into GIFs.
FROM mcr.microsoft.com/playwright:v1.65.1-noble

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg gifsicle \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /e2e
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ENTRYPOINT ["./record.sh"]
