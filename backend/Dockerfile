FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY shared/package.json shared/package.json

# No compiled build step: `shared`'s package entrypoint resolves to `.ts`
# source, and the start script runs it directly via `tsx` — so dev
# dependencies (tsx included) must stay installed for the image to run.
RUN npm ci --workspace=backend --workspace=shared

COPY shared/tsconfig.json shared/tsconfig.json
COPY shared/src shared/src
COPY backend/tsconfig.json backend/tsconfig.json
COPY backend/src backend/src

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start", "--workspace=backend"]
