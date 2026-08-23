#!/bin/sh

set -eu

source="public/icon-dark.svg"
background="#140B0A"
manifest_icons="public/assets"

mkdir -p "$manifest_icons"

rsvg-convert \
    --width 32 \
    --height 32 \
    "$source" \
    -o public/favicon-32.png

for size in 192 512; do
    rsvg-convert \
        --width "$size" \
        --height "$size" \
        "$source" \
        -o "$manifest_icons/manifest-icon-${size}.png"

    rsvg-convert \
        --width "$size" \
        --height "$size" \
        --background-color "$background" \
        "$source" \
        -o "$manifest_icons/manifest-icon-${size}.maskable.png"
done

rsvg-convert \
    --width 180 \
    --height 180 \
    --background-color "$background" \
    "$source" \
    -o public/apple-touch-icon.png
