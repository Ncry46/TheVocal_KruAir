FROM node:22-bookworm-slim AS web

WORKDIR /repo
COPY frontend/package.json frontend/package-lock.json ./frontend/
WORKDIR /repo/frontend
RUN npm ci

WORKDIR /repo
COPY frontend ./frontend
COPY components ./components
COPY assets ./assets
COPY data ./data
COPY . .
WORKDIR /repo/frontend
RUN npm run build

FROM node:22-bookworm-slim

WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --omit=optional
COPY backend/src ./src
COPY backend/.env ./.env
COPY --from=web /repo/frontend/dist ./public

ENV NODE_ENV=production
ENV SQL_CLIENT=tedious
ENV PORT=3000
ENV HOST=0.0.0.0
ENV SQL_SERVER=tvsdb2.thanvasupos.com,28914
ENV SQL_DATABASE=BD_AIR
ENV SQL_USER=uinet
ENV SQL_ENCRYPT=Yes
ENV SQL_TRUST_CERT=Yes
ENV FRONTEND_ORIGIN=https://kruair.thanvasupos.com
ENV LINE_CALLBACK_URL=https://kruair.thanvasupos.com/api/auth/line/callback
ENV GOOGLE_REDIRECT_URI=https://kruair.thanvasupos.com/api/teacher/google/callback

EXPOSE 3000

CMD ["node", "src/index.js"]
