FROM apify/actor-node-puppeteer-chrome:16

# Install xvfb frame buffer needed for non-headless Chrome
# The mkdir command should fix the following warning in console when starting a new actor:
# > _XSERVTransmkdir: ERROR: euid != 0,directory /tmp/.X11-unix will not be created
# See https://github.com/apify/apify-actor-docker/issues/22 for details
USER root
COPY package*.json ./

RUN DEBIAN_FRONTEND=noninteractive apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y xvfb \
 && rm -rf /var/lib/apt/lists/* \
 && rm -rf /src/*.deb \
 && mkdir -p /tmp/.X11-unix \
 && chmod 1777 /tmp/.X11-unix
 
RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install apt-file -y && apt-file update && apt-get install vim -y

RUN npm --quiet set progress=false \
 && npm install --only=prod --no-optional \
 && echo "Installed NPM packages:" \
 && (npm list --only=prod --no-optional --all || true) \
 && echo "Node.js version:" \
 && node --version \
 && echo "NPM version:" \
 && npm --version

# Run everything after as non-privileged user.
# USER myuser
WORKDIR /home/myuser

# Copy source code
COPY . ./
COPY --chown=myuser:myuser start_xvfb_and_run_cmd.sh /home/myuser/

# Set up xvfb
ENV DISPLAY=:98
ENV XVFB_WHD=1280x720x16
ENV APIFY_XVFB=1

# NOTEs:
# - This needs to be compatible with CLI.
# - Using CMD instead of ENTRYPOINT, to allow manual overriding
ENTRYPOINT ["/bin/bash", "./start_xvfb_and_run_cmd.sh"]
CMD ["npm", "start", "--silent"]
