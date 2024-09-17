FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:20

RUN apt-get update \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    libnss3=2:3.87.1-1 \
    libdbus-1-3=1.14.10-1~deb12u1 \
    libatk1.0-0=2.46.0-5 \
    libatk-bridge2.0-0=2.46.0-5 \
    libgtk-3-0=3.24.38-2~deb12u2 \
    libgbm1=22.3.6-1+deb12u1 \
    libasound2=1.2.8-1+b1 \
    xvfb=2:21.1.7-3+deb12u7 \
    xauth=1:1.1.2-1 \
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/* \
    && wget -qO /bin/hadolint https://github.com/hadolint/hadolint/releases/download/v2.12.0/hadolint-Linux-arm64 \
    && chmod +x /bin/hadolint
