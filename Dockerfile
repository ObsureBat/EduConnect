# Build stage
FROM node:18-alpine as build

# Install build dependencies
RUN apk add --no-cache python3 make g++ git curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with specific platform
RUN npm install --platform=linux --arch=x64 && \
    npm install @aws-sdk/client-dynamodb @aws-sdk/client-s3 \
    @aws-sdk/client-rekognition @aws-sdk/client-sns \
    @aws-sdk/client-sqs @aws-sdk/client-cloudwatch \
    @aws-sdk/client-chime-sdk-meetings && \
    npm rebuild @rollup/rollup-linux-x64-musl --build-from-source

# Copy application source
COPY . .

# Build the application
ENV NODE_ENV=production
ENV VITE_APP_TITLE="EduConnect"
# Add NODE_OPTIONS to help with builds
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Production stage
FROM nginx:alpine

# Install required packages
RUN apk add --no-cache curl

# Create nginx user if it doesn't exist
RUN adduser -D -H -u 101 -s /sbin/nologin nginx || true

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy AWS configuration files
COPY --from=build /app/.env.production /usr/share/nginx/html/.env.production
COPY --from=build /app/src/config/aws-config.ts /usr/share/nginx/html/config/

# Set correct permissions and create required directories
RUN mkdir -p /var/cache/nginx /var/run/nginx && \
    chmod -R 777 /var/cache/nginx /var/run/nginx /var/log/nginx && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Create volume for logs
VOLUME ["/var/log/nginx"]

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
    CMD curl -f http://localhost/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]