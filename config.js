System.config({
  defaultJSExtensions: true,
  transpiler: "traceur",
  paths: {
    "github:*": "jspm_packages/github/*",
    "npm:*": "jspm_packages/npm/*"
  },
  bundles: {
    "build.js": [
      "index.coffee!github:forresto/system-coffee@0.1.2",
      "github:stuk/jszip@2.5.0",
      "github:matthewbauer/keypad@0.0.2",
      "github:satazor/sparkmd5@1.0.0",
      "x-retro.js",
      "github:matthewbauer/keypad@0.0.2/index",
      "github:satazor/sparkmd5@1.0.0/spark-md5",
      "github:stuk/jszip@2.5.0/dist/jszip",
      "github:matthewbauer/window@0.0.3",
      "github:matthewbauer/document@0.0.4",
      "player.coffee!github:forresto/system-coffee@0.1.2",
      "github:matthewbauer/document@0.0.4/document",
      "github:matthewbauer/window@0.0.3/window",
      "github:webcomponents/webcomponentsjs@0.7.12",
      "github:mohayonao/web-audio-api-shim@0.3.0",
      "github:webcomponents/webcomponentsjs@0.7.12/webcomponents-lite",
      "github:mohayonao/web-audio-api-shim@0.3.0/build/web-audio-api-shim"
    ],
    "build-snes9x-next.js": [
      "npm:snes9x-next@0.4.6",
      "npm:snes9x-next@0.4.6/retro",
      "npm:snes9x-next@0.4.6/core"
    ],
    "build-vba-next.js": [
      "npm:vba-next@0.4.6",
      "npm:vba-next@0.4.6/retro",
      "npm:vba-next@0.4.6/core"
    ],
    "build-nestopia.js": [
      "npm:nestopia@0.4.6",
      "npm:nestopia@0.4.6/retro",
      "npm:nestopia@0.4.6/core"
    ],
    "build-vecx.js": [
      "npm:vecx@0.4.6",
      "npm:vecx@0.4.6/retro",
      "npm:vecx@0.4.6/core"
    ],
    "build-gambatte.js": [
      "npm:gambatte@0.4.6",
      "npm:gambatte@0.4.6/retro",
      "npm:gambatte@0.4.6/core"
    ],
    "build-gw.js": [
      "npm:gw@0.4.6",
      "npm:gw@0.4.6/retro",
      "npm:gw@0.4.6/core"
    ]
  },

  map: {
    "coffee": "github:forresto/system-coffee@0.1.2",
    "document": "github:matthewbauer/document@0.0.4",
    "gambatte": "npm:gambatte@0.4.6",
    "gw": "npm:gw@0.4.6",
    "jszip": "github:stuk/jszip@2.5.0",
    "keypad": "github:matthewbauer/keypad@0.0.2",
    "nestopia": "npm:nestopia@0.4.6",
    "raw": "github:matthewbauer/plugin-raw@0.3.1",
    "snes9x-next": "npm:snes9x-next@0.4.6",
    "sparkmd5": "github:satazor/sparkmd5@1.0.0",
    "traceur": "github:jmcriffey/bower-traceur@0.0.91",
    "traceur-runtime": "github:jmcriffey/bower-traceur-runtime@0.0.91",
    "vba-next": "npm:vba-next@0.4.6",
    "vecx": "npm:vecx@0.4.6",
    "window": "github:matthewbauer/window@0.0.3",
    "github:matthewbauer/document@0.0.4": {
      "webcomponentsjs": "github:webcomponents/webcomponentsjs@0.7.12"
    },
    "github:matthewbauer/plugin-raw@0.3.1": {
      "fetch": "github:github/fetch@0.9.0",
      "fs": "github:jspm/nodelibs-fs@0.1.2"
    },
    "github:matthewbauer/window@0.0.3": {
      "web-audio-api-shim": "github:mohayonao/web-audio-api-shim@0.3.0"
    }
  }
});
