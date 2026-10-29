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

MEDIABUNNY_VERSION="1.64.0"
GIFJS_VERSION="0.2.0"

# name|url|sha256
LIBS=(
    "mediabunny.js|https://cdn.jsdelivr.net/npm/mediabunny@${MEDIABUNNY_VERSION}/+esm|19da9cf5d6d1dcf559a808fc4332d5a1a9cb8d3720cb4e887f9525e982b5bf71"
    "mediabunny-mp3-encoder.js|https://cdn.jsdelivr.net/npm/@mediabunny/mp3-encoder@${MEDIABUNNY_VERSION}/+esm|1960703da08610d7c1b7423a0b37569cab816c555e0abf8fdb4c6b4bc094e594"
    "mediabunny-ac3.js|https://cdn.jsdelivr.net/npm/@mediabunny/ac3@${MEDIABUNNY_VERSION}/+esm|e9b2ae567b5b5d23a72ce5e09b788efde1f53b396338cd67f3ec0a0be4d745d1"
    "mediabunny-flac-encoder.js|https://cdn.jsdelivr.net/npm/@mediabunny/flac-encoder@${MEDIABUNNY_VERSION}/+esm|fb5e1552adc6e6f30bf1bdff4b2c3a993a09b072ac7e686f064d63f52c625b2d"
    "mediabunny-aac-encoder.js|https://cdn.jsdelivr.net/npm/@mediabunny/aac-encoder@${MEDIABUNNY_VERSION}/+esm|faadc1903b5cc00674087da47cd3cc28d7172569cd8ab9f06e7e758c8ed7edec"
    "mediabunny-prores.js|https://cdn.jsdelivr.net/npm/@mediabunny/prores@${MEDIABUNNY_VERSION}/+esm|1f7792e2d79414c70031643835fe75c38063afac1632a76ad4f7bd9e8c50ef0f"
    "mediabunny-dts.js|https://cdn.jsdelivr.net/npm/@mediabunny/dts@${MEDIABUNNY_VERSION}/+esm|b027774acab64ab2ce925a4f87c5a1f85b7593dfc4e6e120751ceca658b5e8f6"
    "mediabunny-truehd.js|https://cdn.jsdelivr.net/npm/@mediabunny/truehd@${MEDIABUNNY_VERSION}/+esm|837730e1eb3403eb375392ee1751d14ff15d0ef4e5a999719d14a84e54dc60d4"
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
