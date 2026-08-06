#!/bin/sh

set -eu

sizes="128 192 512"
source="public/icon-dark.svg"

for size in $sizes; do
    rsvg-convert \
        --width "$size" \
        --height "$size" \
        "$source" \
        -o "public/icon-${size}.png"
done
