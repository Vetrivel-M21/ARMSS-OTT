# ----------------------------------------------------
# ARMSS-OTT Frontend Production Build Stage
# ----------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Accept build argument for API URL & Google Client ID
ARG VITE_API_BASE_URL=http://localhost:8090/api
ARG VITE_GOOGLE_CLIENT_ID=91550463965-0lmm9iu9h5fes5i3lh7qhme986s4va6u.apps.googleusercontent.com
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ENV NITRO_PRESET=node-server

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci || npm install --legacy-peer-deps

# Copy source files
COPY . .

# Build production SSR assets
RUN npm run build

# ----------------------------------------------------
# Production Node Server Stage
# ----------------------------------------------------
FROM node:22-alpine

WORKDIR /app

# Copy compiled standalone output from builder
COPY --from=builder /app/.output ./.output

ENV PORT=8091 \
    NODE_ENV=production

EXPOSE 8091

CMD ["node", ".output/server/index.mjs"]
