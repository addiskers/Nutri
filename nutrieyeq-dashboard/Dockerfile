# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ARG VITE_API_URL
RUN [ -n "$VITE_API_URL" ] || (echo 'ERROR: VITE_API_URL build arg is required (e.g. --build-arg VITE_API_URL=https://nutrieyeq.zyduswellness.com/api)' >&2 && exit 1)
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: Serve with nginx (unprivileged)
FROM nginxinc/nginx-unprivileged:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
