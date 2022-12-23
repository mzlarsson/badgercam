#!/bin/bash
git fetch

if [ -z "$BADGERCAM_BRANCH" ]
then
BADGERCAM_BRANCH="main"
echo Using default branch $BADGERCAM_BRANCH
else
echo Using custom branch $BADGERCAM_BRANCH
fi

git checkout $BADGERCAM_BRANCH
git pull
pip3 install -r src/requirements.txt
cd src/web
npm install
node index.js
