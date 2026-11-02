#!/bin/bash

launcher=/usr/bin/io.github.ziyadin23.sc
target=/opt/SC/io.github.ziyadin23.sc
if [ ! -e "$launcher" ] && [ ! -L "$launcher" ]; then
  ln -s "$target" "$launcher" || exit 1
elif [ ! -L "$launcher" ] || [ "$(readlink "$launcher")" != "$target" ]; then
  printf '%s\n' 'SC left an existing launcher unchanged; use /opt/SC/io.github.ziyadin23.sc.' >&2
fi

if ! { [ -L /proc/self/ns/user ] && unshare --user true; }; then
  chmod 4755 /opt/SC/chrome-sandbox || true
else
  chmod 0755 /opt/SC/chrome-sandbox || true
fi
if hash update-mime-database 2>/dev/null; then update-mime-database /usr/share/mime || true; fi
if hash update-desktop-database 2>/dev/null; then update-desktop-database /usr/share/applications || true; fi
