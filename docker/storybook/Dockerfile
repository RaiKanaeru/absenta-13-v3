# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build Storybook to static files
RUN npm run build-storybook

# Production Stage
FROM nginx:alpine

# Copy built static files to Nginx
COPY --from=builder /app/storybook-static /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
