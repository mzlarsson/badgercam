#!/bin/bash
until vlc --ttl 12 -v --color -I telnet --telnet-password badger; do
    echo "Server 'myserver' crashed with exit code $?.  Respawning.." >&2
    sleep 1
done