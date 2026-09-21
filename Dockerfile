# Build multi-stage: frontend compilato in dist/, backend lo serve staticamente
# (stesso schema di produzione descritto in .claude/rules/dev-workflow.md, dentro un container).

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

ENV NODE_ENV=production
ENV PORT=1969
EXPOSE 1969

# backend/data/ è lo stato applicativo (config.json, fatture, timesheet, mail-outbox):
# va montato come volume esterno, vedi docker-compose.yml.
VOLUME ["/app/backend/data"]

CMD ["node", "src/server.js"]
