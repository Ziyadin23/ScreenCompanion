#!/bin/bash

launcher=/usr/bin/io.github.ziyadin23.sc
target=/opt/SC/io.github.ziyadin23.sc
if [ "$1" = 0 ] && [ -L "$launcher" ] && [ "$(readlink "$launcher")" = "$target" ]; then
  rm "$launcher"
fi
