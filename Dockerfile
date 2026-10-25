FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps
RUN npm ci --ignore-scripts
COPY scripts ./scripts
RUN npm run build
ENV NODE_ENV=production PORT=10000 DATA_DIR=/var/data
EXPOSE 10000
CMD ["node", "scripts/serve-production.mjs"]
