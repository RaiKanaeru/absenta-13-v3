# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
# Install dependencies including devDependencies (needed for storybook)
RUN npm ci --legacy-peer-deps

COPY . .

# Build Storybook to static files
RUN npm run build-storybook

# Production Stage
FROM nginx:alpine

# Copy static files to Nginx html folder
COPY --from=builder /app/storybook-static /usr/share/nginx/html

# Default Nginx config is fine for static serving on port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
