#!/usr/bin/env bash
# The clips the demo plays: drawn by ffmpeg, so nothing in the video belongs
# to anyone else. Written to scripts/demo/out/clips/ (not committed).
#
#   bash scripts/demo/make-clips.sh
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
out="$here/out/clips"
mkdir -p "$out"
font="$root/assets/fonts/SpaceGrotesk-Bold.ttf"
enc=(-c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -r 30 -movflags +faststart)
title() { echo "drawtext=fontfile=$font:text='$1':fontcolor=white@0.92:fontsize=64:x=(w-text_w)/2:y=h-140:shadowcolor=black@0.5:shadowx=3:shadowy=3"; }

# Soft colours drifting: a calm opener.
ffmpeg -y -v error -f lavfi -i "gradients=s=1280x720:r=30:d=24:c0=0x0b3d91:c1=0x00ff88:c2=0xff00ff:c3=0x00d4ff:n=4:speed=0.012:type=radial" \
  -f lavfi -i "sine=frequency=0:d=24" -vf "$(title 'Aurora')" -shortest "${enc[@]}" -c:a aac -b:a 64k "$out/Aurora.mp4"

# A dive into a fractal.
ffmpeg -y -v error -f lavfi -i "mandelbrot=s=1280x720:r=30:start_scale=3:end_scale=0.0005:maxiter=400:outer=normalized_iteration_count" \
  -f lavfi -i "sine=frequency=0:d=24" -t 24 -vf "hue=h=110:s=1.3,$(title 'Fractal Dive')" -shortest "${enc[@]}" -crf 27 -c:a aac -b:a 64k "$out/Fractal Dive.mp4"

# Living cells, tinted to the app's green.
ffmpeg -y -v error -f lavfi -i "life=s=320x180:r=30:mold=10:ratio=0.18:death_color=#0a0a0a:life_color=#00ff88:mold_color=#0d3b2e" \
  -f lavfi -i "sine=frequency=0:d=24" -t 24 -vf "scale=1280x720:flags=neighbor,$(title 'City of Life')" -shortest "${enc[@]}" -c:a aac -b:a 64k "$out/City of Life.mp4"

ls -la "$out"
