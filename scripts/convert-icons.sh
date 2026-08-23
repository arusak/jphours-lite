#!/bin/sh

set -eu

source="public/icon-dark.svg"
background="#140B0A"

for size in 192 512; do
    rsvg-convert \
        --width "$size" \
        --height "$size" \
        "$source" \
        -o "public/icon-${size}.png"

    rsvg-convert \
        --width "$size" \
        --height "$size" \
        --background-color "$background" \
        "$source" \
        -o "public/icon-maskable-${size}.png"
done

rsvg-convert \
    --width 180 \
    --height 180 \
    --background-color "$background" \
    "$source" \
    -o public/apple-touch-icon.png
