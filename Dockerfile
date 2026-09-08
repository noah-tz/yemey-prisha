FROM node:20-alpine

# Security: create non-root user
RUN addgroup -g 1001 -S vestot && \
    adduser -S -u 1001 -G vestot vestot

WORKDIR /app

# Copy package files and install production deps
COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force

# Copy application source
COPY . .

# Create data directory and give ownership to non-root user
RUN mkdir -p /data && chown -R vestot:vestot /data /app

# Switch to non-root user
USER vestot

# Default environment variables
ENV PORT=3000
ENV DB_PATH=/data/vestot.db
ENV NODE_ENV=production

EXPOSE 3000

# Health check (using node to avoid wget temp file issues with read-only fs)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http=require('http');const r=http.get('http://localhost:3000/health',res=>{process.exit(res.statusCode===200?0:1)});r.on('error',()=>process.exit(1));r.setTimeout(4000,()=>process.exit(1))"

CMD ["node", "server.js"]
