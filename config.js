System.config({
  "transpiler": "traceur",
  "paths": {
    "*": "*.js",
    "github:*": "jspm_packages/github/*.js",
    "npm:*": "jspm_packages/npm/*.js"
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
    "nestopia": "npm:nestopia@0.4.6",
    "snes9x-next": "npm:snes9x-next@0.4.6",
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

