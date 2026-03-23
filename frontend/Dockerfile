### Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci --prefer-offline
COPY . .
RUN npm run build

### Stage 2: Serve
FROM nginx:1.25-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ || exit 1
