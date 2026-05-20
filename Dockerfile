# Stage 1: Install production dependencies
FROM node:20-alpine AS production-dependencies-env
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Create production runner
FROM node:20-alpine
WORKDIR /app

# Set node environment to production
ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json ./

# Copy production node_modules from the first stage
COPY --from=production-dependencies-env /app/node_modules ./node_modules

# Copy source code and files
COPY . .

# Expose the UDP port (specifically as UDP)
EXPOSE 5002/udp

# Set default host to bind inside container and port
ENV UDP_HOST=0.0.0.0
ENV UDP_PORT=5002

# Run the UDP server
CMD ["node", "src/index.js"]
