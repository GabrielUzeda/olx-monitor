# Builder Stage
FROM node:20 AS builder
WORKDIR /usr/app

# Install dependencies
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install --no-audit --no-fund

# Copy sources and config
COPY src ./src
COPY config.json ./config.json

# Build TypeScript
RUN npm run build

# Final Stage (runtime)
FROM node:20-alpine
WORKDIR /usr/app
ENV NODE_ENV=production

# Install production deps
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy built artifacts and runtime config
COPY --from=builder /usr/app/dist ./dist
COPY --from=builder /usr/app/config.json ./config.json

# Data directory will be mounted as a volume

# Start the app
CMD [ "node", "dist/main.js" ]