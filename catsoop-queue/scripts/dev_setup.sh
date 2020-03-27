#!/bin/sh

root=$(git rev-parse --show-toplevel)
src="$root/git_hooks"
dest="$root/.git/hooks"
for hook in $(ls $src); do
    cp -iv "$src/$hook" "$dest/$hook"
done

npm install
