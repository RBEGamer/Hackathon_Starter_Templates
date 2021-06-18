FROM node:14

# WOKR DIR
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

# COPY SOURCE
COPY . .
# REMOVE DB DIR
RUN rm -f ./db
RUN mkdir -f ./db

EXPOSE 8080
CMD [ "node", "server.js" ]
