#!/bin/bash
ps aux | grep nc | tr -s ' ' | cut -d\  -f 2 | xargs kill
