#!/bin/sh

jspm bundle --skip-source-maps x-retro + raw + snes9x-next
cat jspm_packages/system.js build.js config.js > build.js
echo 'System.import("x-retro");' >> build.js
