#!/bin/bash

# Create GitHub repository script
echo "Creating GitHub repository..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI not found. Installing..."
    brew install gh
fi

# Authenticate with GitHub
echo "Authenticating with GitHub..."
gh auth login --web --scopes repo

# Create the repository
echo "Creating repository 'localspotlight'..."
gh repo create localspotlight \
  --public \
  --description "LocalSpotlight - AI-powered Google Business Profile management platform" \
  --source=. \
  --push

echo "Repository created successfully!"
echo "You can view it at: https://github.com/jfr956/localspotlight"
