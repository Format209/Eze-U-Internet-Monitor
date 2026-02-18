# Multi-stage Docker build for Ezé-U Internet Monitor
# Stage 1: Build frontend
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Configure npm for better reliability
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 300000

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies (omit dev dependencies)
RUN npm ci --omit=dev || npm install --omit=dev

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Backend with Ookla CLI
FROM node:20-slim AS backend

WORKDIR /app

# Install dependencies needed for Ookla Speedtest CLI, ping, and better-sqlite3 compilation
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    curl \
    iputils-ping \
    bash \
    build-essential \
    python3 \
    python3-dev \
    make \
    g++ \
    gnupg \
    apt-transport-https \
    && rm -rf /var/lib/apt/lists/*

# Install Ookla Speedtest CLI using official repository (supports multiple architectures)
RUN curl -s https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.deb.sh | bash \
    && apt-get install -y speedtest \
    && rm -rf /var/lib/apt/lists/* \
    && speedtest --version

# Configure npm for better reliability
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 300000

# Copy backend package files
COPY backend/package*.json ./backend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --omit=dev || npm install --omit=dev

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
ENV NODE_OPTIONS="--max-old-space-size=768"

# Health check (use /api/settings instead of /api/status)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8745/api/settings || exit 1

# Start the application with optimized Node.js flags
CMD ["node", "--max-old-space-size=768", "server.js"]
