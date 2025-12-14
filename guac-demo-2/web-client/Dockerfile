FROM nginx:alpine
ARG GUAC_VERSION=1.5.5

COPY html /usr/share/nginx/html

RUN apk add --no-cache curl unzip

# Download guacamole-common-js from Apache
RUN curl -fsSL "https://downloads.apache.org/guacamole/${GUAC_VERSION}/binary/guacamole-${GUAC_VERSION}.war" \
      -o /tmp/guac.war

# Extract JavaScript bundles
RUN mkdir -p /usr/share/nginx/html/js && \
    unzip -j /tmp/guac.war \
      "guacamole-common-js/all.js" \
      "guacamole-common-js/all.min.js" \
      -d /usr/share/nginx/html/js && \
    rm /tmp/guac.war
