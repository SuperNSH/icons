#!/usr/bin/env bash
# Installs the base crate and two sets in a blank app with `nsh add`, type-checks and builds an import of
# each, and checks that a misspelled icon fails. From the checkout: the packages take the base crate from
# crates.io, where this version is not yet.
set -euo pipefail
cd "$(dirname "$0")/.."

root=$PWD

app=$(mktemp -d)
cd "$app"
echo '{ "name": "consumer", "id": "dev.supernsh.consumer", "entry": "App.tsx" }' > nsh.json
cat > App.tsx <<'TSX'
import { mount, View } from "nsh";
import { Icon } from "supernsh-icons";
import { svgMarkup } from "supernsh-icons/markup";
import { logosRust } from "supernsh-icons-logos";
import { lucideHeart } from "supernsh-icons-lucide";

mount(() => <View accessibilityLabel={svgMarkup(lucideHeart)}><Icon icon={lucideHeart} color="#e11d48" label="Like" /><Icon icon={logosRust} /></View>);
TSX
nsh init .
nsh add --path "$root"
nsh add --path "$root/sets/logos"
nsh add --path "$root/sets/lucide"
nsh check
nsh build
sed -i.bak 's/lucideHeart/lucideHeartt/g' App.tsx
if nsh check > check.log 2>&1; then echo "nsh check accepted a misspelled icon" >&2; exit 1; fi
grep -q "lucideHeartt" check.log
