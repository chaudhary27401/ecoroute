# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage - use nginx
FROM nginx:alpine

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built React app from builder
COPY --from=builder /app/dist /app/dist

# Expose port
EXPOSE 5173

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
