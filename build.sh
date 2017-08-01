#!/bin/sh

node --max_old_space_size=4096 ./node_modules/jspm/jspm.js bundle --minify --skip-source-maps x-retro + raw + snes9x-next + gambatte + vba-next + nestopia + gw + vecx bundle.js
cat jspm_packages/system.js bundle.js config.js > build.js
rm bundle.js
echo 'System.import("x-retro");' >> build.js
