#!/bin/bash
# Downloads the vendored browser libraries with pinned versions and verifies
# their SHA-256 hashes, so a compromised or regenerated CDN artifact can never
# silently land in the repo.
#
# Usage:
#   ./download_libs.sh           download all libs and verify hashes
#   ./download_libs.sh verify    only verify the files already in assets/js/lib
#
# Upgrading a library:
#   1. Bump its version below and run ./download_libs.sh
#   2. The hash check will fail; inspect the diff of the downloaded file
#      (left in <name>.new next to the target) to confirm it is legitimate
#   3. Paste the printed new hash into HASHES below and re-run
#
# Note: jsDelivr /+esm bundles are generated artifacts. If jsDelivr rebuilds a
# bundle with a newer bundler, the hash changes even for the same package
# version — that is exactly the kind of change a human should look at.

set -euo pipefail

OUT="assets/js/lib"
mkdir -p "$OUT"

MEDIABUNNY_VERSION="1.61.1"
GIFJS_VERSION="0.2.0"

# name|url|sha256
LIBS=(
    "mediabunny.js|https://cdn.jsdelivr.net/npm/mediabunny@${MEDIABUNNY_VERSION}/+esm|14b7292dd1df8ba5373d5d8f30f93b35c3a6de39f99a0b20491bec3a4fff54bb"
    "mediabunny-mp3-encoder.js|https://cdn.jsdelivr.net/npm/@mediabunny/mp3-encoder@${MEDIABUNNY_VERSION}/+esm|4c460f08c6d8d19332b10effeb03193d6258718313eefe93598f1e4f8bac5a2e"
    "mediabunny-ac3.js|https://cdn.jsdelivr.net/npm/@mediabunny/ac3@${MEDIABUNNY_VERSION}/+esm|6423509ce1b2ea42e7e2d38a26ef10c7203b724900c119a99300d22055d5ff74"
    "mediabunny-flac-encoder.js|https://cdn.jsdelivr.net/npm/@mediabunny/flac-encoder@${MEDIABUNNY_VERSION}/+esm|be763d4be6c3285c78a69329ba627dc59df3187a55042de35b70662b40b1e5fe"
    "mediabunny-aac-encoder.js|https://cdn.jsdelivr.net/npm/@mediabunny/aac-encoder@${MEDIABUNNY_VERSION}/+esm|66c597468cbba653ddf3acf9c9c4666b66d6de7154f002b05204fdbbc7b6e3f0"
    "mediabunny-prores.js|https://cdn.jsdelivr.net/npm/@mediabunny/prores@${MEDIABUNNY_VERSION}/+esm|abc6dfca1c9f9436a83f6478f2062e6fc4ad405fabc3be80efb1cb2b1c630f0c"
    "mediabunny-dts.js|https://cdn.jsdelivr.net/npm/@mediabunny/dts@${MEDIABUNNY_VERSION}/+esm|5484cd168344eb433f8c2c50245622d0737e990154ac4569a2f6f2ac5b65671c"
    "gif.js|https://cdn.jsdelivr.net/npm/gif.js@${GIFJS_VERSION}/+esm|f9396fea5aed6ddfc7dfba99fb3cb0cc1940a5d3dc0626d8d5bc2d13c7605dc7"
    "gif.worker.js|https://cdn.jsdelivr.net/npm/gif.js@${GIFJS_VERSION}/dist/gif.worker.js|ca9e3048557ec05d619e18b83403cd3669c88939e5fa2d6034ce7625d445970d"
)

actual_hash() {
    sha256sum "$1" | cut -d' ' -f1
}

failures=0

verify_only() {
    for entry in "${LIBS[@]}"; do
        IFS='|' read -r name _url expected <<< "$entry"
        target="$OUT/$name"
        if [ ! -f "$target" ]; then
            echo "MISSING  $name"
            failures=$((failures + 1))
            continue
        fi
        actual=$(actual_hash "$target")
        if [ "$actual" = "$expected" ]; then
            echo "OK       $name"
        else
            echo "MISMATCH $name"
            echo "         expected: $expected"
            echo "         actual:   $actual"
            failures=$((failures + 1))
        fi
    done
}

download_all() {
    for entry in "${LIBS[@]}"; do
        IFS='|' read -r name url expected <<< "$entry"
        target="$OUT/$name"
        tmp="$target.new"

        echo "Downloading $name..."
        curl -fsSL "$url" -o "$tmp"

        actual=$(actual_hash "$tmp")
        if [ "$actual" = "$expected" ]; then
            mv "$tmp" "$target"
            echo "OK       $name"
        else
            echo "MISMATCH $name (downloaded file kept at $tmp for inspection)"
            echo "         expected: $expected"
            echo "         actual:   $actual"
            failures=$((failures + 1))
        fi
    done

    # Documentation only (not executable code, changes upstream frequently):
    echo "Downloading mediabunny-llms-full.txt..."
    curl -fsSL "https://mediabunny.dev/llms-full.txt" -o "medibunny-llms-full.txt" || true
}

if [ "${1:-}" = "verify" ]; then
    verify_only
else
    download_all
fi

if [ "$failures" -gt 0 ]; then
    echo ""
    echo "FAILED: $failures file(s) did not match their pinned hash."
    exit 1
fi

echo ""
echo "All libraries verified against pinned hashes."
