#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting JellyJump Desktop Build..."

# 1. Build the Web Application
echo "📦 Building Web Application..."
if [ -f "./build.sh" ]; then
    ./build.sh
else
    echo "❌ Error: build.sh not found!"
    exit 1
fi

# 2. Build the Desktop Application
echo "🖥️  Building Desktop Application..."

# Copy build folder to desktop/build
echo "📂 Copying web assets to desktop..."
rm -rf desktop/build
cp -r build desktop/build

cd desktop

# Ensure dependencies are installed
echo "📦 Installing desktop dependencies..."
npm install

# Build Electron App
echo "🔨 Running Electron Build..."
npm run dist

echo "✅ Desktop Build Complete!"
echo "📂 Output: desktop/dist"