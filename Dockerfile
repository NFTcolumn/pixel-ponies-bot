FROM node:20-alpine

# Install build dependencies for better-sqlite3 and pnpm
RUN apk add --no-cache python3 make g++ && \
    npm install -g pnpm

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (including native build for better-sqlite3)
RUN pnpm install --prod && \
    cd node_modules/better-sqlite3 && \
    npm run build-release

# Copy source code and data
COPY src ./src
COPY data ./data
COPY scripts ./scripts

# Create logs directory
RUN mkdir -p logs

# Create non-root user and set permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001 && \
    chown -R botuser:nodejs /app

USER botuser

# Expose port (not strictly necessary for this bot, but good practice)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check')" || exit 1

# Start the application
CMD ["pnpm", "start"]