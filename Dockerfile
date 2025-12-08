# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy server files
COPY server_modern.js ./
COPY ecosystem.config.js ./
COPY start.sh ./

# Copy necessary directories
COPY public ./public

# Create directories for logs and backups
RUN mkdir -p logs backups temp downloads reports public/uploads/letterheads

# Set permissions
RUN chmod +x start.sh

# Expose port
EXPOSE 3001

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
