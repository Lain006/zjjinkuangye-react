FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci
COPY frontend frontend
COPY backend backend
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/backend backend
COPY --from=build --chown=node:node /app/frontend/package.json frontend/package.json
COPY --from=build --chown=node:node /app/frontend/dist frontend/dist
USER node
EXPOSE 3001
CMD ["sh", "-c", "npm run migrate && npm run seed && exec node backend/dist/index.js"]
