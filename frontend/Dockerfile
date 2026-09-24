FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json

RUN npm ci --workspace=frontend --workspace=shared

COPY shared/tsconfig.json shared/tsconfig.json
COPY shared/src shared/src
COPY frontend/tsconfig.json frontend/tsconfig.json
COPY frontend/tsconfig.app.json frontend/tsconfig.app.json
COPY frontend/tsconfig.node.json frontend/tsconfig.node.json
COPY frontend/vite.config.ts frontend/vite.config.ts
COPY frontend/index.html frontend/index.html
COPY frontend/public frontend/public
COPY frontend/src frontend/src

# Same-origin build so the browser's Socket.IO connection routes through
# Nginx's /socket.io/ proxy — see useBuildingSocket.ts's resolveBackendUrl().
ENV VITE_BACKEND_URL=""
RUN npm run build --workspace=frontend

FROM nginx:1.30-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
