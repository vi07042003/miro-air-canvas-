# Use an active LTS Node.js image (version 22+)
FROM node:22-slim

WORKDIR /app

# Copy package configurations and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Expose Vite's default dev port
EXPOSE 5173

# Run the Vite dev server with host binding
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
