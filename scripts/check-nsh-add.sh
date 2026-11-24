#!/usr/bin/env bash
# Installs the crate in a blank app with `nsh add` and type-checks an import of it. From the checkout,
# not the package: the package takes its sibling crates from crates.io, where this version is not yet.
set -euo pipefail
cd "$(dirname "$0")/.."

package=$PWD/crates/nsh-icons

app=$(mktemp -d)
cd "$app"
echo '{ "name": "consumer", "id": "dev.supernsh.consumer", "entry": "App.tsx" }' > nsh.json
cat > App.tsx <<'TSX'
import { mount, Text } from "nsh";
import * as lib from "supernsh-icons";

mount(() => <Text>{Object.keys(lib).join(",")}</Text>);
TSX
nsh init .
nsh add --path "$package"
nsh check
nsh build
