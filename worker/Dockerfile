# Background worker image (merge + transcribe)

FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app

# Run as the unprivileged "node" user instead of root
RUN chown node:node /app
USER node

# Install production dependencies only.
# ffmpeg-static downloads an ffmpeg binary for the image's platform here,
# which is why node_modules from your laptop must never be copied in.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

# Call node directly (not "npm start") so the process receives SIGTERM
# when ECS stops the container.
CMD ["node", "src/index.js"]
