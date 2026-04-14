# Builder Stage
FROM node:20 AS builder
WORKDIR /usr/app
COPY ./src ./
RUN npm install --omit=dev --no-audit --no-fund

# Final Stage
FROM node:20
ARG NODE_ENV
WORKDIR /usr/app
COPY --from=builder /usr/app/ ./
RUN npm install -g nodemon
EXPOSE 3000
CMD [ "nodemon", "--watch", "config.js", "index.js" ]