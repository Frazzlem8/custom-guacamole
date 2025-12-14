# Gateway: guacd + guacamole-lite
# Uses the official guacd image with Node.js added

FROM guacamole/guacd:1.5.5

# Install Node.js and supervisor (Alpine-based image)
USER root
RUN apk add --no-cache nodejs npm supervisor

# Setup guacamole-lite
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY server.js .

# Supervisor to run both guacd and guacamole-lite
COPY supervisord.conf /etc/supervisord.conf

EXPOSE 8080
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
