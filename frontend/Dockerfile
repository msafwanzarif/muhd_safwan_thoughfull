FROM node:26-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend frontend
RUN npm ci --workspace frontend --include-workspace-root=false
ARG NUXT_PUBLIC_API_BASE=http://localhost:3000/api/v1
ENV NUXT_PUBLIC_API_BASE=$NUXT_PUBLIC_API_BASE
RUN npm run build -w frontend

FROM node:26-alpine AS runtime
WORKDIR /app
COPY --from=build /app/frontend/.output/public .output/public
COPY frontend/scripts/serve-static.mjs scripts/serve-static.mjs
ENV HOST=0.0.0.0 PORT=3001
USER node
EXPOSE 3001
CMD ["node", "scripts/serve-static.mjs"]
