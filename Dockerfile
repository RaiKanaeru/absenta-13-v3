# ========================================
# Build Stage - Compile frontend
# ========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./

# Install ALL dependencies (with retry tuning)
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 120000 \
    && npm ci --legacy-peer-deps --no-audit --no-fund

# Copy source code
COPY . .

# Build frontend
ENV NODE_ENV=production
RUN npm run build

# ========================================
# Production Stage
# ========================================
FROM node:20-alpine AS production

LABEL maintainer="ABSENTA 13"
LABEL version="1.0"

WORKDIR /app

# Install runtime dependencies and PM2
RUN apk add --no-cache wget curl tzdata \
    && cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime \
    && echo "Asia/Jakarta" > /etc/timezone \
    && npm install -g pm2

# Copy package files
COPY package*.json ./

# Copy dependencies from builder and prune dev deps
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server entry point
COPY server_modern.js ./
COPY ecosystem.config.cjs ./

# Copy backend folder
COPY backend ./backend

# Copy server folder (includes routes, controllers, middleware, utils, services/system)
COPY server ./server

# Copy scripts folder
COPY scripts ./scripts

# Copy database dumps and seeders (for Database Manager)
COPY database ./database

# Copy src folder (untuk utils, hooks, dll yang diimport server)
COPY --from=builder /app/src ./src

# Copy public assets
COPY public ./public

# Create directories
RUN mkdir -p logs backups temp downloads reports archives public/uploads/letterheads

# Expose port
EXPOSE 3001

# Environment
ENV NODE_ENV=production
ENV PORT=3001
ENV TZ=Asia/Jakarta

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.cjs", "--env", "production"]
