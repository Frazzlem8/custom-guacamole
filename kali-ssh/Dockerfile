# Use the official Kali Linux base image
FROM kalilinux/kali-rolling

# Set working directory to /root
WORKDIR /root

# Update the package lists and install the core kali linux packages
RUN apt update && DEBIAN_FRONTEND=noninteractive apt install -y wget kali-linux-core nano

# Copy over FraseLabs Banner
COPY Banner /etc/banner
COPY Banner /etc/motd
RUN cd /etc/update-motd.d/ && rm -rf *

# Configure SSH to allow password authentication
RUN sed -i 's/PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#Banner none/Banner \/etc\/banner/' /etc/ssh/sshd_config

# Enable SSH server
RUN service ssh start

# SSH
EXPOSE 22

# Grant sudo privileges to user 'kali'
RUN echo 'kali ALL=(ALL:ALL) NOPASSWD: ALL' > /etc/sudoers.d/kali

# Add user and set password
RUN useradd -m -s /bin/bash kali \
    && echo 'kali:kali' | chpasswd

# Copy script over
COPY entrypoint.sh /entrypoint.sh

# Make the entrypoint.sh script executable
RUN chmod +x /entrypoint.sh

# Run this command on launch
ENTRYPOINT [ "/entrypoint.sh" ]

# docker build -t kali-ssh .