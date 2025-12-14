# Use Ubuntu as base since guacd has complex dependencies
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js and guacd dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    supervisor \
    wget \
    # guacd dependencies
    libcairo2-dev \
    libjpeg-turbo8-dev \
    libpng-dev \
    libtool-bin \
    libossp-uuid-dev \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libswscale-dev \
    freerdp2-dev \
    libpango1.0-dev \
    libssh2-1-dev \
    libtelnet-dev \
    libvncserver-dev \
    libwebsockets-dev \
    libpulse-dev \
    libssl-dev \
    libvorbis-dev \
    libwebp-dev \
    # Build tools
    build-essential \
    autoconf \
    automake \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Build and install guacd from source
ARG GUAC_VERSION=1.5.5
RUN curl -fsSL "https://apache.org/dyn/closer.lua/guacamole/${GUAC_VERSION}/source/guacamole-server-${GUAC_VERSION}.tar.gz?action=download" \
    -o /tmp/guacamole-server.tar.gz \
    && tar -xzf /tmp/guacamole-server.tar.gz -C /tmp \
    && cd /tmp/guacamole-server-${GUAC_VERSION} \
    && autoreconf -fi \
    && ./configure --with-init-dir=/etc/init.d \
    && make \
    && make install \
    && ldconfig \
    && rm -rf /tmp/guacamole-server* /tmp/guacamole-server.tar.gz

WORKDIR /app

# Copy guacamole-lite application
COPY gateway/package.json .
COPY gateway/lib ./lib
COPY gateway/index.js .

# Copy gateway-specific files
COPY gateway/start.js .
COPY gateway/supervisord.conf /etc/supervisor/conf.d/gateway.conf

# Install Node.js dependencies
RUN npm install --production

# Expose ports
EXPOSE 8080 3001

# Use supervisor to run both guacd and guacamole-lite
CMD ["supervisord", "-n"]
