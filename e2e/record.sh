#!/usr/bin/env bash
# Run the demo specs, then turn each recording's frames into an optimised GIF.
# Usage: record.sh [spec filter]   (output goes to $GIF_DIR, default ./gifs)
set -euo pipefail

export FRAMES_DIR="${FRAMES_DIR:-/tmp/frames}"
GIF_DIR="${GIF_DIR:-./gifs}"
WIDTH="${GIF_WIDTH:-960}"
FPS="${GIF_FPS:-15}"

rm -rf "$FRAMES_DIR"
mkdir -p "$GIF_DIR"
npx playwright test "$@"

for dir in "$FRAMES_DIR"/*/; do
  name="$(basename "$dir")"
  # Two passes: build a palette from the whole clip, then encode with it.
  ffmpeg -loglevel error -y -f concat -safe 0 -i "$dir/frames.txt" \
    -vf "fps=$FPS,scale=$WIDTH:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
    "/tmp/$name.gif"
  gifsicle -O3 --lossy=25 "/tmp/$name.gif" -o "$GIF_DIR/$name.gif"
  echo "$GIF_DIR/$name.gif  $(du -h "$GIF_DIR/$name.gif" | cut -f1)  $(ls "$dir" | grep -c png) frames"
done
