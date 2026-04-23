#!/bin/bash

rm output/*

node js/export.js
node js/metadata.js
node js/replies.js
node js/themes.js
node js/template.js