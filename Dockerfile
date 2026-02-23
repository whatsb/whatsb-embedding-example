# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Cloud Run expects the container to listen on the port provided in $PORT
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
