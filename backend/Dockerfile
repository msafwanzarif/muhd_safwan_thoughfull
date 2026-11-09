FROM node:26-alpine
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace backend --include-workspace-root=false
COPY backend backend
RUN npm run build
USER node
EXPOSE 3000
CMD ["node", "backend/dist/main.js"]

