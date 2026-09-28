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

MEDIABUNNY_VERSION="1.60.0"
GIFJS_VERSION="0.2.0"

# name|url|sha256
LIBS=(
    "mediabunny.js|https://cdn.jsdelivr.net/npm/mediabunny@${MEDIABUNNY_VERSION}/+esm|de276ab6bf488c3b13e8a19cb16ed1e23f906e9f17f52db09d2d8d6bc6efdad8"
    "mediabunny-mp3-encoder.js|https://cdn.jsdelivr.net/npm/@mediabunny/mp3-encoder@${MEDIABUNNY_VERSION}/+esm|ea57732adf3538b03fa912d8d32130e67ccb911b54a7bb58815d3fb9379ba312"
    "mediabunny-ac3.js|https://cdn.jsdelivr.net/npm/@mediabunny/ac3@${MEDIABUNNY_VERSION}/+esm|a9285b0dee39d123a66ed22f28d6adef9fdd3eee6c984eb4b6b666434677c334"
    "mediabunny-flac-encoder.js|https://cdn.jsdelivr.net/npm/@mediabunny/flac-encoder@${MEDIABUNNY_VERSION}/+esm|0270c6868198bf9c3cffbbd5da5155f6bb5a1b941746846bf616b1d61e4e3420"
    "mediabunny-aac-encoder.js|https://cdn.jsdelivr.net/npm/@mediabunny/aac-encoder@${MEDIABUNNY_VERSION}/+esm|475d5d9a4fb4d7a8e7dab605e34f7e7cc64cb7d653e6647eb1571023bf44a985"
    "mediabunny-prores.js|https://cdn.jsdelivr.net/npm/@mediabunny/prores@${MEDIABUNNY_VERSION}/+esm|bcec5080b003d09009db8f3a45c01de5ab52ccf0aa2f9ee50c27df37b13d045a"
    "mediabunny-dts.js|https://cdn.jsdelivr.net/npm/@mediabunny/dts@${MEDIABUNNY_VERSION}/+esm|9430de2815c6bfe7aed04e75ff1d5f95f49d5b3f55aa09529423b9b3b1fbf73b"
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
