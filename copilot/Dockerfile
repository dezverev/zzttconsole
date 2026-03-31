# Stage 1: Build TypeScript
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npx tsc

# Stage 2: Production (slim, not alpine — SDK native module needs glibc)
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends git openssh-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist dist/
COPY skills/ skills/
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh
ENV NODE_ENV=production
EXPOSE 8080
ENTRYPOINT ["./entrypoint.sh"]
