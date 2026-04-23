#!/bin/bash

node js/export.js
node js/metadata.js

mv output/friday_tunes_enriched.json output/friday_tunes.json

node js/themes.js
node js/template.js