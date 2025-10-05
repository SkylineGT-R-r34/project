FROM node:18

# Install dependencies
RUN apt-get update && apt-get install -y \
    git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
