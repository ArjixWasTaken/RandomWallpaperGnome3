#!/usr/bin/env bash

UUID="randomwallpaper@iflow.space"

# fail on error
set -e

# https://unix.stackexchange.com/a/20325
if [[ $EUID -eq 0 ]]; then
    echo "This script must NOT be run as root" 1>&2
    exit 1
fi

# https://stackoverflow.com/a/246128
SCRIPTDIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)

SRCDIR="$SCRIPTDIR/src"
DESTDIR="$SCRIPTDIR/$UUID"

cd "$SCRIPTDIR" || exit 1

check_command() {
    if ! command -v "$1" &>/dev/null; then
        echo "Please install \"$1\" and make sure it's available in your \$PATH"
        exit 1
    fi
}

# Setup environment
check_command "blueprint-compiler"
check_command "glib-compile-schemas"
check_command "gnome-extensions"
check_command "npm"

# install, config in package.json
npm --silent install

# Delete output directory, everything will be rewritten
rm -r "$DESTDIR" &>/dev/null || true

# Compile UI files
blueprint-compiler batch-compile "$DESTDIR/ui" "$SRCDIR/ui" "$SRCDIR"/ui/*.blp

# TypeScript to JavaScript, config in tsconfig.json
npx --silent tsc

# rewrite imports to gjs own module system
shopt -s globstar nullglob
for file in "$DESTDIR"/**/*.js; do
    # I don't know why these aren't available, they should?
    sed -i -E "s#import \* as (.*) from 'gi://.*';#const \1 = imports.gi.\1;#g" "$file"

    # Libadwaita seems somehow missing from gi://
    sed -i -E "s#import \* as Adw from '@gi/gtk4/adw/adw';#const Adw = imports.gi.Adw;#g" "$file"

    # Special module naming
    sed -i -E "s#import \* as ByteArray from '@gi-types/gjs-environment/legacyModules/byteArray';#const ByteArray = imports.byteArray;#g" "$file"

    # Special cases for extension internal imports, shell
    sed -i -E "s#import \* as ExtensionUtils from '@gi/misc/extensionUtils';#const ExtensionUtils = imports.misc.extensionUtils;#g" "$file"
    sed -i -E "s#import \* as PopupMenu from '@gi/ui/popupMenu';#const PopupMenu = imports.ui.popupMenu;#g" "$file"
    sed -i -E "s#import \* as PanelMenu from '@gi/ui/panelMenu';#const PanelMenu = imports.ui.panelMenu;#g" "$file"
    sed -i -E "s#import \* as Main from '@gi/ui/main';#const Main = imports.ui.main;#g" "$file"

    # all remaining
    sed -i -E "s#import \* as (.*) from '@gi-types/.*';#const \1 = imports.gi.\1;#g" "$file"
done

# extension.js and prefs.js can't be modules (yet) while dynamically loaded by GJS
# https://github.com/microsoft/TypeScript/issues/41567
sed -i -E "s#export \{\};##g" "$DESTDIR/extension.js"

# Format js using the official gjs stylesheet and a few manual quirks
npx --silent eslint --config "$SCRIPTDIR/.eslintrc-gjs.yml" --fix "$DESTDIR/**/*.js"

# Copy non generated files to destdir
mkdir -p "$DESTDIR/schemas/"
cp "$SRCDIR/schemas/org.gnome.shell.extensions.space.iflow.randomwallpaper.gschema.xml" "$DESTDIR/schemas/"
cp "$SRCDIR/metadata.json" "$DESTDIR/"
cp "$SRCDIR/stylesheet.css" "$DESTDIR/"

# pack everything into a sharable zip file
extra_source=()
for file in "$DESTDIR"/*; do
    extra_source+=("--extra-source=$file")
done

gnome-extensions pack --force "${extra_source[@]}" "$DESTDIR"

# the pack command already compiles the schemas but we also want to run from a folder so do it again
glib-compile-schemas "$DESTDIR/schemas"
