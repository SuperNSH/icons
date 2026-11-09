#!/usr/bin/env bash
# Compiles every bundled set's generated module, one Cargo feature at a time,
# for shard $1 of $2: a set that generates but does not compile fails here.
set -euo pipefail
shard="$1"
count="$2"
sets=$(sed -n '/# BEGIN GENERATED SETS/,/# END GENERATED SETS/p' crates/nsh-icons/Cargo.toml | grep ' = \[\]' | cut -d' ' -f1)
i=0
for set in $sets; do
  if [ $((i % count)) -eq "$shard" ]; then
    echo "::group::$set"
    cargo check -p supernsh-icons --features "$set"
    echo "::endgroup::"
  fi
  i=$((i + 1))
done
