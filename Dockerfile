FROM ubuntu:18.04

# Keyboard preferences
ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update -y && apt-get install -y keyboard-configuration

# Install tools
RUN apt-get install -y openssh-server git netcat apt-utils curl iproute2 vim

# Install VLC
RUN apt-get install -y vlc

# Install python
RUN apt-get install -y python3 python3-pip

# Install node
RUN curl -sL https://deb.nodesource.com/setup_15.x | bash -
RUN apt-get install -y nodejs

# Create badger user to run as
RUN useradd -ms /bin/bash badger
RUN echo 'badger:password' | chpasswd
RUN usermod -aG sudo badger
USER badger
WORKDIR /home/badger

# Clone repo
RUN git clone https://github.com/mzlarsson/badgercam.git
WORKDIR /home/badger/badgercam

# Install python dependencies
WORKDIR /home/badger/badgercam/src
RUN pip3 install -r requirements.txt

# Install npm dependencies
WORKDIR /home/badger/badgercam/src/web
RUN npm install

# Command to start server
WORKDIR /home/badger/badgercam/src/web
ENTRYPOINT [ "node", "index.js" ]
