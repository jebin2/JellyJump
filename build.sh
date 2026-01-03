#!/bin/bash

# This script should resemble smae as this file: .github/workflows/build-deploy.yml without git commit/push only build

set -e  # Exit immediately on error

echo "📦 Installing build tools..."
npm install --save-dev terser clean-css-cli html-minifier-terser

echo "🧹 Cleaning old build..."
rm -rf build
mkdir -p build

echo "🧩 Minifying JavaScript files..."
find . -name "*.js" \
  -not -path "./node_modules/*" \
  -not -path "./build/*" \
  -not -path "./desktop/*" \
  -not -path "./.git/*" | while read file; do

  output_file="build/${file#./}"
  mkdir -p "$(dirname "$output_file")"
  npx terser "$file" --compress --mangle --output "$output_file"
done

echo "🎨 Minifying CSS files..."
find . -name "*.css" \
  -not -path "./node_modules/*" \
  -not -path "./build/*" \
  -not -path "./desktop/*" \
  -not -path "./.git/*" | while read file; do

  output_file="build/${file#./}"
  mkdir -p "$(dirname "$output_file")"
  npx cleancss -o "$output_file" "$file"
done

echo "📄 Minifying HTML files..."
find . -name "*.html" \
  -not -path "./node_modules/*" \
  -not -path "./build/*" \
  -not -path "./desktop/*" \
  -not -path "./.git/*" | while read file; do

  output_file="build/${file#./}"
  mkdir -p "$(dirname "$output_file")"
  npx html-minifier-terser \
    --collapse-whitespace \
    --remove-comments \
    --minify-css true \
    --minify-js true \
    --output "$output_file" \
    "$file"
done

echo "🖼 Copying image and font assets..."
find . \
  \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \
     -o -name "*.gif" -o -name "*.svg" -o -name "*.ico" \
     -o -name "*.woff" -o -name "*.woff2" -o -name "*.ttf" \
     -o -name "*.eot" \) \
  -not -path "./node_modules/*" \
  -not -path "./build/*" \
  -not -path "./desktop/*" \
  -not -path "./.git/*" | while read file; do

  output_file="build/${file#./}"
  mkdir -p "$(dirname "$output_file")"
  cp "$file" "$output_file"
done

echo "✅ Build complete! Output folder: ./build"
