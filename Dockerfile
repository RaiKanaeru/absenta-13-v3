# ========================================
# Build Stage - Compile frontend
# ========================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files first (for layer caching)
COPY package*.json ./

# Install ALL dependencies (including dev for build)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build frontend for production
ENV NODE_ENV=production
RUN npm run build

# ========================================
# Production Stage - Runtime only
# ========================================
FROM node:20-alpine AS production

# Labels
LABEL maintainer="ABSENTA 13 <admin@absenta13.my.id>"
LABEL version="1.0"
LABEL description="ABSENTA 13 - Sistem Absensi Digital Modern"

# Set working directory
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    wget \
    curl \
    tzdata \
    && cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime \
    && echo "Asia/Jakarta" > /etc/timezone \
    && apk del tzdata

# Install PM2 globally
RUN npm install -g pm2

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --legacy-peer-deps \
    && npm cache clean --force

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy server and configuration files
COPY server_modern.js ./
COPY ecosystem.config.js ./
COPY start.sh ./

# Copy public assets
COPY public ./public

# Create necessary directories
RUN mkdir -p \
    logs \
    backups \
    temp \
    downloads \
    reports \
    public/uploads/letterheads \
    && chmod -R 755 public/uploads

# Set permissions
RUN chmod +x start.sh

# Create non-root user for better security
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs \
    && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV TZ=Asia/Jakarta

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start application with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
