System.config({
  "transpiler": "traceur",
  "paths": {
    "*": "*.js",
    "github:*": "jspm_packages/github/*.js",
    "npm:*": "jspm_packages/npm/*.js"
  },
  "bundles": {
    "build": [
      "github:satazor/sparkmd5@1.0.0/spark-md5",
      "github:stuk/jszip@2.5.0/dist/jszip",
      "github:matthewbauer/keypad@0.0.2/index",
      "github:mohayonao/web-audio-api-shim@0.3.0/build/web-audio-api-shim",
      "github:webcomponents/webcomponentsjs@0.7.10/webcomponents-lite",
      "player.coffee!github:forresto/system-coffee@0.1.2",
      "github:satazor/sparkmd5@1.0.0",
      "github:stuk/jszip@2.5.0",
      "github:matthewbauer/keypad@0.0.2",
      "github:mohayonao/web-audio-api-shim@0.3.0",
      "github:webcomponents/webcomponentsjs@0.7.10",
      "github:matthewbauer/window@0.0.3/window",
      "github:matthewbauer/document@0.0.4/document",
      "github:matthewbauer/window@0.0.3",
      "github:matthewbauer/document@0.0.4",
      "x-retro",
      "index.coffee!github:forresto/system-coffee@0.1.2"
    ]
  }
});

System.config({
  "map": {
    "coffee": "github:forresto/system-coffee@0.1.2",
    "document": "github:matthewbauer/document@0.0.4",
    "gambatte": "npm:gambatte@0.4.6",
    "gw": "npm:gw@0.4.6",
    "jszip": "github:stuk/jszip@2.5.0",
    "keypad": "github:matthewbauer/keypad@0.0.2",
    "localforage": "github:mozilla/localforage@master",
    "nestopia": "npm:nestopia@0.4.6",
    "snes9x-next": "npm:snes9x-next@0.4.6",
    "sparkmd5": "github:satazor/sparkmd5@1.0.0",
    "traceur": "github:jmcriffey/bower-traceur@0.0.88",
    "traceur-runtime": "github:jmcriffey/bower-traceur-runtime@0.0.88",
    "vba-next": "npm:vba-next@0.4.6",
    "vecx": "npm:vecx@0.4.6",
    "window": "github:matthewbauer/window@0.0.3",
    "github:matthewbauer/document@0.0.4": {
      "webcomponentsjs": "github:webcomponents/webcomponentsjs@0.7.10"
    },
    "github:matthewbauer/window@0.0.3": {
      "web-audio-api-shim": "github:mohayonao/web-audio-api-shim@0.3.0"
    }
  }
});

