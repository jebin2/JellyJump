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

MEDIABUNNY_VERSION="1.55.2"
GIFJS_VERSION="0.2.0"

# name|url|sha256
LIBS=(
    "mediabunny.js|https://cdn.jsdelivr.net/npm/mediabunny@${MEDIABUNNY_VERSION}/+esm|3e5368c1b28153478ce32fa14234fb5fdd3882c058d9ddc81b70f88c2aec4396"
    "mediabunny-mp3-encoder.js|https://cdn.jsdelivr.net/npm/@mediabunny/mp3-encoder@${MEDIABUNNY_VERSION}/+esm|c71d1b1ac8dd760980d6535270e19bfd0c88ad6ac4417a0d062a03165d015e35"
    "mediabunny-ac3.js|https://cdn.jsdelivr.net/npm/@mediabunny/ac3@${MEDIABUNNY_VERSION}/+esm|188a83af55374b1bb392289d15a5765befa381603b642237d1d26ea3976271fb"
    "mediabunny-flac-encoder.js|https://cdn.jsdelivr.net/npm/@mediabunny/flac-encoder@${MEDIABUNNY_VERSION}/+esm|eaf4d53ca488ef6386450e09a848b31e3f3bae6cbd2b705ba02d172d169eb877"
    "mediabunny-aac-encoder.js|https://cdn.jsdelivr.net/npm/@mediabunny/aac-encoder@${MEDIABUNNY_VERSION}/+esm|9084aa77540b7bdf3f54881b0871620eec603af9a5f3cba205a7eca2421bbdfd"
    "mediabunny-prores.js|https://cdn.jsdelivr.net/npm/@mediabunny/prores@${MEDIABUNNY_VERSION}/+esm|65ee2cfd1f719da1e28096c73370a6bdcd2ae6f1608058898833f0c743bc8d85"
    "mediabunny-dts.js|https://cdn.jsdelivr.net/npm/@mediabunny/dts@${MEDIABUNNY_VERSION}/+esm|4605de9721988c86b37709830de5a57d01fa9729128e5dbb10d11836de4ad6b6"
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
