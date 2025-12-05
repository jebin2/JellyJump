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
curl -L "https://cdn.jsdelivr.net/npm/gif.js@latest/dist/gif.worker.js/+esm" \
     -o "$OUT/gif.worker.js"

echo "All files downloaded into $OUT/"
