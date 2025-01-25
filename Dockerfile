# Use an official Node.js image as the base
FROM node:22

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Copy the entire application code
COPY ./js ./js
COPY ./css ./css
COPY ./modules ./modules
COPY ./fonts ./fonts

RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxss1 \
    libxcomposite1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    libgbm1 \
    dbus \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
RUN npm install

# Expose any required ports (e.g., for the server)
EXPOSE 8080
# Adjust if your server uses a different port


CMD ["xvfb-run", "--server-args='-screen 0 1024x768x24'", "npm", "run", "mirrorClient"]

# Define a default command (can be overridden by Docker Compose)
CMD ["npm", "run", "server"]


