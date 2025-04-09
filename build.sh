#!/bin/bash

# Exit on error
set -e

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Function to handle errors
handle_error() {
    log "ERROR: $1"
    exit 1
}

# Start build process
log "Starting build process..."

# Display environment information
log "Node version: $(node -v)"
log "NPM version: $(npm -v)"

# Clean up previous installation
log "Cleaning up previous installation..."
rm -rf node_modules package-lock.json || handle_error "Failed to clean up previous installation"

# Install dependencies
log "Installing dependencies..."
npm ci || handle_error "Failed to install dependencies"

# Build the application
log "Building application..."
npm run build || handle_error "Failed to build application"

log "Build completed successfully!" 