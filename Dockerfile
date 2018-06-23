FROM node:10

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN apt-get update

# PuzzleScript requires sound
RUN apt-get install -y libasound2-dev

# Install packages
RUN npm install

# Bundle app source
COPY . .

RUN echo "pcm.!default = null;" > /etc/asound.conf

RUN echo "you can shell into this machine and run ./bin/puzzlescript.js but while colors work, ANSI positions do not so you cannot actually play the games"

CMD [ "npm", "start" ]