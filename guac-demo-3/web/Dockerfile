FROM nginx:alpine

# Copy our HTML
COPY index.html /usr/share/nginx/html/

# Download guacamole-common-js from Apache WAR file
RUN apk add --no-cache curl unzip && \
    curl -fsSL "https://downloads.apache.org/guacamole/1.5.5/binary/guacamole-1.5.5.war" -o /tmp/guac.war && \
    mkdir -p /usr/share/nginx/html/js && \
    unzip -j /tmp/guac.war "guacamole-common-js/all.min.js" -d /usr/share/nginx/html/js && \
    rm /tmp/guac.war && \
    apk del curl unzip
