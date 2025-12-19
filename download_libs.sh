#!/bin/bash

# Create directory if not exists
mkdir -p assets/js/lib

# Define output paths
OUT="assets/js/lib"

echo "Downloading mediabunny.js..."
curl -L "https://cdn.jsdelivr.net/npm/mediabunny@latest/+esm" \
     -o "$OUT/mediabunny.js"

echo "Downloading mediabunny-mp3-encoder.js..."
curl -L "https://cdn.jsdelivr.net/npm/@mediabunny/mp3-encoder@latest/+esm" \
     -o "$OUT/mediabunny-mp3-encoder.js"

echo "Downloading gif.js..."
curl -L "https://cdn.jsdelivr.net/npm/gif.js@latest/+esm" \
     -o "$OUT/gif.js"

echo "Downloading gif.worker.js..."
curl -L "https://cdn.jsdelivr.net/npm/gif.js@latest/dist/gif.worker.js" \
     -o "$OUT/gif.worker.js"

echo "Downloading hls.js..."
curl -L "https://cdn.jsdelivr.net/npm/hls.js@1.6.15/dist/hls.mjs" \
     -o "$OUT/hls.js"

echo "All files downloaded into $OUT/"
