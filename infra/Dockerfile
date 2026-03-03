# Dockerfile for running Playwright E2E tests inside a container
# Uses Node 20 (LTS) with Playwright dependencies
FROM node:20-bullseye

# Install necessary packages for Playwright (browsers will be installed by playwright install)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxshmfence1 \
    lsb-release \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files and install deps
COPY package.json package-lock.json* ./
RUN npm ci --unsafe-perm

# Install Playwright browsers
RUN npx playwright install --with-deps

# Copy test files
COPY . .

# Default command runs Playwright tests
CMD ["npm", "test"]
