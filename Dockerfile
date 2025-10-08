# Multi-stage Docker build for Ezé-U Internet Monitor
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci --only=production

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Backend with Ookla CLI
FROM node:18-alpine AS backend

WORKDIR /app

# Install dependencies needed for Ookla Speedtest CLI and ping
RUN apk add --no-cache \
    wget \
    ca-certificates \
    curl \
    iputils \
    bash

# Install Ookla Speedtest CLI
RUN wget -qO- https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-x86_64.tgz | tar xvz -C /usr/local/bin/ \
    && chmod +x /usr/local/bin/speedtest \
    && speedtest --version

# Copy backend package files
COPY backend/package*.json ./backend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --only=production

# Copy backend source
COPY backend/ ./

# Copy built frontend from frontend-builder stage
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

# Create directory for SQLite database
RUN mkdir -p /app/backend/data

# Accept Ookla licenses automatically
RUN speedtest --accept-license --accept-gdpr || true

# Expose port
EXPOSE 8745

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8745

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8745/api/status || exit 1

# Start the application
CMD ["node", "server.js"]
