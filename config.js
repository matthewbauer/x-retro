System.config({
  "transpiler": "traceur",
  "paths": {
    "*": "*.js",
    "github:*": "jspm_packages/github/*.js",
    "npm:*": "jspm_packages/npm/*.js"
  },
  "defaultJSExtensions": true
});

System.config({
  "map": {
    "coffee": "github:forresto/system-coffee@0.1.2",
    "gambatte": "npm:gambatte@0.3.3",
    "jszip": "github:stuk/jszip@2.5.0",
    "keypad": "github:matthewbauer/keypad@0.0.2",
    "snes9x-next": "npm:snes9x-next@0.3.3",
    "traceur": "github:jmcriffey/bower-traceur@0.0.88",
    "traceur-runtime": "github:jmcriffey/bower-traceur-runtime@0.0.88",
    "vba-next": "npm:vba-next@0.3.3",
    "vecx": "npm:vecx@0.3.3"
  }
});

