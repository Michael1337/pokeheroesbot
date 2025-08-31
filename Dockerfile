# Use an official Node.js runtime as a parent image
FROM node:22-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install any 'npm' dependencies
RUN npm install --silent

# Copy the current directory contents into the container at /app
COPY . .

# Run the app
CMD [ "npm", "run", "main" ]