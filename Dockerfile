FROM node:14-alpine

WORKDIR /usr/src/app

# Install dependencies
RUN apk add --no-cache git
COPY package*.json ./
RUN npm ci

# Copy sources
COPY . .

# Run
EXPOSE 8080
CMD [ "npm", "start" ]
