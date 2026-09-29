#!/bin/bash
set -e

echo "Starting JellyJump Desktop Build..."

# 1. Build the Web Application with Vite
echo "Building Web Application..."
npm run build

# 2. Copy dist folder to desktop/build
echo "Copying web assets to desktop..."
rm -rf desktop/build
cp -r dist desktop/build

cd desktop

# 3. Ensure dependencies are installed
echo "Installing desktop dependencies..."
npm install

# 4. Rebuild native modules against Electron's Node (required for @mediabunny/server / node-av)
echo "Rebuilding native modules..."
npm run rebuild

# 5. Build Electron App
echo "Running Electron Build..."
npm run dist

echo "Desktop Build Complete!"
echo "Output: desktop/dist"
