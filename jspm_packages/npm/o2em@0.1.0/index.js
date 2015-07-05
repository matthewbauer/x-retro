/* */ 
(function(Buffer, process) {
  var ENVIRONMENT_IS_WEB = true;
  var ENVIRONMENT_IS_NODE = false;
  var ENVIRONMENT_IS_SHELL = false;
  var Module = {
    "print": (function() {}),
    "printErr": (function() {}),
    "get_system_info": (function() {
      var _data = Module._malloc(14);
      Module._retro_get_system_info(_data);
      var obj = {
        library_name: Module.Pointer_stringify(Module.getValue(_data, "*")),
        library_version: Module.Pointer_stringify(Module.getValue(_data + 4, "*")),
        valid_extensions: Module.Pointer_stringify(Module.getValue(_data + 8, "*")),
        need_fullpath: Module.getValue(_data + 12, "i8") > 0,
        block_extract: Module.getValue(_data + 13, "i8") > 0
      };
      Module._free(_data);
      return obj;
    }),
    "get_system_av_info": (function() {
      var _data = Module._malloc(40);
      Module._retro_get_system_av_info(_data);
      var obj = {
        geometry: {
          base_width: Module.getValue(_data, "i32"),
          base_height: Module.getValue(_data + 4, "i32"),
          max_width: Module.getValue(_data + 8, "i32"),
          max_height: Module.getValue(_data + 12, "i32"),
          aspect_ratio: Module.getValue(_data + 16, "float")
        },
        timing: {
          fps: Module.getValue(_data + 24, "double"),
          sample_rate: Module.getValue(_data + 32, "double")
        }
      };
      Module._free(_data);
      return obj;
    }),
    "serialize": (function() {
      var size = Module.serialize_size();
      var _data = Module._malloc(size);
      var result = Module._retro_serialize(_data, size);
      var data = false;
      if (result) {
        data = new Uint8Array(Module.HEAP8.buffer, _data, size);
      }
      return data;
    }),
    "unserialize": (function(data) {
      var _data = Module._malloc(data.length);
      (new Uint8Array(Module.HEAP8.buffer, _data, data.length)).set(data);
      var result = Module._retro_unserialize(_data, data.length);
      return result;
    }),
    "cheat_set": (function(index, enabled, code) {
      var _code = Module._malloc(code.length);
      Module.writeStringToMemory(code, _code);
      Module._retro_cheat_set(index, enabled, _code);
    }),
    "load_game": (function(info) {
      var _info = Module._malloc(16);
      if (info.path) {
        var path = Module._malloc(info.path.length + 1);
        Module.writeStringToMemory(info.path, path);
        Module.setValue(_info, path, "*");
      }
      if (info.meta) {
        var meta = Module._malloc(info.meta.length + 1);
        Module.writeStringToMemory(info.meta, meta);
        Module.setValue(_info + 12, meta, "*");
      }
      var _data = Module._malloc(info.data.length);
      (new Uint8Array(Module.HEAP8.buffer, _data, info.data.length)).set(info.data);
      Module.setValue(_info + 4, _data, "*");
      Module.setValue(_info + 8, info.data.length, "i32");
      var result = Module._retro_load_game(_info);
      return result;
    }),
    "get_memory_data": (function(id) {
      return new Uint8Array(Module.HEAP8.buffer, Module._retro_get_memory_data(id), Module.get_memory_size(id));
    })
  };
  var Runtime = {
    setTempRet0: (function(value) {
      tempRet0 = value;
    }),
    getTempRet0: (function() {
      return tempRet0;
    }),
    stackSave: (function() {
      return STACKTOP;
    }),
    stackRestore: (function(stackTop) {
      STACKTOP = stackTop;
    }),
    getNativeTypeSize: (function(type) {
      switch (type) {
        case "i1":
        case "i8":
          return 1;
        case "i16":
          return 2;
        case "i32":
          return 4;
        case "i64":
          return 8;
        case "float":
          return 4;
        case "double":
          return 8;
        default:
          {
            if (type[type.length - 1] === "*") {
              return Runtime.QUANTUM_SIZE;
            } else if (type[0] === "i") {
              var bits = parseInt(type.substr(1));
              assert(bits % 8 === 0);
              return bits / 8;
            } else {
              return 0;
            }
          }
      }
    }),
    getNativeFieldSize: (function(type) {
      return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
    }),
    STACK_ALIGN: 16,
    prepVararg: (function(ptr, type) {
      if (type === "double" || type === "i64") {
        if (ptr & 7) {
          assert((ptr & 7) === 4);
          ptr += 4;
        }
      } else {
        assert((ptr & 3) === 0);
      }
      return ptr;
    }),
    getAlignSize: (function(type, size, vararg) {
      if (!vararg && (type == "i64" || type == "double"))
        return 8;
      if (!type)
        return Math.min(size, 8);
      return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
    }),
    dynCall: (function(sig, ptr, args) {
      if (args && args.length) {
        if (!args.splice)
          args = Array.prototype.slice.call(args);
        args.splice(0, 0, ptr);
        return Module["dynCall_" + sig].apply(null, args);
      } else {
        return Module["dynCall_" + sig].call(null, ptr);
      }
    }),
    functionPointers: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    addFunction: (function(func) {
      for (var i = 0; i < Runtime.functionPointers.length; i++) {
        if (!Runtime.functionPointers[i]) {
          Runtime.functionPointers[i] = func;
          return 2 * (1 + i);
        }
      }
      throw "Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.";
    }),
    removeFunction: (function(index) {
      Runtime.functionPointers[(index - 2) / 2] = null;
    }),
    warnOnce: (function(text) {
      if (!Runtime.warnOnce.shown)
        Runtime.warnOnce.shown = {};
      if (!Runtime.warnOnce.shown[text]) {
        Runtime.warnOnce.shown[text] = 1;
        Module.printErr(text);
      }
    }),
    funcWrappers: {},
    getFuncWrapper: (function(func, sig) {
      assert(sig);
      if (!Runtime.funcWrappers[sig]) {
        Runtime.funcWrappers[sig] = {};
      }
      var sigCache = Runtime.funcWrappers[sig];
      if (!sigCache[func]) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, arguments);
        };
      }
      return sigCache[func];
    }),
    getCompilerSetting: (function(name) {
      throw "You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work";
    }),
    stackAlloc: (function(size) {
      var ret = STACKTOP;
      STACKTOP = STACKTOP + size | 0;
      STACKTOP = STACKTOP + 15 & -16;
      return ret;
    }),
    staticAlloc: (function(size) {
      var ret = STATICTOP;
      STATICTOP = STATICTOP + size | 0;
      STATICTOP = STATICTOP + 15 & -16;
      return ret;
    }),
    dynamicAlloc: (function(size) {
      var ret = DYNAMICTOP;
      DYNAMICTOP = DYNAMICTOP + size | 0;
      DYNAMICTOP = DYNAMICTOP + 15 & -16;
      if (DYNAMICTOP >= TOTAL_MEMORY) {
        var success = enlargeMemory();
        if (!success) {
          DYNAMICTOP = ret;
          return 0;
        }
      }
      return ret;
    }),
    alignMemory: (function(size, quantum) {
      var ret = size = Math.ceil(size / (quantum ? quantum : 16)) * (quantum ? quantum : 16);
      return ret;
    }),
    makeBigInt: (function(low, high, unsigned) {
      var ret = unsigned ? +(low >>> 0) + +(high >>> 0) * +4294967296 : +(low >>> 0) + +(high | 0) * +4294967296;
      return ret;
    }),
    GLOBAL_BASE: 8,
    QUANTUM_SIZE: 4,
    __dummy__: 0
  };
  Module["Runtime"] = Runtime;
  var __THREW__ = 0;
  var ABORT = false;
  var EXITSTATUS = 0;
  var undef = 0;
  var tempValue,
      tempInt,
      tempBigInt,
      tempInt2,
      tempBigInt2,
      tempPair,
      tempBigIntI,
      tempBigIntR,
      tempBigIntS,
      tempBigIntP,
      tempBigIntD,
      tempDouble,
      tempFloat;
  var tempI64,
      tempI64b;
  var tempRet0,
      tempRet1,
      tempRet2,
      tempRet3,
      tempRet4,
      tempRet5,
      tempRet6,
      tempRet7,
      tempRet8,
      tempRet9;
  function assert(condition, text) {
    if (!condition) {
      abort("Assertion failed: " + text);
    }
  }
  var globalScope = this;
  function getCFunc(ident) {
    var func = Module["_" + ident];
    if (!func) {
      try {
        func = eval("_" + ident);
      } catch (e) {}
    }
    assert(func, "Cannot call unknown function " + ident + " (perhaps LLVM optimizations or closure removed it?)");
    return func;
  }
  var cwrap,
      ccall;
  ((function() {
    var JSfuncs = {
      "stackSave": (function() {
        Runtime.stackSave();
      }),
      "stackRestore": (function() {
        Runtime.stackRestore();
      }),
      "arrayToC": (function(arr) {
        var ret = Runtime.stackAlloc(arr.length);
        writeArrayToMemory(arr, ret);
        return ret;
      }),
      "stringToC": (function(str) {
        var ret = 0;
        if (str !== null && str !== undefined && str !== 0) {
          ret = Runtime.stackAlloc((str.length << 2) + 1);
          writeStringToMemory(str, ret);
        }
        return ret;
      })
    };
    var toC = {
      "string": JSfuncs["stringToC"],
      "array": JSfuncs["arrayToC"]
    };
    ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
      var func = getCFunc(ident);
      var cArgs = [];
      var stack = 0;
      if (args) {
        for (var i = 0; i < args.length; i++) {
          var converter = toC[argTypes[i]];
          if (converter) {
            if (stack === 0)
              stack = Runtime.stackSave();
            cArgs[i] = converter(args[i]);
          } else {
            cArgs[i] = args[i];
          }
        }
      }
      var ret = func.apply(null, cArgs);
      if (returnType === "string")
        ret = Pointer_stringify(ret);
      if (stack !== 0) {
        if (opts && opts.async) {
          EmterpreterAsync.asyncFinalizers.push((function() {
            Runtime.stackRestore(stack);
          }));
          return ;
        }
        Runtime.stackRestore(stack);
      }
      return ret;
    };
    var sourceRegex = /^function\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
    function parseJSFunc(jsfunc) {
      var parsed = jsfunc.toString().match(sourceRegex).slice(1);
      return {
        arguments: parsed[0],
        body: parsed[1],
        returnValue: parsed[2]
      };
    }
    var JSsource = {};
    for (var fun in JSfuncs) {
      if (JSfuncs.hasOwnProperty(fun)) {
        JSsource[fun] = parseJSFunc(JSfuncs[fun]);
      }
    }
    cwrap = function cwrap(ident, returnType, argTypes) {
      argTypes = argTypes || [];
      var cfunc = getCFunc(ident);
      var numericArgs = argTypes.every((function(type) {
        return type === "number";
      }));
      var numericRet = returnType !== "string";
      if (numericRet && numericArgs) {
        return cfunc;
      }
      var argNames = argTypes.map((function(x, i) {
        return "$" + i;
      }));
      var funcstr = "(function(" + argNames.join(",") + ") {";
      var nargs = argTypes.length;
      if (!numericArgs) {
        funcstr += "var stack = " + JSsource["stackSave"].body + ";";
        for (var i = 0; i < nargs; i++) {
          var arg = argNames[i],
              type = argTypes[i];
          if (type === "number")
            continue;
          var convertCode = JSsource[type + "ToC"];
          funcstr += "var " + convertCode.arguments + " = " + arg + ";";
          funcstr += convertCode.body + ";";
          funcstr += arg + "=" + convertCode.returnValue + ";";
        }
      }
      var cfuncname = parseJSFunc((function() {
        return cfunc;
      })).returnValue;
      funcstr += "var ret = " + cfuncname + "(" + argNames.join(",") + ");";
      if (!numericRet) {
        var strgfy = parseJSFunc((function() {
          return Pointer_stringify;
        })).returnValue;
        funcstr += "ret = " + strgfy + "(ret);";
      }
      if (!numericArgs) {
        funcstr += JSsource["stackRestore"].body.replace("()", "(stack)") + ";";
      }
      funcstr += "return ret})";
      return eval(funcstr);
    };
  }))();
  Module["cwrap"] = cwrap;
  Module["ccall"] = ccall;
  function setValue(ptr, value, type, noSafe) {
    type = type || "i8";
    if (type.charAt(type.length - 1) === "*")
      type = "i32";
    switch (type) {
      case "i1":
        HEAP8[ptr >> 0] = value;
        break;
      case "i8":
        HEAP8[ptr >> 0] = value;
        break;
      case "i16":
        HEAP16[ptr >> 1] = value;
        break;
      case "i32":
        HEAP32[ptr >> 2] = value;
        break;
      case "i64":
        tempI64 = [value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0)], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
        break;
      case "float":
        HEAPF32[ptr >> 2] = value;
        break;
      case "double":
        HEAPF64[ptr >> 3] = value;
        break;
      default:
        abort("invalid type for setValue: " + type);
    }
  }
  Module["setValue"] = setValue;
  function getValue(ptr, type, noSafe) {
    type = type || "i8";
    if (type.charAt(type.length - 1) === "*")
      type = "i32";
    switch (type) {
      case "i1":
        return HEAP8[ptr >> 0];
      case "i8":
        return HEAP8[ptr >> 0];
      case "i16":
        return HEAP16[ptr >> 1];
      case "i32":
        return HEAP32[ptr >> 2];
      case "i64":
        return HEAP32[ptr >> 2];
      case "float":
        return HEAPF32[ptr >> 2];
      case "double":
        return HEAPF64[ptr >> 3];
      default:
        abort("invalid type for setValue: " + type);
    }
    return null;
  }
  Module["getValue"] = getValue;
  var ALLOC_NORMAL = 0;
  var ALLOC_STACK = 1;
  var ALLOC_STATIC = 2;
  var ALLOC_DYNAMIC = 3;
  var ALLOC_NONE = 4;
  Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
  Module["ALLOC_STACK"] = ALLOC_STACK;
  Module["ALLOC_STATIC"] = ALLOC_STATIC;
  Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
  Module["ALLOC_NONE"] = ALLOC_NONE;
  function allocate(slab, types, allocator, ptr) {
    var zeroinit,
        size;
    if (typeof slab === "number") {
      zeroinit = true;
      size = slab;
    } else {
      zeroinit = false;
      size = slab.length;
    }
    var singleType = typeof types === "string" ? types : null;
    var ret;
    if (allocator == ALLOC_NONE) {
      ret = ptr;
    } else {
      ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
    }
    if (zeroinit) {
      var ptr = ret,
          stop;
      assert((ret & 3) == 0);
      stop = ret + (size & ~3);
      for (; ptr < stop; ptr += 4) {
        HEAP32[ptr >> 2] = 0;
      }
      stop = ret + size;
      while (ptr < stop) {
        HEAP8[ptr++ >> 0] = 0;
      }
      return ret;
    }
    if (singleType === "i8") {
      if (slab.subarray || slab.slice) {
        HEAPU8.set(slab, ret);
      } else {
        HEAPU8.set(new Uint8Array(slab), ret);
      }
      return ret;
    }
    var i = 0,
        type,
        typeSize,
        previousType;
    while (i < size) {
      var curr = slab[i];
      if (typeof curr === "function") {
        curr = Runtime.getFunctionIndex(curr);
      }
      type = singleType || types[i];
      if (type === 0) {
        i++;
        continue;
      }
      if (type == "i64")
        type = "i32";
      setValue(ret + i, curr, type);
      if (previousType !== type) {
        typeSize = Runtime.getNativeTypeSize(type);
        previousType = type;
      }
      i += typeSize;
    }
    return ret;
  }
  Module["allocate"] = allocate;
  function getMemory(size) {
    if (!staticSealed)
      return Runtime.staticAlloc(size);
    if (typeof _sbrk !== "undefined" && !_sbrk.called || !runtimeInitialized)
      return Runtime.dynamicAlloc(size);
    return _malloc(size);
  }
  Module["getMemory"] = getMemory;
  function Pointer_stringify(ptr, length) {
    if (length === 0 || !ptr)
      return "";
    var hasUtf = 0;
    var t;
    var i = 0;
    while (1) {
      t = HEAPU8[ptr + i >> 0];
      hasUtf |= t;
      if (t == 0 && !length)
        break;
      i++;
      if (length && i == length)
        break;
    }
    if (!length)
      length = i;
    var ret = "";
    if (hasUtf < 128) {
      var MAX_CHUNK = 1024;
      var curr;
      while (length > 0) {
        curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
        ret = ret ? ret + curr : curr;
        ptr += MAX_CHUNK;
        length -= MAX_CHUNK;
      }
      return ret;
    }
    return Module["UTF8ToString"](ptr);
  }
  Module["Pointer_stringify"] = Pointer_stringify;
  function AsciiToString(ptr) {
    var str = "";
    while (1) {
      var ch = HEAP8[ptr++ >> 0];
      if (!ch)
        return str;
      str += String.fromCharCode(ch);
    }
  }
  Module["AsciiToString"] = AsciiToString;
  function stringToAscii(str, outPtr) {
    return writeAsciiToMemory(str, outPtr, false);
  }
  Module["stringToAscii"] = stringToAscii;
  function UTF8ArrayToString(u8Array, idx) {
    var u0,
        u1,
        u2,
        u3,
        u4,
        u5;
    var str = "";
    while (1) {
      u0 = u8Array[idx++];
      if (!u0)
        return str;
      if (!(u0 & 128)) {
        str += String.fromCharCode(u0);
        continue;
      }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 224) == 192) {
        str += String.fromCharCode((u0 & 31) << 6 | u1);
        continue;
      }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 240) == 224) {
        u0 = (u0 & 15) << 12 | u1 << 6 | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 248) == 240) {
          u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 252) == 248) {
            u0 = (u0 & 3) << 24 | u1 << 18 | u2 << 12 | u3 << 6 | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = (u0 & 1) << 30 | u1 << 24 | u2 << 18 | u3 << 12 | u4 << 6 | u5;
          }
        }
      }
      if (u0 < 65536) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 65536;
        str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
      }
    }
  }
  Module["UTF8ArrayToString"] = UTF8ArrayToString;
  function UTF8ToString(ptr) {
    return UTF8ArrayToString(HEAPU8, ptr);
  }
  Module["UTF8ToString"] = UTF8ToString;
  function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
    if (!(maxBytesToWrite > 0))
      return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i = 0; i < str.length; ++i) {
      var u = str.charCodeAt(i);
      if (u >= 55296 && u <= 57343)
        u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
      if (u <= 127) {
        if (outIdx >= endIdx)
          break;
        outU8Array[outIdx++] = u;
      } else if (u <= 2047) {
        if (outIdx + 1 >= endIdx)
          break;
        outU8Array[outIdx++] = 192 | u >> 6;
        outU8Array[outIdx++] = 128 | u & 63;
      } else if (u <= 65535) {
        if (outIdx + 2 >= endIdx)
          break;
        outU8Array[outIdx++] = 224 | u >> 12;
        outU8Array[outIdx++] = 128 | u >> 6 & 63;
        outU8Array[outIdx++] = 128 | u & 63;
      } else if (u <= 2097151) {
        if (outIdx + 3 >= endIdx)
          break;
        outU8Array[outIdx++] = 240 | u >> 18;
        outU8Array[outIdx++] = 128 | u >> 12 & 63;
        outU8Array[outIdx++] = 128 | u >> 6 & 63;
        outU8Array[outIdx++] = 128 | u & 63;
      } else if (u <= 67108863) {
        if (outIdx + 4 >= endIdx)
          break;
        outU8Array[outIdx++] = 248 | u >> 24;
        outU8Array[outIdx++] = 128 | u >> 18 & 63;
        outU8Array[outIdx++] = 128 | u >> 12 & 63;
        outU8Array[outIdx++] = 128 | u >> 6 & 63;
        outU8Array[outIdx++] = 128 | u & 63;
      } else {
        if (outIdx + 5 >= endIdx)
          break;
        outU8Array[outIdx++] = 252 | u >> 30;
        outU8Array[outIdx++] = 128 | u >> 24 & 63;
        outU8Array[outIdx++] = 128 | u >> 18 & 63;
        outU8Array[outIdx++] = 128 | u >> 12 & 63;
        outU8Array[outIdx++] = 128 | u >> 6 & 63;
        outU8Array[outIdx++] = 128 | u & 63;
      }
    }
    outU8Array[outIdx] = 0;
    return outIdx - startIdx;
  }
  Module["stringToUTF8Array"] = stringToUTF8Array;
  function stringToUTF8(str, outPtr, maxBytesToWrite) {
    return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
  }
  Module["stringToUTF8"] = stringToUTF8;
  function lengthBytesUTF8(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
      var u = str.charCodeAt(i);
      if (u >= 55296 && u <= 57343)
        u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
      if (u <= 127) {
        ++len;
      } else if (u <= 2047) {
        len += 2;
      } else if (u <= 65535) {
        len += 3;
      } else if (u <= 2097151) {
        len += 4;
      } else if (u <= 67108863) {
        len += 5;
      } else {
        len += 6;
      }
    }
    return len;
  }
  Module["lengthBytesUTF8"] = lengthBytesUTF8;
  function UTF16ToString(ptr) {
    var i = 0;
    var str = "";
    while (1) {
      var codeUnit = HEAP16[ptr + i * 2 >> 1];
      if (codeUnit == 0)
        return str;
      ++i;
      str += String.fromCharCode(codeUnit);
    }
  }
  Module["UTF16ToString"] = UTF16ToString;
  function stringToUTF16(str, outPtr, maxBytesToWrite) {
    if (maxBytesToWrite === undefined) {
      maxBytesToWrite = 2147483647;
    }
    if (maxBytesToWrite < 2)
      return 0;
    maxBytesToWrite -= 2;
    var startPtr = outPtr;
    var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
    for (var i = 0; i < numCharsToWrite; ++i) {
      var codeUnit = str.charCodeAt(i);
      HEAP16[outPtr >> 1] = codeUnit;
      outPtr += 2;
    }
    HEAP16[outPtr >> 1] = 0;
    return outPtr - startPtr;
  }
  Module["stringToUTF16"] = stringToUTF16;
  function lengthBytesUTF16(str) {
    return str.length * 2;
  }
  Module["lengthBytesUTF16"] = lengthBytesUTF16;
  function UTF32ToString(ptr) {
    var i = 0;
    var str = "";
    while (1) {
      var utf32 = HEAP32[ptr + i * 4 >> 2];
      if (utf32 == 0)
        return str;
      ++i;
      if (utf32 >= 65536) {
        var ch = utf32 - 65536;
        str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
      } else {
        str += String.fromCharCode(utf32);
      }
    }
  }
  Module["UTF32ToString"] = UTF32ToString;
  function stringToUTF32(str, outPtr, maxBytesToWrite) {
    if (maxBytesToWrite === undefined) {
      maxBytesToWrite = 2147483647;
    }
    if (maxBytesToWrite < 4)
      return 0;
    var startPtr = outPtr;
    var endPtr = startPtr + maxBytesToWrite - 4;
    for (var i = 0; i < str.length; ++i) {
      var codeUnit = str.charCodeAt(i);
      if (codeUnit >= 55296 && codeUnit <= 57343) {
        var trailSurrogate = str.charCodeAt(++i);
        codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023;
      }
      HEAP32[outPtr >> 2] = codeUnit;
      outPtr += 4;
      if (outPtr + 4 > endPtr)
        break;
    }
    HEAP32[outPtr >> 2] = 0;
    return outPtr - startPtr;
  }
  Module["stringToUTF32"] = stringToUTF32;
  function lengthBytesUTF32(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
      var codeUnit = str.charCodeAt(i);
      if (codeUnit >= 55296 && codeUnit <= 57343)
        ++i;
      len += 4;
    }
    return len;
  }
  Module["lengthBytesUTF32"] = lengthBytesUTF32;
  function demangle(func) {
    var hasLibcxxabi = !!Module["___cxa_demangle"];
    if (hasLibcxxabi) {
      try {
        var buf = _malloc(func.length);
        writeStringToMemory(func.substr(1), buf);
        var status = _malloc(4);
        var ret = Module["___cxa_demangle"](buf, 0, 0, status);
        if (getValue(status, "i32") === 0 && ret) {
          return Pointer_stringify(ret);
        }
      } catch (e) {} finally {
        if (buf)
          _free(buf);
        if (status)
          _free(status);
        if (ret)
          _free(ret);
      }
    }
    var i = 3;
    var basicTypes = {
      "v": "void",
      "b": "bool",
      "c": "char",
      "s": "short",
      "i": "int",
      "l": "long",
      "f": "float",
      "d": "double",
      "w": "wchar_t",
      "a": "signed char",
      "h": "unsigned char",
      "t": "unsigned short",
      "j": "unsigned int",
      "m": "unsigned long",
      "x": "long long",
      "y": "unsigned long long",
      "z": "..."
    };
    var subs = [];
    var first = true;
    function dump(x) {
      if (x)
        Module.print(x);
      Module.print(func);
      var pre = "";
      for (var a = 0; a < i; a++)
        pre += " ";
      Module.print(pre + "^");
    }
    function parseNested() {
      i++;
      if (func[i] === "K")
        i++;
      var parts = [];
      while (func[i] !== "E") {
        if (func[i] === "S") {
          i++;
          var next = func.indexOf("_", i);
          var num = func.substring(i, next) || 0;
          parts.push(subs[num] || "?");
          i = next + 1;
          continue;
        }
        if (func[i] === "C") {
          parts.push(parts[parts.length - 1]);
          i += 2;
          continue;
        }
        var size = parseInt(func.substr(i));
        var pre = size.toString().length;
        if (!size || !pre) {
          i--;
          break;
        }
        var curr = func.substr(i + pre, size);
        parts.push(curr);
        subs.push(curr);
        i += pre + size;
      }
      i++;
      return parts;
    }
    function parse(rawList, limit, allowVoid) {
      limit = limit || Infinity;
      var ret = "",
          list = [];
      function flushList() {
        return "(" + list.join(", ") + ")";
      }
      var name;
      if (func[i] === "N") {
        name = parseNested().join("::");
        limit--;
        if (limit === 0)
          return rawList ? [name] : name;
      } else {
        if (func[i] === "K" || first && func[i] === "L")
          i++;
        var size = parseInt(func.substr(i));
        if (size) {
          var pre = size.toString().length;
          name = func.substr(i + pre, size);
          i += pre + size;
        }
      }
      first = false;
      if (func[i] === "I") {
        i++;
        var iList = parse(true);
        var iRet = parse(true, 1, true);
        ret += iRet[0] + " " + name + "<" + iList.join(", ") + ">";
      } else {
        ret = name;
      }
      paramLoop: while (i < func.length && limit-- > 0) {
        var c = func[i++];
        if (c in basicTypes) {
          list.push(basicTypes[c]);
        } else {
          switch (c) {
            case "P":
              list.push(parse(true, 1, true)[0] + "*");
              break;
            case "R":
              list.push(parse(true, 1, true)[0] + "&");
              break;
            case "L":
              {
                i++;
                var end = func.indexOf("E", i);
                var size = end - i;
                list.push(func.substr(i, size));
                i += size + 2;
                break;
              }
              ;
            case "A":
              {
                var size = parseInt(func.substr(i));
                i += size.toString().length;
                if (func[i] !== "_")
                  throw "?";
                i++;
                list.push(parse(true, 1, true)[0] + " [" + size + "]");
                break;
              }
              ;
            case "E":
              break paramLoop;
            default:
              ret += "?" + c;
              break paramLoop;
          }
        }
      }
      if (!allowVoid && list.length === 1 && list[0] === "void")
        list = [];
      if (rawList) {
        if (ret) {
          list.push(ret + "?");
        }
        return list;
      } else {
        return ret + flushList();
      }
    }
    var parsed = func;
    try {
      if (func == "Object._main" || func == "_main") {
        return "main()";
      }
      if (typeof func === "number")
        func = Pointer_stringify(func);
      if (func[0] !== "_")
        return func;
      if (func[1] !== "_")
        return func;
      if (func[2] !== "Z")
        return func;
      switch (func[3]) {
        case "n":
          return "operator new()";
        case "d":
          return "operator delete()";
      }
      parsed = parse();
    } catch (e) {
      parsed += "?";
    }
    if (parsed.indexOf("?") >= 0 && !hasLibcxxabi) {
      Runtime.warnOnce("warning: a problem occurred in builtin C++ name demangling; build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling");
    }
    return parsed;
  }
  function demangleAll(text) {
    return text.replace(/__Z[\w\d_]+/g, (function(x) {
      var y = demangle(x);
      return x === y ? x : x + " [" + y + "]";
    }));
  }
  function jsStackTrace() {
    var err = new Error;
    if (!err.stack) {
      try {
        throw new Error(0);
      } catch (e) {
        err = e;
      }
      if (!err.stack) {
        return "(no stack trace available)";
      }
    }
    return err.stack.toString();
  }
  function stackTrace() {
    return demangleAll(jsStackTrace());
  }
  Module["stackTrace"] = stackTrace;
  var PAGE_SIZE = 4096;
  function alignMemoryPage(x) {
    if (x % 4096 > 0) {
      x += 4096 - x % 4096;
    }
    return x;
  }
  var HEAP;
  var HEAP8,
      HEAPU8,
      HEAP16,
      HEAPU16,
      HEAP32,
      HEAPU32,
      HEAPF32,
      HEAPF64;
  var STATIC_BASE = 0,
      STATICTOP = 0,
      staticSealed = false;
  var STACK_BASE = 0,
      STACKTOP = 0,
      STACK_MAX = 0;
  var DYNAMIC_BASE = 0,
      DYNAMICTOP = 0;
  function enlargeMemory() {
    var OLD_TOTAL_MEMORY = TOTAL_MEMORY;
    var LIMIT = Math.pow(2, 31);
    if (DYNAMICTOP >= LIMIT)
      return false;
    while (TOTAL_MEMORY <= DYNAMICTOP) {
      if (TOTAL_MEMORY < LIMIT / 2) {
        TOTAL_MEMORY = alignMemoryPage(2 * TOTAL_MEMORY);
      } else {
        var last = TOTAL_MEMORY;
        TOTAL_MEMORY = alignMemoryPage((3 * TOTAL_MEMORY + LIMIT) / 4);
        if (TOTAL_MEMORY <= last)
          return false;
      }
    }
    TOTAL_MEMORY = Math.max(TOTAL_MEMORY, 16 * 1024 * 1024);
    if (TOTAL_MEMORY >= LIMIT)
      return false;
    try {
      if (ArrayBuffer.transfer) {
        buffer = ArrayBuffer.transfer(buffer, TOTAL_MEMORY);
      } else {
        var oldHEAP8 = HEAP8;
        buffer = new ArrayBuffer(TOTAL_MEMORY);
      }
    } catch (e) {
      return false;
    }
    var success = _emscripten_replace_memory(buffer);
    if (!success)
      return false;
    Module["buffer"] = buffer;
    Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
    Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
    Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
    Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
    Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
    Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
    Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
    Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer);
    if (!ArrayBuffer.transfer) {
      HEAP8.set(oldHEAP8);
    }
    return true;
  }
  var byteLength;
  try {
    byteLength = Function.prototype.call.bind(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get);
    byteLength(new ArrayBuffer(4));
  } catch (e) {
    byteLength = (function(buffer) {
      return buffer.byteLength;
    });
  }
  var TOTAL_STACK = Module["TOTAL_STACK"] || 5242880;
  var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 16777216;
  var totalMemory = 64 * 1024;
  while (totalMemory < TOTAL_MEMORY || totalMemory < 2 * TOTAL_STACK) {
    if (totalMemory < 16 * 1024 * 1024) {
      totalMemory *= 2;
    } else {
      totalMemory += 16 * 1024 * 1024;
    }
  }
  totalMemory = Math.max(totalMemory, 16 * 1024 * 1024);
  if (totalMemory !== TOTAL_MEMORY) {
    Module.printErr("increasing TOTAL_MEMORY to " + totalMemory + " to be compliant with the asm.js spec (and given that TOTAL_STACK=" + TOTAL_STACK + ")");
    TOTAL_MEMORY = totalMemory;
  }
  assert(typeof Int32Array !== "undefined" && typeof Float64Array !== "undefined" && !!(new Int32Array(1))["subarray"] && !!(new Int32Array(1))["set"], "JS engine does not provide full typed array support");
  var buffer;
  buffer = new ArrayBuffer(TOTAL_MEMORY);
  HEAP8 = new Int8Array(buffer);
  HEAP16 = new Int16Array(buffer);
  HEAP32 = new Int32Array(buffer);
  HEAPU8 = new Uint8Array(buffer);
  HEAPU16 = new Uint16Array(buffer);
  HEAPU32 = new Uint32Array(buffer);
  HEAPF32 = new Float32Array(buffer);
  HEAPF64 = new Float64Array(buffer);
  HEAP32[0] = 255;
  assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, "Typed arrays 2 must be run on a little-endian system");
  Module["HEAP"] = HEAP;
  Module["buffer"] = buffer;
  Module["HEAP8"] = HEAP8;
  Module["HEAP16"] = HEAP16;
  Module["HEAP32"] = HEAP32;
  Module["HEAPU8"] = HEAPU8;
  Module["HEAPU16"] = HEAPU16;
  Module["HEAPU32"] = HEAPU32;
  Module["HEAPF32"] = HEAPF32;
  Module["HEAPF64"] = HEAPF64;
  function callRuntimeCallbacks(callbacks) {
    while (callbacks.length > 0) {
      var callback = callbacks.shift();
      if (typeof callback == "function") {
        callback();
        continue;
      }
      var func = callback.func;
      if (typeof func === "number") {
        if (callback.arg === undefined) {
          Runtime.dynCall("v", func);
        } else {
          Runtime.dynCall("vi", func, [callback.arg]);
        }
      } else {
        func(callback.arg === undefined ? null : callback.arg);
      }
    }
  }
  var __ATPRERUN__ = [];
  var __ATINIT__ = [];
  var __ATMAIN__ = [];
  var __ATEXIT__ = [];
  var __ATPOSTRUN__ = [];
  var runtimeInitialized = false;
  var runtimeExited = false;
  function preRun() {
    if (Module["preRun"]) {
      if (typeof Module["preRun"] == "function")
        Module["preRun"] = [Module["preRun"]];
      while (Module["preRun"].length) {
        addOnPreRun(Module["preRun"].shift());
      }
    }
    callRuntimeCallbacks(__ATPRERUN__);
  }
  function ensureInitRuntime() {
    if (runtimeInitialized)
      return ;
    runtimeInitialized = true;
    callRuntimeCallbacks(__ATINIT__);
  }
  function preMain() {
    callRuntimeCallbacks(__ATMAIN__);
  }
  function exitRuntime() {
    callRuntimeCallbacks(__ATEXIT__);
    runtimeExited = true;
  }
  function postRun() {
    if (Module["postRun"]) {
      if (typeof Module["postRun"] == "function")
        Module["postRun"] = [Module["postRun"]];
      while (Module["postRun"].length) {
        addOnPostRun(Module["postRun"].shift());
      }
    }
    callRuntimeCallbacks(__ATPOSTRUN__);
  }
  function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb);
  }
  Module["addOnPreRun"] = Module.addOnPreRun = addOnPreRun;
  function addOnInit(cb) {
    __ATINIT__.unshift(cb);
  }
  Module["addOnInit"] = Module.addOnInit = addOnInit;
  function addOnPreMain(cb) {
    __ATMAIN__.unshift(cb);
  }
  Module["addOnPreMain"] = Module.addOnPreMain = addOnPreMain;
  function addOnExit(cb) {
    __ATEXIT__.unshift(cb);
  }
  Module["addOnExit"] = Module.addOnExit = addOnExit;
  function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb);
  }
  Module["addOnPostRun"] = Module.addOnPostRun = addOnPostRun;
  function intArrayFromString(stringy, dontAddNull, length) {
    var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
    var u8array = new Array(len);
    var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
    if (dontAddNull)
      u8array.length = numBytesWritten;
    return u8array;
  }
  Module["intArrayFromString"] = intArrayFromString;
  function intArrayToString(array) {
    var ret = [];
    for (var i = 0; i < array.length; i++) {
      var chr = array[i];
      if (chr > 255) {
        chr &= 255;
      }
      ret.push(String.fromCharCode(chr));
    }
    return ret.join("");
  }
  Module["intArrayToString"] = intArrayToString;
  function writeStringToMemory(string, buffer, dontAddNull) {
    var array = intArrayFromString(string, dontAddNull);
    var i = 0;
    while (i < array.length) {
      var chr = array[i];
      HEAP8[buffer + i >> 0] = chr;
      i = i + 1;
    }
  }
  Module["writeStringToMemory"] = writeStringToMemory;
  function writeArrayToMemory(array, buffer) {
    for (var i = 0; i < array.length; i++) {
      HEAP8[buffer++ >> 0] = array[i];
    }
  }
  Module["writeArrayToMemory"] = writeArrayToMemory;
  function writeAsciiToMemory(str, buffer, dontAddNull) {
    for (var i = 0; i < str.length; ++i) {
      HEAP8[buffer++ >> 0] = str.charCodeAt(i);
    }
    if (!dontAddNull)
      HEAP8[buffer >> 0] = 0;
  }
  Module["writeAsciiToMemory"] = writeAsciiToMemory;
  function unSign(value, bits, ignore) {
    if (value >= 0) {
      return value;
    }
    return bits <= 32 ? 2 * Math.abs(1 << bits - 1) + value : Math.pow(2, bits) + value;
  }
  function reSign(value, bits, ignore) {
    if (value <= 0) {
      return value;
    }
    var half = bits <= 32 ? Math.abs(1 << bits - 1) : Math.pow(2, bits - 1);
    if (value >= half && (bits <= 32 || value > half)) {
      value = -2 * half + value;
    }
    return value;
  }
  if (!Math["imul"] || Math["imul"](4294967295, 5) !== -5)
    Math["imul"] = function imul(a, b) {
      var ah = a >>> 16;
      var al = a & 65535;
      var bh = b >>> 16;
      var bl = b & 65535;
      return al * bl + (ah * bl + al * bh << 16) | 0;
    };
  Math.imul = Math["imul"];
  if (!Math["clz32"])
    Math["clz32"] = (function(x) {
      x = x >>> 0;
      for (var i = 0; i < 32; i++) {
        if (x & 1 << 31 - i)
          return i;
      }
      return 32;
    });
  Math.clz32 = Math["clz32"];
  var Math_abs = Math.abs;
  var Math_cos = Math.cos;
  var Math_sin = Math.sin;
  var Math_tan = Math.tan;
  var Math_acos = Math.acos;
  var Math_asin = Math.asin;
  var Math_atan = Math.atan;
  var Math_atan2 = Math.atan2;
  var Math_exp = Math.exp;
  var Math_log = Math.log;
  var Math_sqrt = Math.sqrt;
  var Math_ceil = Math.ceil;
  var Math_floor = Math.floor;
  var Math_pow = Math.pow;
  var Math_imul = Math.imul;
  var Math_fround = Math.fround;
  var Math_min = Math.min;
  var Math_clz32 = Math.clz32;
  var runDependencies = 0;
  var runDependencyWatcher = null;
  var dependenciesFulfilled = null;
  function getUniqueRunDependency(id) {
    return id;
  }
  function addRunDependency(id) {
    runDependencies++;
    if (Module["monitorRunDependencies"]) {
      Module["monitorRunDependencies"](runDependencies);
    }
  }
  Module["addRunDependency"] = addRunDependency;
  function removeRunDependency(id) {
    runDependencies--;
    if (Module["monitorRunDependencies"]) {
      Module["monitorRunDependencies"](runDependencies);
    }
    if (runDependencies == 0) {
      if (runDependencyWatcher !== null) {
        clearInterval(runDependencyWatcher);
        runDependencyWatcher = null;
      }
      if (dependenciesFulfilled) {
        var callback = dependenciesFulfilled;
        dependenciesFulfilled = null;
        callback();
      }
    }
  }
  Module["removeRunDependency"] = removeRunDependency;
  Module["preloadedImages"] = {};
  Module["preloadedAudios"] = {};
  var memoryInitializer = null;
  var ASM_CONSTS = [];
  STATIC_BASE = 8;
  STATICTOP = STATIC_BASE + 635408;
  __ATINIT__.push({func: (function() {
      __GLOBAL__sub_I_libretro_emscripten_cpp();
    })}, {func: (function() {
      __GLOBAL__sub_I_bind_cpp();
    })});
  allocate([252, 21, 0, 0, 118, 213, 3, 0, 252, 21, 0, 0, 107, 213, 3, 0, 252, 21, 0, 0, 96, 213, 3, 0, 252, 21, 0, 0, 78, 213, 3, 0, 252, 21, 0, 0, 56, 213, 3, 0, 252, 21, 0, 0, 34, 213, 3, 0, 252, 21, 0, 0, 12, 213, 3, 0, 252, 21, 0, 0, 244, 212, 3, 0, 252, 21, 0, 0, 223, 212, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 104, 22, 0, 0, 115, 174, 9, 0, 0, 0, 0, 0, 1, 0, 0, 0, 16, 1, 0, 0, 0, 0, 0, 0, 104, 22, 0, 0, 52, 174, 9, 0, 0, 0, 0, 0, 1, 0, 0, 0, 16, 1, 0, 0, 0, 0, 0, 0, 104, 22, 0, 0, 207, 173, 9, 0, 0, 0, 0, 0, 1, 0, 0, 0, 16, 1, 0, 0, 0, 0, 0, 0, 24, 22, 0, 0, 188, 173, 9, 0, 24, 22, 0, 0, 157, 173, 9, 0, 24, 22, 0, 0, 126, 173, 9, 0, 24, 22, 0, 0, 95, 173, 9, 0, 24, 22, 0, 0, 64, 173, 9, 0, 24, 22, 0, 0, 33, 173, 9, 0, 24, 22, 0, 0, 2, 173, 9, 0, 24, 22, 0, 0, 227, 172, 9, 0, 24, 22, 0, 0, 196, 172, 9, 0, 24, 22, 0, 0, 165, 172, 9, 0, 24, 22, 0, 0, 134, 172, 9, 0, 24, 22, 0, 0, 103, 172, 9, 0, 24, 22, 0, 0, 72, 172, 9, 0, 24, 22, 0, 0, 14, 174, 9, 0, 24, 22, 0, 0, 178, 174, 9, 0, 64, 22, 0, 0, 191, 174, 9, 0, 24, 1, 0, 0, 0, 0, 0, 0, 64, 22, 0, 0, 224, 174, 9, 0, 32, 1, 0, 0, 0, 0, 0, 0, 64, 22, 0, 0, 38, 175, 9, 0, 32, 1, 0, 0, 0, 0, 0, 0, 64, 22, 0, 0, 2, 175, 9, 0, 64, 1, 0, 0, 0, 0, 0, 0, 64, 22, 0, 0, 72, 175, 9, 0, 32, 1, 0, 0, 0, 0, 0, 0, 224, 21, 0, 0, 112, 175, 9, 0, 144, 22, 0, 0, 114, 175, 9, 0, 0, 0, 0, 0, 112, 1, 0, 0, 224, 21, 0, 0, 117, 175, 9, 0, 224, 21, 0, 0, 120, 175, 9, 0, 224, 21, 0, 0, 122, 175, 9, 0, 224, 21, 0, 0, 124, 175, 9, 0, 224, 21, 0, 0, 126, 175, 9, 0, 224, 21, 0, 0, 128, 175, 9, 0, 224, 21, 0, 0, 130, 175, 9, 0, 224, 21, 0, 0, 132, 175, 9, 0, 224, 21, 0, 0, 134, 175, 9, 0, 224, 21, 0, 0, 136, 175, 9, 0, 224, 21, 0, 0, 138, 175, 9, 0, 224, 21, 0, 0, 140, 175, 9, 0, 224, 21, 0, 0, 142, 175, 9, 0, 64, 22, 0, 0, 144, 175, 9, 0, 32, 1, 0, 0, 0, 0, 0, 0, 64, 22, 0, 0, 177, 175, 9, 0, 48, 1, 0, 0, 0, 0, 0, 0, 64, 22, 0, 0, 214, 175, 9, 0, 48, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 112, 1, 0, 0, 200, 1, 0, 0, 200, 1, 0, 0, 200, 1, 0, 0, 112, 1, 0, 0, 200, 1, 0, 0, 200, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 76, 23, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 150, 48, 7, 119, 44, 97, 14, 238, 186, 81, 9, 153, 25, 196, 109, 7, 143, 244, 106, 112, 53, 165, 99, 233, 163, 149, 100, 158, 50, 136, 219, 14, 164, 184, 220, 121, 30, 233, 213, 224, 136, 217, 210, 151, 43, 76, 182, 9, 189, 124, 177, 126, 7, 45, 184, 231, 145, 29, 191, 144, 100, 16, 183, 29, 242, 32, 176, 106, 72, 113, 185, 243, 222, 65, 190, 132, 125, 212, 218, 26, 235, 228, 221, 109, 81, 181, 212, 244, 199, 133, 211, 131, 86, 152, 108, 19, 192, 168, 107, 100, 122, 249, 98, 253, 236, 201, 101, 138, 79, 92, 1, 20, 217, 108, 6, 99, 99, 61, 15, 250, 245, 13, 8, 141, 200, 32, 110, 59, 94, 16, 105, 76, 228, 65, 96, 213, 114, 113, 103, 162, 209, 228, 3, 60, 71, 212, 4, 75, 253, 133, 13, 210, 107, 181, 10, 165, 250, 168, 181, 53, 108, 152, 178, 66, 214, 201, 187, 219, 64, 249, 188, 172, 227, 108, 216, 50, 117, 92, 223, 69, 207, 13, 214, 220, 89, 61, 209, 171, 172, 48, 217, 38, 58, 0, 222, 81, 128, 81, 215, 200, 22, 97, 208, 191, 181, 244, 180, 33, 35, 196, 179, 86, 153, 149, 186, 207, 15, 165, 189, 184, 158, 184, 2, 40, 8, 136, 5, 95, 178, 217, 12, 198, 36, 233, 11, 177, 135, 124, 111, 47, 17, 76, 104, 88, 171, 29, 97, 193, 61, 45, 102, 182, 144, 65, 220, 118, 6, 113, 219, 1, 188, 32, 210, 152, 42, 16, 213, 239, 137, 133, 177, 113, 31, 181, 182, 6, 165, 228, 191, 159, 51, 212, 184, 232, 162, 201, 7, 120, 52, 249, 0, 15, 142, 168, 9, 150, 24, 152, 14, 225, 187, 13, 106, 127, 45, 61, 109, 8, 151, 108, 100, 145, 1, 92, 99, 230, 244, 81, 107, 107, 98, 97, 108, 28, 216, 48, 101, 133, 78, 0, 98, 242, 237, 149, 6, 108, 123, 165, 1, 27, 193, 244, 8, 130, 87, 196, 15, 245, 198, 217, 176, 101, 80, 233, 183, 18, 234, 184, 190, 139, 124, 136, 185, 252, 223, 29, 221, 98, 73, 45, 218, 21, 243, 124, 211, 140, 101, 76, 212, 251, 88, 97, 178, 77, 206, 81, 181, 58, 116, 0, 188, 163, 226, 48, 187, 212, 65, 165, 223, 74, 215, 149, 216, 61, 109, 196, 209, 164, 251, 244, 214, 211, 106, 233, 105, 67, 252, 217, 110, 52, 70, 136, 103, 173, 208, 184, 96, 218, 115, 45, 4, 68, 229, 29, 3, 51, 95, 76, 10, 170, 201, 124, 13, 221, 60, 113, 5, 80, 170, 65, 2, 39, 16, 16, 11, 190, 134, 32, 12, 201, 37, 181, 104, 87, 179, 133, 111, 32, 9, 212, 102, 185, 159, 228, 97, 206, 14, 249, 222, 94, 152, 201, 217, 41, 34, 152, 208, 176, 180, 168, 215, 199, 23, 61, 179, 89, 129, 13, 180, 46, 59, 92, 189, 183, 173, 108, 186, 192, 32, 131, 184, 237, 182, 179, 191, 154, 12, 226, 182, 3, 154, 210, 177, 116, 57, 71, 213, 234, 175, 119, 210, 157, 21, 38, 219, 4, 131, 22, 220, 115, 18, 11, 99, 227, 132, 59, 100, 148, 62, 106, 109, 13, 168, 90, 106, 122, 11, 207, 14, 228, 157, 255, 9, 147, 39, 174, 0, 10, 177, 158, 7, 125, 68, 147, 15, 240, 210, 163, 8, 135, 104, 242, 1, 30, 254, 194, 6, 105, 93, 87, 98, 247, 203, 103, 101, 128, 113, 54, 108, 25, 231, 6, 107, 110, 118, 27, 212, 254, 224, 43, 211, 137, 90, 122, 218, 16, 204, 74, 221, 103, 111, 223, 185, 249, 249, 239, 190, 142, 67, 190, 183, 23, 213, 142, 176, 96, 232, 163, 214, 214, 126, 147, 209, 161, 196, 194, 216, 56, 82, 242, 223, 79, 241, 103, 187, 209, 103, 87, 188, 166, 221, 6, 181, 63, 75, 54, 178, 72, 218, 43, 13, 216, 76, 27, 10, 175, 246, 74, 3, 54, 96, 122, 4, 65, 195, 239, 96, 223, 85, 223, 103, 168, 239, 142, 110, 49, 121, 190, 105, 70, 140, 179, 97, 203, 26, 131, 102, 188, 160, 210, 111, 37, 54, 226, 104, 82, 149, 119, 12, 204, 3, 71, 11, 187, 185, 22, 2, 34, 47, 38, 5, 85, 190, 59, 186, 197, 40, 11, 189, 178, 146, 90, 180, 43, 4, 106, 179, 92, 167, 255, 215, 194, 49, 207, 208, 181, 139, 158, 217, 44, 29, 174, 222, 91, 176, 194, 100, 155, 38, 242, 99, 236, 156, 163, 106, 117, 10, 147, 109, 2, 169, 6, 9, 156, 63, 54, 14, 235, 133, 103, 7, 114, 19, 87, 0, 5, 130, 74, 191, 149, 20, 122, 184, 226, 174, 43, 177, 123, 56, 27, 182, 12, 155, 142, 210, 146, 13, 190, 213, 229, 183, 239, 220, 124, 33, 223, 219, 11, 212, 210, 211, 134, 66, 226, 212, 241, 248, 179, 221, 104, 110, 131, 218, 31, 205, 22, 190, 129, 91, 38, 185, 246, 225, 119, 176, 111, 119, 71, 183, 24, 230, 90, 8, 136, 112, 106, 15, 255, 202, 59, 6, 102, 92, 11, 1, 17, 255, 158, 101, 143, 105, 174, 98, 248, 211, 255, 107, 97, 69, 207, 108, 22, 120, 226, 10, 160, 238, 210, 13, 215, 84, 131, 4, 78, 194, 179, 3, 57, 97, 38, 103, 167, 247, 22, 96, 208, 77, 71, 105, 73, 219, 119, 110, 62, 74, 106, 209, 174, 220, 90, 214, 217, 102, 11, 223, 64, 240, 59, 216, 55, 83, 174, 188, 169, 197, 158, 187, 222, 127, 207, 178, 71, 233, 255, 181, 48, 28, 242, 189, 189, 138, 194, 186, 202, 48, 147, 179, 83, 166, 163, 180, 36, 5, 54, 208, 186, 147, 6, 215, 205, 41, 87, 222, 84, 191, 103, 217, 35, 46, 122, 102, 179, 184, 74, 97, 196, 2, 27, 104, 93, 148, 43, 111, 42, 55, 190, 11, 180, 161, 142, 12, 195, 27, 223, 5, 90, 141, 239, 2, 45], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);
  allocate([212, 61, 14, 0, 27, 152, 0, 0, 217, 187, 0, 0, 8, 0, 199, 0, 179, 22, 204, 0, 16, 135, 157, 0, 225, 222, 225, 0, 107, 110, 95, 0, 255, 161, 106, 0, 122, 240, 61, 0, 255, 255, 49, 0, 85, 66, 255, 0, 255, 152, 255, 0, 93, 173, 217, 0, 255, 255, 255, 0, 0, 0, 0, 0, 182, 0, 0, 0, 0, 182, 0, 0, 182, 182, 0, 0, 0, 0, 182, 0, 182, 0, 182, 0, 0, 182, 182, 0, 182, 182, 182, 0, 73, 73, 73, 0, 255, 73, 73, 0, 73, 255, 73, 0, 255, 255, 73, 0, 73, 73, 255, 0, 255, 73, 255, 0, 73, 255, 255, 0, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 0, 0, 0, 49, 0, 0, 0, 50, 0, 0, 0, 51, 0, 0, 0, 52, 0, 0, 0, 53, 0, 0, 0, 54, 0, 0, 0, 55, 0, 0, 0, 56, 0, 0, 0, 57, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, 0, 0, 0, 63, 0, 0, 0, 108, 0, 0, 0, 112, 0, 0, 0, 43, 0, 0, 0, 119, 0, 0, 0, 101, 0, 0, 0, 114, 0, 0, 0, 116, 0, 0, 0, 117, 0, 0, 0, 105, 0, 0, 0, 111, 0, 0, 0, 113, 0, 0, 0, 115, 0, 0, 0, 100, 0, 0, 0, 102, 0, 0, 0, 103, 0, 0, 0, 104, 0, 0, 0, 106, 0, 0, 0, 107, 0, 0, 0, 97, 0, 0, 0, 122, 0, 0, 0, 120, 0, 0, 0, 99, 0, 0, 0, 118, 0, 0, 0, 98, 0, 0, 0, 109, 0, 0, 0, 46, 0, 0, 0, 45, 0, 0, 0, 42, 0, 0, 0, 47, 0, 0, 0, 61, 0, 0, 0, 121, 0, 0, 0, 110, 0, 0, 0, 23, 1, 0, 0, 13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 12, 169, 9, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 17, 169, 9, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 20, 169, 9, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 25, 169, 9, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 31, 169, 9, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 12, 169, 9, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 17, 169, 9, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 20, 169, 9, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 25, 169, 9, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 36, 169, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 96, 1, 0, 0, 42, 0, 0, 0, 43, 0, 0, 0, 44, 0, 0, 0, 45, 0, 0, 0, 42, 0, 0, 0, 0, 0, 0, 0, 240, 1, 0, 0, 42, 0, 0, 0, 46, 0, 0, 0, 44, 0, 0, 0, 45, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0, 48, 1, 0, 0, 42, 0, 0, 0, 47, 0, 0, 0, 44, 0, 0, 0, 45, 0, 0, 0, 44, 0, 0, 0, 42, 0, 0, 0, 42, 0, 0, 0, 42, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 42, 0, 0, 0, 48, 0, 0, 0, 44, 0, 0, 0, 45, 0, 0, 0, 44, 0, 0, 0, 43, 0, 0, 0, 43, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0, 16, 2, 0, 0, 42, 0, 0, 0, 49, 0, 0, 0, 44, 0, 0, 0, 45, 0, 0, 0, 44, 0, 0, 0, 44, 0, 0, 0, 44, 0, 0, 0, 44, 0, 0, 0, 0, 0, 0, 0, 80, 1, 0, 0, 42, 0, 0, 0, 50, 0, 0, 0, 44, 0, 0, 0, 45, 0, 0, 0, 45, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 46, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 4960);
  allocate([65, 80, 73, 95, 86, 69, 82, 83, 73, 79, 78, 0, 68, 69, 86, 73, 67, 69, 95, 84, 89, 80, 69, 95, 83, 72, 73, 70, 84, 0, 68, 69, 86, 73, 67, 69, 95, 77, 65, 83, 75, 0, 68, 69, 86, 73, 67, 69, 95, 78, 79, 78, 69, 0, 68, 69, 86, 73, 67, 69, 95, 74, 79, 89, 80, 65, 68, 0, 68, 69, 86, 73, 67, 69, 95, 77, 79, 85, 83, 69, 0, 68, 69, 86, 73, 67, 69, 95, 75, 69, 89, 66, 79, 65, 82, 68, 0, 68, 69, 86, 73, 67, 69, 95, 76, 73, 71, 72, 84, 71, 85, 78, 0, 68, 69, 86, 73, 67, 69, 95, 65, 78, 65, 76, 79, 71, 0, 68, 69, 86, 73, 67, 69, 95, 80, 79, 73, 78, 84, 69, 82, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 66, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 89, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 83, 69, 76, 69, 67, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 83, 84, 65, 82, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 85, 80, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 68, 79, 87, 78, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 76, 69, 70, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 82, 73, 71, 72, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 65, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 88, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 76, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 82, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 76, 50, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 82, 50, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 76, 51, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 82, 51, 0, 68, 69, 86, 73, 67, 69, 95, 73, 78, 68, 69, 88, 95, 65, 78, 65, 76, 79, 71, 95, 76, 69, 70, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 78, 68, 69, 88, 95, 65, 78, 65, 76, 79, 71, 95, 82, 73, 71, 72, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 65, 78, 65, 76, 79, 71, 95, 88, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 65, 78, 65, 76, 79, 71, 95, 89, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 88, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 89, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 76, 69, 70, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 82, 73, 71, 72, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 87, 72, 69, 69, 76, 85, 80, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 87, 72, 69, 69, 76, 68, 79, 87, 78, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 77, 73, 68, 68, 76, 69, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 72, 79, 82, 73, 90, 95, 87, 72, 69, 69, 76, 85, 80, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 72, 79, 82, 73, 90, 95, 87, 72, 69, 69, 76, 68, 79, 87, 78, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 76, 73, 71, 72, 84, 71, 85, 78, 95, 88, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 76, 73, 71, 72, 84, 71, 85, 78, 95, 89, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 76, 73, 71, 72, 84, 71, 85, 78, 95, 84, 82, 73, 71, 71, 69, 82, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 76, 73, 71, 72, 84, 71, 85, 78, 95, 67, 85, 82, 83, 79, 82, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 76, 73, 71, 72, 84, 71, 85, 78, 95, 84, 85, 82, 66, 79, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 76, 73, 71, 72, 84, 71, 85, 78, 95, 80, 65, 85, 83, 69, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 76, 73, 71, 72, 84, 71, 85, 78, 95, 83, 84, 65, 82, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 80, 79, 73, 78, 84, 69, 82, 95, 88, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 80, 79, 73, 78, 84, 69, 82, 95, 89, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 80, 79, 73, 78, 84, 69, 82, 95, 80, 82, 69, 83, 83, 69, 68, 0, 82, 69, 71, 73, 79, 78, 95, 78, 84, 83, 67, 0, 82, 69, 71, 73, 79, 78, 95, 80, 65, 76, 0, 77, 69, 77, 79, 82, 89, 95, 77, 65, 83, 75, 0, 77, 69, 77, 79, 82, 89, 95, 83, 65, 86, 69, 95, 82, 65, 77, 0, 77, 69, 77, 79, 82, 89, 95, 82, 84, 67, 0, 77, 69, 77, 79, 82, 89, 95, 83, 89, 83, 84, 69, 77, 95, 82, 65, 77, 0, 77, 69, 77, 79, 82, 89, 95, 86, 73, 68, 69, 79, 95, 82, 65, 77, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 69, 88, 80, 69, 82, 73, 77, 69, 78, 84, 65, 76, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 80, 82, 73, 86, 65, 84, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 82, 79, 84, 65, 84, 73, 79, 78, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 79, 86, 69, 82, 83, 67, 65, 78, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 67, 65, 78, 95, 68, 85, 80, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 77, 69, 83, 83, 65, 71, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 72, 85, 84, 68, 79, 87, 78, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 80, 69, 82, 70, 79, 82, 77, 65, 78, 67, 69, 95, 76, 69, 86, 69, 76, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 83, 89, 83, 84, 69, 77, 95, 68, 73, 82, 69, 67, 84, 79, 82, 89, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 80, 73, 88, 69, 76, 95, 70, 79, 82, 77, 65, 84, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 73, 78, 80, 85, 84, 95, 68, 69, 83, 67, 82, 73, 80, 84, 79, 82, 83, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 75, 69, 89, 66, 79, 65, 82, 68, 95, 67, 65, 76, 76, 66, 65, 67, 75, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 68, 73, 83, 75, 95, 67, 79, 78, 84, 82, 79, 76, 95, 73, 78, 84, 69, 82, 70, 65, 67, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 72, 87, 95, 82, 69, 78, 68, 69, 82, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 86, 65, 82, 73, 65, 66, 76, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 86, 65, 82, 73, 65, 66, 76, 69, 83, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 86, 65, 82, 73, 65, 66, 76, 69, 95, 85, 80, 68, 65, 84, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 83, 85, 80, 80, 79, 82, 84, 95, 78, 79, 95, 71, 65, 77, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 76, 73, 66, 82, 69, 84, 82, 79, 95, 80, 65, 84, 72, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 65, 85, 68, 73, 79, 95, 67, 65, 76, 76, 66, 65, 67, 75, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 70, 82, 65, 77, 69, 95, 84, 73, 77, 69, 95, 67, 65, 76, 76, 66, 65, 67, 75, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 82, 85, 77, 66, 76, 69, 95, 73, 78, 84, 69, 82, 70, 65, 67, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 73, 78, 80, 85, 84, 95, 68, 69, 86, 73, 67, 69, 95, 67, 65, 80, 65, 66, 73, 76, 73, 84, 73, 69, 83, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 83, 69, 78, 83, 79, 82, 95, 73, 78, 84, 69, 82, 70, 65, 67, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 67, 65, 77, 69, 82, 65, 95, 73, 78, 84, 69, 82, 70, 65, 67, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 76, 79, 71, 95, 73, 78, 84, 69, 82, 70, 65, 67, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 80, 69, 82, 70, 95, 73, 78, 84, 69, 82, 70, 65, 67, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 76, 79, 67, 65, 84, 73, 79, 78, 95, 73, 78, 84, 69, 82, 70, 65, 67, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 67, 79, 82, 69, 95, 65, 83, 83, 69, 84, 83, 95, 68, 73, 82, 69, 67, 84, 79, 82, 89, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 83, 65, 86, 69, 95, 68, 73, 82, 69, 67, 84, 79, 82, 89, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 83, 89, 83, 84, 69, 77, 95, 65, 86, 95, 73, 78, 70, 79, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 80, 82, 79, 67, 95, 65, 68, 68, 82, 69, 83, 83, 95, 67, 65, 76, 76, 66, 65, 67, 75, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 83, 85, 66, 83, 89, 83, 84, 69, 77, 95, 73, 78, 70, 79, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 67, 79, 78, 84, 82, 79, 76, 76, 69, 82, 95, 73, 78, 70, 79, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 77, 69, 77, 79, 82, 89, 95, 77, 65, 80, 83, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 71, 69, 79, 77, 69, 84, 82, 89, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 85, 83, 69, 82, 78, 65, 77, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 76, 65, 78, 71, 85, 65, 71, 69, 0, 77, 69, 77, 68, 69, 83, 67, 95, 67, 79, 78, 83, 84, 0, 77, 69, 77, 68, 69, 83, 67, 95, 66, 73, 71, 69, 78, 68, 73, 65, 78, 0, 77, 69, 77, 68, 69, 83, 67, 95, 65, 76, 73, 71, 78, 95, 50, 0, 77, 69, 77, 68, 69, 83, 67, 95, 65, 76, 73, 71, 78, 95, 52, 0, 77, 69, 77, 68, 69, 83, 67, 95, 65, 76, 73, 71, 78, 95, 56, 0, 77, 69, 77, 68, 69, 83, 67, 95, 77, 73, 78, 83, 73, 90, 69, 95, 50, 0, 77, 69, 77, 68, 69, 83, 67, 95, 77, 73, 78, 83, 73, 90, 69, 95, 52, 0, 77, 69, 77, 68, 69, 83, 67, 95, 77, 73, 78, 83, 73, 90, 69, 95, 56, 0, 83, 73, 77, 68, 95, 83, 83, 69, 0, 83, 73, 77, 68, 95, 83, 83, 69, 50, 0, 83, 73, 77, 68, 95, 86, 77, 88, 0, 83, 73, 77, 68, 95, 86, 77, 88, 49, 50, 56, 0, 83, 73, 77, 68, 95, 65, 86, 88, 0, 83, 73, 77, 68, 95, 78, 69, 79, 78, 0, 83, 73, 77, 68, 95, 83, 83, 69, 51, 0, 83, 73, 77, 68, 95, 83, 83, 83, 69, 51, 0, 83, 73, 77, 68, 95, 77, 77, 88, 0, 83, 73, 77, 68, 95, 77, 77, 88, 69, 88, 84, 0, 83, 73, 77, 68, 95, 83, 83, 69, 52, 0, 83, 73, 77, 68, 95, 83, 83, 69, 52, 50, 0, 83, 73, 77, 68, 95, 65, 86, 88, 50, 0, 83, 73, 77, 68, 95, 86, 70, 80, 85, 0, 83, 73, 77, 68, 95, 80, 83, 0, 83, 73, 77, 68, 95, 65, 69, 83, 0, 83, 69, 78, 83, 79, 82, 95, 65, 67, 67, 69, 76, 69, 82, 79, 77, 69, 84, 69, 82, 95, 88, 0, 83, 69, 78, 83, 79, 82, 95, 65, 67, 67, 69, 76, 69, 82, 79, 77, 69, 84, 69, 82, 95, 89, 0, 83, 69, 78, 83, 79, 82, 95, 65, 67, 67, 69, 76, 69, 82, 79, 77, 69, 84, 69, 82, 95, 90, 0, 72, 87, 95, 70, 82, 65, 77, 69, 95, 66, 85, 70, 70, 69, 82, 95, 86, 65, 76, 73, 68, 0, 108, 97, 110, 103, 117, 97, 103, 101, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 68, 85, 77, 77, 89, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 76, 65, 83, 84, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 67, 72, 73, 78, 69, 83, 69, 95, 83, 73, 77, 80, 76, 73, 70, 73, 69, 68, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 67, 72, 73, 78, 69, 83, 69, 95, 84, 82, 65, 68, 73, 84, 73, 79, 78, 65, 76, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 75, 79, 82, 69, 65, 78, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 82, 85, 83, 83, 73, 65, 78, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 80, 79, 82, 84, 85, 71, 85, 69, 83, 69, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 68, 85, 84, 67, 72, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 73, 84, 65, 76, 73, 65, 78, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 71, 69, 82, 77, 65, 78, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 83, 80, 65, 78, 73, 83, 72, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 70, 82, 69, 78, 67, 72, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 74, 65, 80, 65, 78, 69, 83, 69, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 69, 78, 71, 76, 73, 83, 72, 0, 107, 101, 121, 0, 75, 95, 68, 85, 77, 77, 89, 0, 75, 95, 76, 65, 83, 84, 0, 75, 95, 85, 78, 68, 79, 0, 75, 95, 69, 85, 82, 79, 0, 75, 95, 80, 79, 87, 69, 82, 0, 75, 95, 77, 69, 78, 85, 0, 75, 95, 66, 82, 69, 65, 75, 0, 75, 95, 83, 89, 83, 82, 69, 81, 0, 75, 95, 80, 82, 73, 78, 84, 0, 75, 95, 72, 69, 76, 80, 0, 75, 95, 67, 79, 77, 80, 79, 83, 69, 0, 75, 95, 77, 79, 68, 69, 0, 75, 95, 82, 83, 85, 80, 69, 82, 0, 75, 95, 76, 83, 85, 80, 69, 82, 0, 75, 95, 76, 77, 69, 84, 65, 0, 75, 95, 82, 77, 69, 84, 65, 0, 75, 95, 76, 65, 76, 84, 0, 75, 95, 82, 65, 76, 84, 0, 75, 95, 76, 67, 84, 82, 76, 0, 75, 95, 82, 67, 84, 82, 76, 0, 75, 95, 76, 83, 72, 73, 70, 84, 0, 75, 95, 82, 83, 72, 73, 70, 84, 0, 75, 95, 83, 67, 82, 79, 76, 76, 79, 67, 75, 0, 75, 95, 67, 65, 80, 83, 76, 79, 67, 75, 0, 75, 95, 78, 85, 77, 76, 79, 67, 75, 0, 75, 95, 70, 49, 53, 0, 75, 95, 70, 49, 52, 0, 75, 95, 70, 49, 51, 0, 75, 95, 70, 49, 50, 0, 75, 95, 70, 49, 49, 0, 75, 95, 70, 49, 48, 0, 75, 95, 70, 57, 0, 75, 95, 70, 56, 0, 75, 95, 70, 55, 0, 75, 95, 70, 54, 0, 75, 95, 70, 53, 0, 75, 95, 70, 52, 0, 75, 95, 70, 51, 0, 75, 95, 70, 50, 0, 75, 95, 70, 49, 0, 75, 95, 80, 65, 71, 69, 68, 79, 87, 78, 0, 75, 95, 80, 65, 71, 69, 85, 80, 0, 75, 95, 69, 78, 68, 0, 75, 95, 72, 79, 77, 69, 0, 75, 95, 73, 78, 83, 69, 82, 84, 0, 75, 95, 76, 69, 70, 84, 0, 75, 95, 82, 73, 71, 72, 84, 0, 75, 95, 68, 79, 87, 78, 0, 75, 95, 85, 80, 0, 75, 95, 75, 80, 95, 69, 81, 85, 65, 76, 83, 0, 75, 95, 75, 80, 95, 69, 78, 84, 69, 82, 0, 75, 95, 75, 80, 95, 80, 76, 85, 83, 0, 75, 95, 75, 80, 95, 77, 73, 78, 85, 83, 0, 75, 95, 75, 80, 95, 77, 85, 76, 84, 73, 80, 76, 89, 0, 75, 95, 75, 80, 95, 68, 73, 86, 73, 68, 69, 0, 75, 95, 75, 80, 95, 80, 69, 82, 73, 79, 68, 0, 75, 95, 75, 80, 57, 0, 75, 95, 75, 80, 56, 0, 75, 95, 75, 80, 55, 0, 75, 95, 75, 80, 54, 0, 75, 95, 75, 80, 53, 0, 75, 95, 75, 80, 52, 0, 75, 95, 75, 80, 51, 0, 75, 95, 75, 80, 50, 0, 75, 95, 75, 80, 49, 0, 75, 95, 75, 80, 48, 0, 75, 95, 68, 69, 76, 69, 84, 69, 0, 75, 95, 122, 0, 75, 95, 121, 0, 75, 95, 120, 0, 75, 95, 119, 0, 75, 95, 118, 0, 75, 95, 117, 0, 75, 95, 116, 0, 75, 95, 115, 0, 75, 95, 114, 0, 75, 95, 113, 0, 75, 95, 112, 0, 75, 95, 111, 0, 75, 95, 110, 0, 75, 95, 109, 0, 75, 95, 108, 0, 75, 95, 107, 0, 75, 95, 106, 0, 75, 95, 105, 0, 75, 95, 104, 0, 75, 95, 103, 0, 75, 95, 102, 0, 75, 95, 101, 0, 75, 95, 100, 0, 75, 95, 99, 0, 75, 95, 98, 0, 75, 95, 97, 0, 75, 95, 66, 65, 67, 75, 81, 85, 79, 84, 69, 0, 75, 95, 85, 78, 68, 69, 82, 83, 67, 79, 82, 69, 0, 75, 95, 67, 65, 82, 69, 84, 0, 75, 95, 82, 73, 71, 72, 84, 66, 82, 65, 67, 75, 69, 84, 0, 75, 95, 66, 65, 67, 75, 83, 76, 65, 83, 72, 0, 75, 95, 76, 69, 70, 84, 66, 82, 65, 67, 75, 69, 84, 0, 75, 95, 65, 84, 0, 75, 95, 81, 85, 69, 83, 84, 73, 79, 78, 0, 75, 95, 71, 82, 69, 65, 84, 69, 82, 0, 75, 95, 69, 81, 85, 65, 76, 83, 0, 75, 95, 76, 69, 83, 83, 0, 75, 95, 83, 69, 77, 73, 67, 79, 76, 79, 78, 0, 75, 95, 67, 79, 76, 79, 78, 0, 75, 95, 57, 0, 75, 95, 56, 0, 75, 95, 55, 0, 75, 95, 54, 0, 75, 95, 53, 0, 75, 95, 52, 0, 75, 95, 51, 0, 75, 95, 50, 0, 75, 95, 49, 0, 75, 95, 48, 0, 75, 95, 83, 76, 65, 83, 72, 0, 75, 95, 80, 69, 82, 73, 79, 68, 0, 75, 95, 77, 73, 78, 85, 83, 0, 75, 95, 67, 79, 77, 77, 65, 0, 75, 95, 80, 76, 85, 83, 0, 75, 95, 65, 83, 84, 69, 82, 73, 83, 75, 0, 75, 95, 82, 73, 71, 72, 84, 80, 65, 82, 69, 78, 0, 75, 95, 76, 69, 70, 84, 80, 65, 82, 69, 78, 0, 75, 95, 81, 85, 79, 84, 69, 0, 75, 95, 65, 77, 80, 69, 82, 83, 65, 78, 68, 0, 75, 95, 68, 79, 76, 76, 65, 82, 0, 75, 95, 72, 65, 83, 72, 0, 75, 95, 81, 85, 79, 84, 69, 68, 66, 76, 0, 75, 95, 69, 88, 67, 76, 65, 73, 77, 0, 75, 95, 83, 80, 65, 67, 69, 0, 75, 95, 69, 83, 67, 65, 80, 69, 0, 75, 95, 80, 65, 85, 83, 69, 0, 75, 95, 82, 69, 84, 85, 82, 78, 0, 75, 95, 67, 76, 69, 65, 82, 0, 75, 95, 84, 65, 66, 0, 75, 95, 66, 65, 67, 75, 83, 80, 65, 67, 69, 0, 75, 95, 70, 73, 82, 83, 84, 0, 75, 95, 85, 78, 75, 78, 79, 87, 78, 0, 109, 111, 100, 0, 77, 79, 68, 95, 68, 85, 77, 77, 89, 0, 77, 79, 68, 95, 83, 67, 82, 79, 76, 76, 79, 67, 75, 0, 77, 79, 68, 95, 67, 65, 80, 83, 76, 79, 67, 75, 0, 77, 79, 68, 95, 78, 85, 77, 76, 79, 67, 75, 0, 77, 79, 68, 95, 77, 69, 84, 65, 0, 77, 79, 68, 95, 65, 76, 84, 0, 77, 79, 68, 95, 67, 84, 82, 76, 0, 77, 79, 68, 95, 83, 72, 73, 70, 84, 0, 77, 79, 68, 95, 78, 79, 78, 69, 0, 108, 111, 103, 95, 108, 101, 118, 101, 108, 0, 76, 79, 71, 95, 68, 85, 77, 77, 89, 0, 76, 79, 71, 95, 69, 82, 82, 79, 82, 0, 76, 79, 71, 95, 87, 65, 82, 78, 0, 76, 79, 71, 95, 73, 78, 70, 79, 0, 76, 79, 71, 95, 68, 69, 66, 85, 71, 0, 115, 101, 110, 115, 111, 114, 95, 97, 99, 116, 105, 111, 110, 0, 83, 69, 78, 83, 79, 82, 95, 68, 85, 77, 77, 89, 0, 83, 69, 78, 83, 79, 82, 95, 65, 67, 67, 69, 76, 69, 82, 79, 77, 69, 84, 69, 82, 95, 68, 73, 83, 65, 66, 76, 69, 0, 83, 69, 78, 83, 79, 82, 95, 65, 67, 67, 69, 76, 69, 82, 79, 77, 69, 84, 69, 82, 95, 69, 78, 65, 66, 76, 69, 0, 99, 97, 109, 101, 114, 97, 95, 98, 117, 102, 102, 101, 114, 0, 67, 65, 77, 69, 82, 65, 95, 66, 85, 70, 70, 69, 82, 95, 68, 85, 77, 77, 89, 0, 67, 65, 77, 69, 82, 65, 95, 66, 85, 70, 70, 69, 82, 95, 82, 65, 87, 95, 70, 82, 65, 77, 69, 66, 85, 70, 70, 69, 82, 0, 67, 65, 77, 69, 82, 65, 95, 66, 85, 70, 70, 69, 82, 95, 79, 80, 69, 78, 71, 76, 95, 84, 69, 88, 84, 85, 82, 69, 0, 114, 117, 109, 98, 108, 101, 95, 101, 102, 102, 101, 99, 116, 0, 82, 85, 77, 66, 76, 69, 95, 68, 85, 77, 77, 89, 0, 82, 85, 77, 66, 76, 69, 95, 87, 69, 65, 75, 0, 82, 85, 77, 66, 76, 69, 95, 83, 84, 82, 79, 78, 71, 0, 104, 119, 95, 99, 111, 110, 116, 101, 120, 116, 95, 116, 121, 112, 101, 0, 72, 87, 95, 67, 79, 78, 84, 69, 88, 84, 95, 68, 85, 77, 77, 89, 0, 72, 87, 95, 67, 79, 78, 84, 69, 88, 84, 95, 79, 80, 69, 78, 71, 76, 69, 83, 95, 86, 69, 82, 83, 73, 79, 78, 0, 72, 87, 95, 67, 79, 78, 84, 69, 88, 84, 95, 79, 80, 69, 78, 71, 76, 69, 83, 51, 0, 72, 87, 95, 67, 79, 78, 84, 69, 88, 84, 95, 79, 80, 69, 78, 71, 76, 95, 67, 79, 82, 69, 0, 72, 87, 95, 67, 79, 78, 84, 69, 88, 84, 95, 79, 80, 69, 78, 71, 76, 69, 83, 50, 0, 72, 87, 95, 67, 79, 78, 84, 69, 88, 84, 95, 79, 80, 69, 78, 71, 76, 0, 72, 87, 95, 67, 79, 78, 84, 69, 88, 84, 95, 78, 79, 78, 69, 0, 112, 105, 120, 101, 108, 95, 102, 111, 114, 109, 97, 116, 0, 80, 73, 88, 69, 76, 95, 70, 79, 82, 77, 65, 84, 95, 85, 78, 75, 78, 79, 87, 78, 0, 80, 73, 88, 69, 76, 95, 70, 79, 82, 77, 65, 84, 95, 82, 71, 66, 53, 54, 53, 0, 80, 73, 88, 69, 76, 95, 70, 79, 82, 77, 65, 84, 95, 88, 82, 71, 66, 56, 56, 56, 56, 0, 80, 73, 88, 69, 76, 95, 70, 79, 82, 77, 65, 84, 95, 48, 82, 71, 66, 49, 53, 53, 53, 0, 105, 110, 105, 116, 0, 118, 105, 0, 100, 101, 105, 110, 105, 116, 0, 97, 112, 105, 95, 118, 101, 114, 115, 105, 111, 110, 0, 105, 105, 0, 114, 101, 115, 101, 116, 0, 114, 117, 110, 0, 117, 110, 108, 111, 97, 100, 95, 103, 97, 109, 101, 0, 103, 101, 116, 95, 114, 101, 103, 105, 111, 110, 0, 99, 104, 101, 97, 116, 95, 114, 101, 115, 101, 116, 0, 103, 101, 116, 95, 109, 101, 109, 111, 114, 121, 95, 115, 105, 122, 101, 0, 105, 105, 105, 0, 115, 101, 114, 105, 97, 108, 105, 122, 101, 95, 115, 105, 122, 101, 0, 115, 101, 116, 95, 99, 111, 110, 116, 114, 111, 108, 108, 101, 114, 95, 112, 111, 114, 116, 95, 100, 101, 118, 105, 99, 101, 0, 118, 105, 105, 105, 0, 49, 56, 114, 101, 116, 114, 111, 95, 112, 105, 120, 101, 108, 95, 102, 111, 114, 109, 97, 116, 0, 50, 49, 114, 101, 116, 114, 111, 95, 104, 119, 95, 99, 111, 110, 116, 101, 120, 116, 95, 116, 121, 112, 101, 0, 49, 57, 114, 101, 116, 114, 111, 95, 114, 117, 109, 98, 108, 101, 95, 101, 102, 102, 101, 99, 116, 0, 49, 57, 114, 101, 116, 114, 111, 95, 99, 97, 109, 101, 114, 97, 95, 98, 117, 102, 102, 101, 114, 0, 49, 57, 114, 101, 116, 114, 111, 95, 115, 101, 110, 115, 111, 114, 95, 97, 99, 116, 105, 111, 110, 0, 49, 53, 114, 101, 116, 114, 111, 95, 108, 111, 103, 95, 108, 101, 118, 101, 108, 0, 57, 114, 101, 116, 114, 111, 95, 109, 111, 100, 0, 57, 114, 101, 116, 114, 111, 95, 107, 101, 121, 0, 49, 52, 114, 101, 116, 114, 111, 95, 108, 97, 110, 103, 117, 97, 103, 101, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 124, 198, 198, 198, 198, 198, 124, 0, 24, 56, 24, 24, 24, 24, 60, 0, 60, 102, 12, 24, 48, 96, 126, 0, 124, 198, 6, 60, 6, 198, 124, 0, 204, 204, 204, 254, 12, 12, 12, 0, 254, 192, 192, 124, 6, 198, 124, 0, 124, 198, 192, 252, 198, 198, 124, 0, 254, 6, 12, 24, 48, 96, 192, 0, 124, 198, 198, 124, 198, 198, 124, 0, 124, 198, 198, 126, 6, 198, 124, 0, 0, 24, 24, 0, 24, 24, 0, 0, 24, 126, 88, 126, 26, 126, 24, 0, 0, 0, 0, 0, 0, 0, 0, 0, 60, 102, 12, 24, 24, 0, 24, 0, 192, 192, 192, 192, 192, 192, 254, 0, 252, 198, 198, 252, 192, 192, 192, 0, 0, 24, 24, 126, 24, 24, 0, 0, 198, 198, 198, 214, 254, 238, 198, 0, 254, 192, 192, 248, 192, 192, 254, 0, 252, 198, 198, 252, 216, 204, 198, 0, 126, 24, 24, 24, 24, 24, 24, 0, 198, 198, 198, 198, 198, 198, 124, 0, 60, 24, 24, 24, 24, 24, 60, 0, 124, 198, 198, 198, 198, 198, 124, 0, 124, 198, 198, 198, 222, 204, 118, 0, 124, 198, 192, 124, 6, 198, 124, 0, 252, 198, 198, 198, 198, 198, 252, 0, 254, 192, 192, 248, 192, 192, 192, 0, 124, 198, 192, 192, 206, 198, 126, 0, 198, 198, 198, 254, 198, 198, 198, 0, 6, 6, 6, 6, 6, 198, 124, 0, 198, 204, 216, 240, 216, 204, 198, 0, 56, 108, 198, 198, 254, 198, 198, 0, 126, 6, 12, 24, 48, 96, 126, 0, 198, 198, 108, 56, 108, 198, 198, 0, 124, 198, 192, 192, 192, 198, 124, 0, 198, 198, 198, 198, 198, 108, 56, 0, 252, 198, 198, 252, 198, 198, 252, 0, 198, 238, 254, 214, 198, 198, 198, 0, 0, 0, 0, 0, 0, 56, 56, 0, 0, 0, 0, 126, 0, 0, 0, 0, 0, 102, 60, 24, 60, 102, 0, 0, 0, 24, 0, 126, 0, 24, 0, 0, 0, 0, 124, 0, 124, 0, 0, 0, 102, 102, 102, 60, 24, 24, 24, 0, 198, 230, 246, 254, 222, 206, 198, 0, 3, 6, 12, 24, 48, 96, 192, 0, 255, 255, 255, 255, 255, 255, 255, 0, 206, 219, 219, 219, 219, 219, 206, 0, 0, 0, 60, 126, 126, 126, 60, 0, 28, 28, 24, 30, 24, 24, 28, 0, 28, 28, 24, 30, 24, 52, 38, 0, 56, 56, 24, 120, 24, 44, 100, 0, 56, 56, 24, 120, 24, 24, 56, 0, 0, 24, 12, 254, 12, 24, 0, 0, 24, 60, 126, 255, 255, 24, 24, 0, 3, 7, 15, 31, 63, 127, 255, 0, 192, 224, 240, 248, 252, 254, 255, 0, 56, 56, 18, 254, 184, 40, 108, 0, 192, 96, 48, 24, 12, 6, 3, 0, 0, 0, 12, 8, 8, 255, 126, 0, 0, 3, 99, 255, 255, 24, 8, 0, 0, 0, 0, 16, 56, 255, 126, 0, 0, 0, 0, 6, 110, 255, 126], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 246404);
  allocate([56, 68, 64, 32, 16, 0, 16, 0, 0, 0, 16, 40, 0, 56, 68, 124, 68, 0, 0, 0, 8, 16, 60, 32, 48, 32, 60, 0, 0, 0, 8, 20, 16, 56, 16, 36, 60, 0, 0, 0, 16, 56, 80, 56, 20, 84, 56, 16, 0, 0, 56, 68, 64, 64, 64, 68, 56, 16, 32, 0, 40, 40, 124, 40, 124, 40, 40, 0, 0, 0, 32, 24, 0, 56, 68, 124, 68, 0, 0, 0, 32, 24, 0, 68, 68, 68, 56, 0, 0, 0, 16, 8, 60, 32, 48, 32, 60, 0, 0, 0, 60, 80, 80, 88, 80, 80, 60, 0, 0, 0, 8, 20, 60, 32, 48, 32, 60, 0, 0, 0, 0, 16, 32, 127, 32, 16, 0, 0, 0, 0, 16, 56, 84, 16, 16, 16, 16, 16, 16, 0, 0, 8, 4, 254, 4, 8, 0, 0, 0, 16, 16, 16, 16, 16, 16, 84, 56, 16, 0, 0, 24, 36, 24, 0, 0, 0, 0, 0, 0, 0, 16, 16, 124, 16, 16, 0, 124, 0, 0, 0, 8, 16, 56, 68, 124, 64, 56, 0, 0, 0, 40, 0, 56, 68, 124, 64, 56, 0, 0, 0, 40, 0, 48, 16, 16, 16, 56, 0, 0, 0, 0, 0, 56, 64, 64, 64, 56, 16, 32, 0, 16, 40, 0, 68, 68, 76, 52, 0, 0, 0, 32, 16, 52, 76, 68, 76, 52, 0, 0, 0, 0, 16, 0, 124, 0, 16, 0, 0, 0, 0, 32, 16, 56, 68, 124, 64, 56, 0, 0, 0, 0, 0, 60, 82, 94, 80, 62, 0, 0, 0, 16, 40, 56, 68, 124, 64, 56, 0, 0, 0, 64, 192, 64, 68, 76, 20, 62, 4, 0, 0, 64, 192, 64, 76, 82, 4, 8, 30, 0, 0, 224, 32, 64, 36, 204, 20, 62, 4, 0, 0, 16, 40, 0, 56, 68, 68, 56, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16, 16, 16, 16, 16, 0, 16, 0, 0, 0, 40, 40, 40, 0, 0, 0, 0, 0, 0, 0, 40, 0, 60, 32, 48, 32, 60, 0, 0, 0, 16, 40, 52, 76, 68, 76, 52, 0, 0, 0, 96, 100, 8, 16, 32, 76, 12, 0, 0, 0, 32, 80, 80, 32, 84, 72, 52, 0, 0, 0, 16, 16, 32, 0, 0, 0, 0, 0, 0, 0, 8, 16, 32, 32, 32, 16, 8, 0, 0, 0, 32, 16, 8, 8, 8, 16, 32, 0, 0, 0, 16, 84, 56, 16, 56, 84, 16, 0, 0, 0, 0, 16, 16, 124, 16, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, 32, 64, 0, 0, 0, 0, 0, 0, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, 0, 0, 1, 2, 2, 4, 8, 16, 32, 32, 64, 128, 0, 16, 40, 68, 68, 68, 40, 16, 0, 0, 0, 16, 48, 16, 16, 16, 16, 16, 0, 0, 0, 56, 68, 4, 24, 32, 64, 124, 0, 0, 0, 124, 4, 8, 24, 4, 68, 56, 0, 0, 0, 8, 24, 40, 72, 124, 8, 8, 0, 0, 0, 124, 64, 120, 4, 4, 68, 56, 0, 0, 0, 24, 32, 64, 120, 68, 68, 56, 0, 0, 0, 124, 4, 8, 16, 32, 32, 32, 0, 0, 0, 56, 68, 68, 56, 68, 68, 56, 0, 0, 0, 56, 68, 68, 60, 4, 4, 56, 0, 0, 0, 0, 0, 32, 0, 0, 0, 32, 0, 0, 0, 0, 0, 32, 0, 0, 32, 32, 64, 0, 0, 4, 8, 16, 32, 16, 8, 4, 0, 0, 0, 0, 0, 124, 0, 124, 0, 0, 0, 0, 0, 64, 32, 16, 8, 16, 32, 64, 0, 0, 0, 56, 68, 4, 8, 16, 0, 16, 0, 0, 0, 56, 68, 92, 84, 92, 64, 56, 0, 0, 0, 56, 68, 68, 68, 124, 68, 68, 0, 0, 0, 120, 68, 68, 120, 68, 68, 120, 0, 0, 0, 56, 68, 64, 64, 64, 68, 56, 0, 0, 0, 120, 68, 68, 68, 68, 68, 120, 0, 0, 0, 124, 64, 64, 112, 64, 64, 124, 0, 0, 0, 124, 64, 64, 112, 64, 64, 64, 0, 0, 0, 56, 68, 64, 64, 76, 68, 60, 0, 0, 0, 68, 68, 68, 124, 68, 68, 68, 0, 0, 0, 56, 16, 16, 16, 16, 16, 56, 0, 0, 0, 28, 8, 8, 8, 8, 72, 48, 0, 0, 0, 68, 72, 80, 96, 80, 72, 68, 0, 0, 0, 64, 64, 64, 64, 64, 64, 124, 0, 0, 0, 68, 108, 84, 68, 68, 68, 68, 0, 0, 0, 68, 68, 100, 84, 76, 68, 68, 0, 0, 0, 56, 68, 68, 68, 68, 68, 56, 0, 0, 0, 120, 68, 68, 120, 64, 64, 64, 0, 0, 0, 56, 68, 68, 68, 84, 72, 52, 0, 0, 0, 120, 68, 68, 120, 80, 72, 68, 0, 0, 0, 56, 68, 64, 56, 4, 68, 56, 0, 0, 0, 124, 16, 16, 16, 16, 16, 16, 0, 0, 0, 68, 68, 68, 68, 68, 68, 56, 0, 0, 0, 68, 68, 68, 40, 40, 16, 16, 0, 0, 0, 68, 68, 68, 84, 84, 84, 40, 0, 0, 0, 68, 68, 40, 16, 40, 68, 68, 0, 0, 0, 68, 68, 40, 16, 16, 16, 16, 0, 0, 0, 124, 4, 8, 16, 32, 64, 124, 0, 0, 0, 28, 16, 16, 16, 16, 16, 28, 0, 0, 128, 64, 64, 32, 16, 8, 4, 4, 2, 1, 0, 56, 8, 8, 8, 8, 8, 56, 0, 0, 0, 16, 40, 0, 48, 16, 16, 56, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 52, 76, 68, 76, 52, 0, 0, 0, 64, 64, 120, 68, 68, 68, 120, 0, 0, 0, 0, 0, 56, 64, 64, 64, 56, 0, 0, 0, 4, 4, 60, 68, 68, 68, 60, 0, 0, 0, 0, 0, 56, 68, 124, 64, 56, 0, 0, 0, 24, 36, 32, 112, 32, 32, 32, 0, 0, 0, 0, 0, 60, 68, 68, 60, 4, 36, 24, 0, 64, 64, 88, 100, 68, 68, 68, 0, 0, 0, 16, 0, 48, 16, 16, 16, 56, 0, 0, 0, 8, 0, 24, 8, 8, 8, 8, 72, 48, 0, 32, 32, 36, 40, 48, 40, 36, 0, 0, 0, 48, 16, 16, 16, 16, 16, 56, 0, 0, 0, 0, 0, 104, 84, 84, 84, 84, 0, 0, 0, 0, 0, 88, 100, 68, 68, 68, 0, 0, 0, 0, 0, 56, 68, 68, 68, 56, 0, 0, 0, 0, 0, 120, 68, 68, 68, 120, 64, 64, 0, 0, 0, 60, 68, 68, 68, 60, 4, 4, 0, 0, 0, 88, 100, 64, 64, 64, 0, 0, 0, 0, 0, 56, 64, 56, 4, 120, 0, 0, 0, 32, 32, 56, 32, 32, 32, 24, 0, 0, 0, 0, 0, 68, 68, 68, 76, 52, 0, 0, 0, 0, 0, 68, 68, 40, 40, 16, 0, 0, 0, 0, 0, 68, 68, 84, 84, 40, 0, 0, 0, 0, 0, 68, 40, 16, 40, 68, 0, 0, 0, 0, 0, 68, 68, 76, 52, 4, 68, 56, 0, 0, 0, 124, 8, 16, 32, 124, 0, 0, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 112, 112, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 119, 119, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 112, 112, 112, 0, 0, 0, 0, 112, 112, 0, 112, 112, 112, 0, 0, 0, 0, 7, 7, 0, 112, 112, 112, 0, 0, 0, 0, 119, 119, 0, 112, 112, 112, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 0, 0, 0, 0, 112, 112, 0, 7, 7, 7, 0, 0, 0, 0, 7, 7, 0, 7, 7, 7, 0, 0, 0, 0, 119, 119, 0, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 119, 119, 119, 0, 0, 0, 0, 112, 112, 0, 119, 119, 119, 0, 0, 0, 0, 7, 7, 0, 119, 119, 119, 0, 0, 0, 0, 119, 119, 0, 119, 119, 119, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 112, 112, 0, 112, 112, 0, 0, 0, 0, 0, 112, 112, 0, 7, 7, 0, 0, 0, 0, 0, 112, 112, 0, 119, 119, 0, 0, 0, 0, 0, 112, 112, 0, 0, 0, 0, 112, 112, 112, 0, 112, 112, 0, 112, 112, 0, 112, 112, 112, 0, 112, 112, 0, 7, 7, 0, 112, 112, 112, 0, 112, 112, 0, 119, 119, 0, 112, 112, 112, 0, 112, 112, 0, 0, 0, 0, 7, 7, 7, 0, 112, 112, 0, 112, 112, 0, 7, 7, 7, 0, 112, 112, 0, 7, 7, 0, 7, 7, 7, 0, 112, 112, 0, 119, 119, 0, 7, 7, 7, 0, 112, 112, 0, 0, 0, 0, 119, 119, 119, 0, 112, 112, 0, 112, 112, 0, 119, 119, 119, 0, 112, 112, 0, 7, 7, 0, 119, 119, 119, 0, 112, 112, 0, 119, 119, 0, 119, 119, 119, 0, 112, 112, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 0, 112, 112, 0, 0, 0, 0, 0, 7, 7, 0, 7, 7, 0, 0, 0, 0, 0, 7, 7, 0, 119, 119, 0, 0, 0, 0, 0, 7, 7, 0, 0, 0, 0, 112, 112, 112, 0, 7, 7, 0, 112, 112, 0, 112, 112, 112, 0, 7, 7, 0, 7, 7, 0, 112, 112, 112, 0, 7, 7, 0, 119, 119, 0, 112, 112, 112, 0, 7, 7, 0, 0, 0, 0, 7, 7, 7, 0, 7, 7, 0, 112, 112, 0, 7, 7, 7, 0, 7, 7, 0, 7, 7, 0, 7, 7, 7, 0, 7, 7, 0, 119, 119, 0, 7, 7, 7, 0, 7, 7, 0, 0, 0, 0, 119, 119, 119, 0, 7, 7, 0, 112, 112, 0, 119, 119, 119, 0, 7, 7, 0, 7, 7, 0, 119, 119, 119, 0, 7, 7, 0, 119, 119, 0, 119, 119, 119, 0, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 119, 119, 0, 112, 112, 0, 0, 0, 0, 0, 119, 119, 0, 7, 7, 0, 0, 0, 0, 0, 119, 119, 0, 119, 119, 0, 0, 0, 0, 0, 119, 119, 0, 0, 0, 0, 112, 112, 112, 0, 119, 119, 0, 112, 112, 0, 112, 112, 112, 0, 119, 119, 0, 7, 7, 0, 112, 112, 112, 0, 119, 119, 0, 119, 119, 0, 112, 112, 112, 0, 119, 119, 0, 0, 0, 0, 7, 7, 7, 0, 119, 119, 0, 112, 112, 0, 7, 7, 7, 0, 119, 119, 0, 7, 7, 0, 7, 7, 7, 0, 119, 119, 0, 119, 119, 0, 7, 7, 7, 0, 119, 119, 0, 0, 0, 0, 119, 119, 119, 0, 119, 119, 0, 112, 112, 0, 119, 119, 119, 0, 119, 119, 0, 7, 7, 0, 119, 119, 119, 0, 119, 119, 0, 119, 119, 0, 119, 119, 119, 0, 119, 119, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 240, 240, 240, 0, 0, 0, 0, 0, 0, 0, 15, 15, 15, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 240, 240, 240, 240, 0, 0, 0, 240, 240, 240, 240, 240, 240, 240, 0, 0, 0, 15, 15, 15, 240, 240, 240, 240, 0, 0, 0, 255, 255, 255, 240, 240, 240, 240, 0, 0, 0, 0, 0, 0, 15, 15, 15, 15, 0, 0, 0, 240, 240, 240, 15, 15, 15, 15, 0, 0, 0, 15, 15, 15, 15, 15, 15, 15, 0, 0, 0, 255, 255, 255, 15, 15, 15, 15, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 240, 240, 240, 255, 255, 255, 255, 0, 0, 0, 15, 15, 15, 255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 240, 240, 240, 240, 240, 240, 0, 0, 0, 0, 240, 240, 240, 15, 15, 15, 0, 0, 0, 0, 240, 240, 240, 255, 255, 255, 0, 0, 0, 0, 240, 240, 240, 0, 0, 0, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 15, 15, 15, 240, 240, 240, 240, 240, 240, 240, 255, 255, 255, 240, 240, 240, 240, 240, 240, 240, 0, 0, 0, 15, 15, 15, 15, 240, 240, 240, 240, 240, 240, 15, 15, 15, 15, 240, 240, 240, 15, 15, 15, 15, 15, 15, 15, 240, 240, 240, 255, 255, 255, 15, 15, 15, 15, 240, 240, 240, 0, 0, 0, 255, 255, 255, 255, 240, 240, 240, 240, 240, 240, 255, 255, 255, 255, 240, 240, 240, 15, 15, 15, 255, 255, 255, 255, 240, 240, 240, 255, 255, 255, 255, 255, 255, 255, 240, 240, 240, 0, 0, 0, 0, 0, 0, 0, 15, 15, 15, 240, 240, 240, 0, 0, 0, 0, 15, 15, 15, 15, 15, 15, 0, 0, 0, 0, 15, 15, 15, 255, 255, 255, 0, 0, 0, 0, 15, 15, 15, 0, 0, 0, 240, 240, 240, 240, 15, 15, 15, 240, 240, 240, 240, 240, 240, 240, 15, 15, 15, 15, 15, 15, 240, 240, 240, 240, 15, 15, 15, 255, 255, 255, 240, 240, 240, 240, 15, 15, 15, 0, 0, 0, 15, 15, 15, 15, 15, 15, 15, 240, 240, 240, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 255, 255, 255, 15, 15, 15, 15, 15, 15, 15, 0, 0, 0, 255, 255, 255, 255, 15, 15, 15, 240, 240, 240, 255, 255, 255, 255, 15, 15, 15, 15, 15, 15, 255, 255, 255, 255, 15, 15, 15, 255, 255, 255, 255, 255, 255, 255, 15, 15, 15, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 240, 240, 240, 0, 0, 0, 0, 255, 255, 255, 15, 15, 15, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 255, 0, 0, 0, 240, 240, 240, 240, 255, 255, 255, 240, 240, 240, 240, 240, 240, 240, 255, 255, 255, 15, 15, 15, 240, 240, 240, 240, 255, 255, 255, 255, 255, 255, 240, 240, 240, 240, 255, 255, 255, 0, 0, 0, 15, 15, 15, 15, 255, 255, 255, 240, 240, 240, 15, 15, 15, 15, 255, 255, 255, 15, 15, 15, 15, 15, 15, 15, 255, 255, 255, 255, 255, 255, 15, 15, 15, 15, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 240, 240, 240, 255, 255, 255, 255, 255, 255, 255, 15, 15, 15, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 294977);
  allocate([73, 110, 105, 116, 105, 97, 108, 105, 122, 105, 110, 103, 32, 115, 111, 117, 110, 100, 32, 115, 121, 115, 116, 101, 109, 46, 46, 46, 0, 42, 42, 32, 117, 110, 105, 109, 112, 108, 101, 109, 101, 110, 116, 101, 100, 32, 105, 110, 115, 116, 114, 117, 99, 116, 105, 111, 110, 32, 37, 120, 44, 32, 37, 120, 42, 42, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 67, 111, 117, 108, 100, 32, 110, 111, 116, 32, 97, 108, 108, 111, 99, 97, 116, 101, 32, 109, 101, 109, 111, 114, 121, 32, 102, 111, 114, 32, 115, 99, 114, 101, 101, 110, 32, 98, 117, 102, 102, 101, 114, 46, 10, 0, 67, 111, 117, 108, 100, 32, 110, 111, 116, 32, 97, 108, 108, 111, 99, 97, 116, 101, 32, 109, 101, 109, 111, 114, 121, 32, 102, 111, 114, 32, 99, 111, 108, 108, 105, 115, 105, 111, 110, 32, 98, 117, 102, 102, 101, 114, 46, 10], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 299649);
  allocate([255, 255, 0, 0, 117, 110, 115, 117, 112, 112, 111, 114, 116, 101, 100, 58, 32, 67, 72, 65, 82, 82, 79, 77, 32, 114, 101, 97, 100, 32, 37, 100, 32, 37, 100, 32, 37, 100, 10, 0, 0, 0, 0, 117, 110, 115, 117, 112, 112, 111, 114, 116, 101, 100, 58, 32, 103, 108, 111, 98, 97, 108, 32, 100, 111, 117, 98, 108, 101, 32, 104, 101, 105, 103, 104, 116, 0, 67, 111, 117, 108, 100, 32, 110, 111, 116, 32, 97, 108, 108, 111, 99, 97, 116, 101, 32, 109, 101, 109, 111, 114, 121, 32, 102, 111, 114, 32, 86, 105, 100, 101, 111, 112, 97, 99, 43, 32, 115, 99, 114, 101, 101, 110, 32, 98, 117, 102, 102, 101, 114, 46, 10, 0, 79, 50, 69, 77, 0, 49, 46, 49, 56, 0, 98, 105, 110, 0, 91, 79, 50, 69, 77, 93, 58, 32, 82, 71, 66, 53, 54, 53, 32, 105, 115, 32, 110, 111, 116, 32, 115, 117, 112, 112, 111, 114, 116, 101, 100, 46, 10, 0, 91, 79, 50, 69, 77, 93, 58, 32, 110, 111, 32, 115, 121, 115, 116, 101, 109, 32, 100, 105, 114, 101, 99, 116, 111, 114, 121, 32, 100, 101, 102, 105, 110, 101, 100, 44, 32, 117, 110, 97, 98, 108, 101, 32, 116, 111, 32, 108, 111, 111, 107, 32, 102, 111, 114, 32, 111, 50, 114, 111, 109, 46, 98, 105, 110, 10, 0, 37, 115, 37, 99, 37, 115, 0, 111, 50, 114, 111, 109, 46, 98, 105, 110, 0, 91, 79, 50, 69, 77, 93, 58, 32, 111, 50, 114, 111, 109, 46, 98, 105, 110, 32, 110, 111, 116, 32, 102, 111, 117, 110, 100, 44, 32, 99, 97, 110, 110, 111, 116, 32, 108, 111, 97, 100, 32, 66, 73, 79, 83, 10, 0, 79, 50, 69, 77, 32, 118, 49, 46, 49, 56], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 607782);
  allocate([104, 105, 103, 104, 115, 99, 111, 114, 101, 46, 116, 120, 116], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 620393);
  allocate([114, 98, 0, 69, 114, 114, 111, 114, 32, 108, 111, 97, 100, 105, 110, 103, 32, 98, 105, 111, 115, 32, 82, 79, 77, 32, 40, 37, 115, 41, 10, 0, 69, 114, 114, 111, 114, 32, 108, 111, 97, 100, 105, 110, 103, 32, 98, 105, 111, 115, 32, 82, 79, 77, 32, 37, 115, 10, 0, 79, 100, 121, 115, 115, 101, 121, 50, 32, 98, 105, 111, 115, 32, 82, 79, 77, 32, 108, 111, 97, 100, 101, 100, 0, 86, 105, 100, 101, 111, 112, 97, 99, 43, 32, 71, 55, 52, 48, 48, 32, 98, 105, 111, 115, 32, 82, 79, 77, 32, 108, 111, 97, 100, 101, 100, 0, 67, 53, 50, 32, 98, 105, 111, 115, 32, 82, 79, 77, 32, 108, 111, 97, 100, 101, 100, 0, 79, 107, 0, 74, 111, 112, 97, 99, 32, 98, 105, 111, 115, 32, 82, 79, 77, 32, 108, 111, 97, 100, 101, 100, 0, 32, 79, 107, 0, 66, 105, 111, 115, 32, 82, 79, 77, 32, 108, 111, 97, 100, 101, 100, 32, 40, 117, 110, 107, 110, 111, 119, 110, 32, 118, 101, 114, 115, 105, 111, 110, 41, 0, 69, 114, 114, 111, 114, 58, 32, 102, 105, 108, 101, 32, 37, 115, 32, 105, 115, 32, 97, 110, 32, 105, 110, 99, 111, 109, 112, 108, 101, 116, 101, 32, 82, 79, 77, 32, 100, 117, 109, 112, 10], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 628609);
  allocate([69, 114, 114, 111, 114, 32, 108, 111, 97, 100, 105, 110, 103, 32, 37, 115, 10, 0, 76, 111, 97, 100, 105, 110, 103, 58, 32, 34, 37, 115, 34, 32, 32, 83, 105, 122, 101, 58, 32, 0, 69, 114, 114, 111, 114, 58, 32, 102, 105, 108, 101, 32, 37, 115, 32, 105, 115, 32, 97, 110, 32, 105, 110, 118, 97, 108, 105, 100, 32, 82, 79, 77, 32, 100, 117, 109, 112, 10, 0, 79, 117, 116, 32, 111, 102, 32, 109, 101, 109, 111, 114, 121, 32, 108, 111, 97, 100, 105, 110, 103, 32, 37, 115, 10, 0, 77, 101, 103, 97, 67, 97, 114, 116, 32, 37, 108, 100, 75, 0, 37, 100, 75, 0, 51, 75, 32, 69, 88, 82, 79, 77, 0, 32, 32, 67, 82, 67, 58, 32, 37, 48, 56, 108, 88, 10, 0, 76, 101, 102, 116, 0, 85, 112, 0, 68, 111, 119, 110, 0, 82, 105, 103, 104, 116, 0, 70, 105, 114, 101, 0, 65, 99, 116, 105, 111, 110, 0, 118, 111, 105, 100, 0, 98, 111, 111, 108, 0, 99, 104, 97, 114, 0, 115, 105, 103, 110, 101, 100, 32, 99, 104, 97, 114, 0, 117, 110, 115, 105, 103, 110, 101, 100, 32, 99, 104, 97, 114, 0, 115, 104, 111, 114, 116, 0, 117, 110, 115, 105, 103, 110, 101, 100, 32, 115, 104, 111, 114, 116, 0, 105, 110, 116, 0, 117, 110, 115, 105, 103, 110, 101, 100, 32, 105, 110, 116, 0, 108, 111, 110, 103, 0, 117, 110, 115, 105, 103, 110, 101, 100, 32, 108, 111, 110, 103, 0, 102, 108, 111, 97, 116, 0, 100, 111, 117, 98, 108, 101, 0, 115, 116, 100, 58, 58, 115, 116, 114, 105, 110, 103, 0, 115, 116, 100, 58, 58, 98, 97, 115, 105, 99, 95, 115, 116, 114, 105, 110, 103, 60, 117, 110, 115, 105, 103, 110, 101, 100, 32, 99, 104, 97, 114, 62, 0, 115, 116, 100, 58, 58, 119, 115, 116, 114, 105, 110, 103, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 118, 97, 108, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 99, 104, 97, 114, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 115, 105, 103, 110, 101, 100, 32, 99, 104, 97, 114, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 117, 110, 115, 105, 103, 110, 101, 100, 32, 99, 104, 97, 114, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 115, 104, 111, 114, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 117, 110, 115, 105, 103, 110, 101, 100, 32, 115, 104, 111, 114, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 105, 110, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 117, 110, 115, 105, 103, 110, 101, 100, 32, 105, 110, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 108, 111, 110, 103, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 117, 110, 115, 105, 103, 110, 101, 100, 32, 108, 111, 110, 103, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 105, 110, 116, 56, 95, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 117, 105, 110, 116, 56, 95, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 105, 110, 116, 49, 54, 95, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 117, 105, 110, 116, 49, 54, 95, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 105, 110, 116, 51, 50, 95, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 117, 105, 110, 116, 51, 50, 95, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 102, 108, 111, 97, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 100, 111, 117, 98, 108, 101, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 108, 111, 110, 103, 32, 100, 111, 117, 98, 108, 101, 62, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 101, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 100, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 102, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 109, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 108, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 106, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 105, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 116, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 115, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 104, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 97, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 99, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 51, 118, 97, 108, 69, 0, 78, 83, 116, 51, 95, 95, 49, 49, 50, 98, 97, 115, 105, 99, 95, 115, 116, 114, 105, 110, 103, 73, 119, 78, 83, 95, 49, 49, 99, 104, 97, 114, 95, 116, 114, 97, 105, 116, 115, 73, 119, 69, 69, 78, 83, 95, 57, 97, 108, 108, 111, 99, 97, 116, 111, 114, 73, 119, 69, 69, 69, 69, 0, 78, 83, 116, 51, 95, 95, 49, 50, 49, 95, 95, 98, 97, 115, 105, 99, 95, 115, 116, 114, 105, 110, 103, 95, 99, 111, 109, 109, 111, 110, 73, 76, 98, 49, 69, 69, 69, 0, 78, 83, 116, 51, 95, 95, 49, 49, 50, 98, 97, 115, 105, 99, 95, 115, 116, 114, 105, 110, 103, 73, 104, 78, 83, 95, 49, 49, 99, 104, 97, 114, 95, 116, 114, 97, 105, 116, 115, 73, 104, 69, 69, 78, 83, 95, 57, 97, 108, 108, 111, 99, 97, 116, 111, 114, 73, 104, 69, 69, 69, 69, 0, 78, 83, 116, 51, 95, 95, 49, 49, 50, 98, 97, 115, 105, 99, 95, 115, 116, 114, 105, 110, 103, 73, 99, 78, 83, 95, 49, 49, 99, 104, 97, 114, 95, 116, 114, 97, 105, 116, 115, 73, 99, 69, 69, 78, 83, 95, 57, 97, 108, 108, 111, 99, 97, 116, 111, 114, 73, 99, 69, 69, 69, 69, 0, 83, 116, 57, 116, 121, 112, 101, 95, 105, 110, 102, 111, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 49, 54, 95, 95, 115, 104, 105, 109, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 49, 55, 95, 95, 99, 108, 97, 115, 115, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 49, 57, 95, 95, 112, 111, 105, 110, 116, 101, 114, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 49, 55, 95, 95, 112, 98, 97, 115, 101, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 50, 51, 95, 95, 102, 117, 110, 100, 97, 109, 101, 110, 116, 97, 108, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 118, 0, 80, 118, 0, 68, 110, 0, 98, 0, 99, 0, 104, 0, 97, 0, 115, 0, 116, 0, 105, 0, 106, 0, 108, 0, 109, 0, 102, 0, 100, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 49, 54, 95, 95, 101, 110, 117, 109, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 50, 48, 95, 95, 115, 105, 95, 99, 108, 97, 115, 115, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 50, 49, 95, 95, 118, 109, 105, 95, 99, 108, 97, 115, 115, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 17, 0, 10, 0, 17, 17, 17, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 17, 0, 15, 10, 17, 17, 17, 3, 10, 7, 0, 1, 19, 9, 11, 11, 0, 0, 9, 6, 11, 0, 0, 11, 0, 6, 17, 0, 0, 0, 17, 17, 17, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 17, 0, 10, 10, 17, 17, 17, 0, 10, 0, 0, 2, 0, 9, 11, 0, 0, 0, 9, 0, 11, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 0, 0, 9, 12, 0, 0, 0, 0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 13, 0, 0, 0, 4, 13, 0, 0, 0, 0, 9, 14, 0, 0, 0, 0, 0, 14, 0, 0, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15, 0, 0, 0, 0, 15, 0, 0, 0, 0, 9, 16, 0, 0, 0, 0, 0, 16, 0, 0, 16, 0, 0, 18, 0, 0, 0, 18, 18, 18, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 18, 0, 0, 0, 18, 18, 18, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 10, 0, 0, 0, 0, 9, 11, 0, 0, 0, 0, 0, 11, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 0, 0, 9, 12, 0, 0, 0, 0, 0, 12, 0, 0, 12, 0, 0, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 65, 66, 67, 68, 69, 70, 45, 43, 32, 32, 32, 48, 88, 48, 120, 0, 40, 110, 117, 108, 108, 41, 0, 45, 48, 88, 43, 48, 88, 32, 48, 88, 45, 48, 120, 43, 48, 120, 32, 48, 120, 0, 105, 110, 102, 0, 73, 78, 70, 0, 110, 97, 110, 0, 78, 65, 78, 0, 46, 0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 632946);
  var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);
  assert(tempDoublePtr % 8 == 0);
  function copyTempFloat(ptr) {
    HEAP8[tempDoublePtr] = HEAP8[ptr];
    HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
    HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
    HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];
  }
  function copyTempDouble(ptr) {
    HEAP8[tempDoublePtr] = HEAP8[ptr];
    HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
    HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
    HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];
    HEAP8[tempDoublePtr + 4] = HEAP8[ptr + 4];
    HEAP8[tempDoublePtr + 5] = HEAP8[ptr + 5];
    HEAP8[tempDoublePtr + 6] = HEAP8[ptr + 6];
    HEAP8[tempDoublePtr + 7] = HEAP8[ptr + 7];
  }
  Module["_i64Subtract"] = _i64Subtract;
  var ___errno_state = 0;
  function ___setErrNo(value) {
    HEAP32[___errno_state >> 2] = value;
    return value;
  }
  var ERRNO_CODES = {
    EPERM: 1,
    ENOENT: 2,
    ESRCH: 3,
    EINTR: 4,
    EIO: 5,
    ENXIO: 6,
    E2BIG: 7,
    ENOEXEC: 8,
    EBADF: 9,
    ECHILD: 10,
    EAGAIN: 11,
    EWOULDBLOCK: 11,
    ENOMEM: 12,
    EACCES: 13,
    EFAULT: 14,
    ENOTBLK: 15,
    EBUSY: 16,
    EEXIST: 17,
    EXDEV: 18,
    ENODEV: 19,
    ENOTDIR: 20,
    EISDIR: 21,
    EINVAL: 22,
    ENFILE: 23,
    EMFILE: 24,
    ENOTTY: 25,
    ETXTBSY: 26,
    EFBIG: 27,
    ENOSPC: 28,
    ESPIPE: 29,
    EROFS: 30,
    EMLINK: 31,
    EPIPE: 32,
    EDOM: 33,
    ERANGE: 34,
    ENOMSG: 42,
    EIDRM: 43,
    ECHRNG: 44,
    EL2NSYNC: 45,
    EL3HLT: 46,
    EL3RST: 47,
    ELNRNG: 48,
    EUNATCH: 49,
    ENOCSI: 50,
    EL2HLT: 51,
    EDEADLK: 35,
    ENOLCK: 37,
    EBADE: 52,
    EBADR: 53,
    EXFULL: 54,
    ENOANO: 55,
    EBADRQC: 56,
    EBADSLT: 57,
    EDEADLOCK: 35,
    EBFONT: 59,
    ENOSTR: 60,
    ENODATA: 61,
    ETIME: 62,
    ENOSR: 63,
    ENONET: 64,
    ENOPKG: 65,
    EREMOTE: 66,
    ENOLINK: 67,
    EADV: 68,
    ESRMNT: 69,
    ECOMM: 70,
    EPROTO: 71,
    EMULTIHOP: 72,
    EDOTDOT: 73,
    EBADMSG: 74,
    ENOTUNIQ: 76,
    EBADFD: 77,
    EREMCHG: 78,
    ELIBACC: 79,
    ELIBBAD: 80,
    ELIBSCN: 81,
    ELIBMAX: 82,
    ELIBEXEC: 83,
    ENOSYS: 38,
    ENOTEMPTY: 39,
    ENAMETOOLONG: 36,
    ELOOP: 40,
    EOPNOTSUPP: 95,
    EPFNOSUPPORT: 96,
    ECONNRESET: 104,
    ENOBUFS: 105,
    EAFNOSUPPORT: 97,
    EPROTOTYPE: 91,
    ENOTSOCK: 88,
    ENOPROTOOPT: 92,
    ESHUTDOWN: 108,
    ECONNREFUSED: 111,
    EADDRINUSE: 98,
    ECONNABORTED: 103,
    ENETUNREACH: 101,
    ENETDOWN: 100,
    ETIMEDOUT: 110,
    EHOSTDOWN: 112,
    EHOSTUNREACH: 113,
    EINPROGRESS: 115,
    EALREADY: 114,
    EDESTADDRREQ: 89,
    EMSGSIZE: 90,
    EPROTONOSUPPORT: 93,
    ESOCKTNOSUPPORT: 94,
    EADDRNOTAVAIL: 99,
    ENETRESET: 102,
    EISCONN: 106,
    ENOTCONN: 107,
    ETOOMANYREFS: 109,
    EUSERS: 87,
    EDQUOT: 122,
    ESTALE: 116,
    ENOTSUP: 95,
    ENOMEDIUM: 123,
    EILSEQ: 84,
    EOVERFLOW: 75,
    ECANCELED: 125,
    ENOTRECOVERABLE: 131,
    EOWNERDEAD: 130,
    ESTRPIPE: 86
  };
  function _sysconf(name) {
    switch (name) {
      case 30:
        return PAGE_SIZE;
      case 85:
        return totalMemory / PAGE_SIZE;
      case 132:
      case 133:
      case 12:
      case 137:
      case 138:
      case 15:
      case 235:
      case 16:
      case 17:
      case 18:
      case 19:
      case 20:
      case 149:
      case 13:
      case 10:
      case 236:
      case 153:
      case 9:
      case 21:
      case 22:
      case 159:
      case 154:
      case 14:
      case 77:
      case 78:
      case 139:
      case 80:
      case 81:
      case 82:
      case 68:
      case 67:
      case 164:
      case 11:
      case 29:
      case 47:
      case 48:
      case 95:
      case 52:
      case 51:
      case 46:
        return 200809;
      case 79:
        return 0;
      case 27:
      case 246:
      case 127:
      case 128:
      case 23:
      case 24:
      case 160:
      case 161:
      case 181:
      case 182:
      case 242:
      case 183:
      case 184:
      case 243:
      case 244:
      case 245:
      case 165:
      case 178:
      case 179:
      case 49:
      case 50:
      case 168:
      case 169:
      case 175:
      case 170:
      case 171:
      case 172:
      case 97:
      case 76:
      case 32:
      case 173:
      case 35:
        return -1;
      case 176:
      case 177:
      case 7:
      case 155:
      case 8:
      case 157:
      case 125:
      case 126:
      case 92:
      case 93:
      case 129:
      case 130:
      case 131:
      case 94:
      case 91:
        return 1;
      case 74:
      case 60:
      case 69:
      case 70:
      case 4:
        return 1024;
      case 31:
      case 42:
      case 72:
        return 32;
      case 87:
      case 26:
      case 33:
        return 2147483647;
      case 34:
      case 1:
        return 47839;
      case 38:
      case 36:
        return 99;
      case 43:
      case 37:
        return 2048;
      case 0:
        return 2097152;
      case 3:
        return 65536;
      case 28:
        return 32768;
      case 44:
        return 32767;
      case 75:
        return 16384;
      case 39:
        return 1e3;
      case 89:
        return 700;
      case 71:
        return 256;
      case 40:
        return 255;
      case 2:
        return 100;
      case 180:
        return 64;
      case 25:
        return 20;
      case 5:
        return 16;
      case 6:
        return 6;
      case 73:
        return 4;
      case 84:
        {
          if (typeof navigator === "object")
            return navigator["hardwareConcurrency"] || 1;
          return 1;
        }
    }
    ___setErrNo(ERRNO_CODES.EINVAL);
    return -1;
  }
  var ERRNO_MESSAGES = {
    0: "Success",
    1: "Not super-user",
    2: "No such file or directory",
    3: "No such process",
    4: "Interrupted system call",
    5: "I/O error",
    6: "No such device or address",
    7: "Arg list too long",
    8: "Exec format error",
    9: "Bad file number",
    10: "No children",
    11: "No more processes",
    12: "Not enough core",
    13: "Permission denied",
    14: "Bad address",
    15: "Block device required",
    16: "Mount device busy",
    17: "File exists",
    18: "Cross-device link",
    19: "No such device",
    20: "Not a directory",
    21: "Is a directory",
    22: "Invalid argument",
    23: "Too many open files in system",
    24: "Too many open files",
    25: "Not a typewriter",
    26: "Text file busy",
    27: "File too large",
    28: "No space left on device",
    29: "Illegal seek",
    30: "Read only file system",
    31: "Too many links",
    32: "Broken pipe",
    33: "Math arg out of domain of func",
    34: "Math result not representable",
    35: "File locking deadlock error",
    36: "File or path name too long",
    37: "No record locks available",
    38: "Function not implemented",
    39: "Directory not empty",
    40: "Too many symbolic links",
    42: "No message of desired type",
    43: "Identifier removed",
    44: "Channel number out of range",
    45: "Level 2 not synchronized",
    46: "Level 3 halted",
    47: "Level 3 reset",
    48: "Link number out of range",
    49: "Protocol driver not attached",
    50: "No CSI structure available",
    51: "Level 2 halted",
    52: "Invalid exchange",
    53: "Invalid request descriptor",
    54: "Exchange full",
    55: "No anode",
    56: "Invalid request code",
    57: "Invalid slot",
    59: "Bad font file fmt",
    60: "Device not a stream",
    61: "No data (for no delay io)",
    62: "Timer expired",
    63: "Out of streams resources",
    64: "Machine is not on the network",
    65: "Package not installed",
    66: "The object is remote",
    67: "The link has been severed",
    68: "Advertise error",
    69: "Srmount error",
    70: "Communication error on send",
    71: "Protocol error",
    72: "Multihop attempted",
    73: "Cross mount point (not really error)",
    74: "Trying to read unreadable message",
    75: "Value too large for defined data type",
    76: "Given log. name not unique",
    77: "f.d. invalid for this operation",
    78: "Remote address changed",
    79: "Can   access a needed shared lib",
    80: "Accessing a corrupted shared lib",
    81: ".lib section in a.out corrupted",
    82: "Attempting to link in too many libs",
    83: "Attempting to exec a shared library",
    84: "Illegal byte sequence",
    86: "Streams pipe error",
    87: "Too many users",
    88: "Socket operation on non-socket",
    89: "Destination address required",
    90: "Message too long",
    91: "Protocol wrong type for socket",
    92: "Protocol not available",
    93: "Unknown protocol",
    94: "Socket type not supported",
    95: "Not supported",
    96: "Protocol family not supported",
    97: "Address family not supported by protocol family",
    98: "Address already in use",
    99: "Address not available",
    100: "Network interface is not configured",
    101: "Network is unreachable",
    102: "Connection reset by network",
    103: "Connection aborted",
    104: "Connection reset by peer",
    105: "No buffer space available",
    106: "Socket is already connected",
    107: "Socket is not connected",
    108: "Can't send after socket shutdown",
    109: "Too many references",
    110: "Connection timed out",
    111: "Connection refused",
    112: "Host is down",
    113: "Host is unreachable",
    114: "Socket already connected",
    115: "Connection already in progress",
    116: "Stale file handle",
    122: "Quota exceeded",
    123: "No medium (in tape drive)",
    125: "Operation canceled",
    130: "Previous owner died",
    131: "State not recoverable"
  };
  var PATH = {
    splitPath: (function(filename) {
      var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
      return splitPathRe.exec(filename).slice(1);
    }),
    normalizeArray: (function(parts, allowAboveRoot) {
      var up = 0;
      for (var i = parts.length - 1; i >= 0; i--) {
        var last = parts[i];
        if (last === ".") {
          parts.splice(i, 1);
        } else if (last === "..") {
          parts.splice(i, 1);
          up++;
        } else if (up) {
          parts.splice(i, 1);
          up--;
        }
      }
      if (allowAboveRoot) {
        for (; up--; up) {
          parts.unshift("..");
        }
      }
      return parts;
    }),
    normalize: (function(path) {
      var isAbsolute = path.charAt(0) === "/",
          trailingSlash = path.substr(-1) === "/";
      path = PATH.normalizeArray(path.split("/").filter((function(p) {
        return !!p;
      })), !isAbsolute).join("/");
      if (!path && !isAbsolute) {
        path = ".";
      }
      if (path && trailingSlash) {
        path += "/";
      }
      return (isAbsolute ? "/" : "") + path;
    }),
    dirname: (function(path) {
      var result = PATH.splitPath(path),
          root = result[0],
          dir = result[1];
      if (!root && !dir) {
        return ".";
      }
      if (dir) {
        dir = dir.substr(0, dir.length - 1);
      }
      return root + dir;
    }),
    basename: (function(path) {
      if (path === "/")
        return "/";
      var lastSlash = path.lastIndexOf("/");
      if (lastSlash === -1)
        return path;
      return path.substr(lastSlash + 1);
    }),
    extname: (function(path) {
      return PATH.splitPath(path)[3];
    }),
    join: (function() {
      var paths = Array.prototype.slice.call(arguments, 0);
      return PATH.normalize(paths.join("/"));
    }),
    join2: (function(l, r) {
      return PATH.normalize(l + "/" + r);
    }),
    resolve: (function() {
      var resolvedPath = "",
          resolvedAbsolute = false;
      for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
        var path = i >= 0 ? arguments[i] : FS.cwd();
        if (typeof path !== "string") {
          throw new TypeError("Arguments to path.resolve must be strings");
        } else if (!path) {
          return "";
        }
        resolvedPath = path + "/" + resolvedPath;
        resolvedAbsolute = path.charAt(0) === "/";
      }
      resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter((function(p) {
        return !!p;
      })), !resolvedAbsolute).join("/");
      return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
    }),
    relative: (function(from, to) {
      from = PATH.resolve(from).substr(1);
      to = PATH.resolve(to).substr(1);
      function trim(arr) {
        var start = 0;
        for (; start < arr.length; start++) {
          if (arr[start] !== "")
            break;
        }
        var end = arr.length - 1;
        for (; end >= 0; end--) {
          if (arr[end] !== "")
            break;
        }
        if (start > end)
          return [];
        return arr.slice(start, end - start + 1);
      }
      var fromParts = trim(from.split("/"));
      var toParts = trim(to.split("/"));
      var length = Math.min(fromParts.length, toParts.length);
      var samePartsLength = length;
      for (var i = 0; i < length; i++) {
        if (fromParts[i] !== toParts[i]) {
          samePartsLength = i;
          break;
        }
      }
      var outputParts = [];
      for (var i = samePartsLength; i < fromParts.length; i++) {
        outputParts.push("..");
      }
      outputParts = outputParts.concat(toParts.slice(samePartsLength));
      return outputParts.join("/");
    })
  };
  var TTY = {
    ttys: [],
    init: (function() {}),
    shutdown: (function() {}),
    register: (function(dev, ops) {
      TTY.ttys[dev] = {
        input: [],
        output: [],
        ops: ops
      };
      FS.registerDevice(dev, TTY.stream_ops);
    }),
    stream_ops: {
      open: (function(stream) {
        var tty = TTY.ttys[stream.node.rdev];
        if (!tty) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        stream.tty = tty;
        stream.seekable = false;
      }),
      close: (function(stream) {
        stream.tty.ops.flush(stream.tty);
      }),
      flush: (function(stream) {
        stream.tty.ops.flush(stream.tty);
      }),
      read: (function(stream, buffer, offset, length, pos) {
        if (!stream.tty || !stream.tty.ops.get_char) {
          throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
        }
        var bytesRead = 0;
        for (var i = 0; i < length; i++) {
          var result;
          try {
            result = stream.tty.ops.get_char(stream.tty);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
          }
          if (result === undefined && bytesRead === 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
          }
          if (result === null || result === undefined)
            break;
          bytesRead++;
          buffer[offset + i] = result;
        }
        if (bytesRead) {
          stream.node.timestamp = Date.now();
        }
        return bytesRead;
      }),
      write: (function(stream, buffer, offset, length, pos) {
        if (!stream.tty || !stream.tty.ops.put_char) {
          throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
        }
        for (var i = 0; i < length; i++) {
          try {
            stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
          }
        }
        if (length) {
          stream.node.timestamp = Date.now();
        }
        return i;
      })
    },
    default_tty_ops: {
      get_char: (function(tty) {
        if (!tty.input.length) {
          var result = null;
          if (ENVIRONMENT_IS_NODE) {
            var BUFSIZE = 256;
            var buf = new Buffer(BUFSIZE);
            var bytesRead = 0;
            var fd = process.stdin.fd;
            var usingDevice = false;
            try {
              fd = fs.openSync("/dev/stdin", "r");
              usingDevice = true;
            } catch (e) {}
            bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
            if (usingDevice) {
              fs.closeSync(fd);
            }
            if (bytesRead > 0) {
              result = buf.slice(0, bytesRead).toString("utf-8");
            } else {
              result = null;
            }
          } else if (typeof window != "undefined" && typeof window.prompt == "function") {
            result = window.prompt("Input: ");
            if (result !== null) {
              result += "\n";
            }
          } else if (typeof readline == "function") {
            result = readline();
            if (result !== null) {
              result += "\n";
            }
          }
          if (!result) {
            return null;
          }
          tty.input = intArrayFromString(result, true);
        }
        return tty.input.shift();
      }),
      put_char: (function(tty, val) {
        if (val === null || val === 10) {
          Module["print"](UTF8ArrayToString(tty.output, 0));
          tty.output = [];
        } else {
          if (val != 0)
            tty.output.push(val);
        }
      }),
      flush: (function(tty) {
        if (tty.output && tty.output.length > 0) {
          Module["print"](UTF8ArrayToString(tty.output, 0));
          tty.output = [];
        }
      })
    },
    default_tty1_ops: {
      put_char: (function(tty, val) {
        if (val === null || val === 10) {
          Module["printErr"](UTF8ArrayToString(tty.output, 0));
          tty.output = [];
        } else {
          if (val != 0)
            tty.output.push(val);
        }
      }),
      flush: (function(tty) {
        if (tty.output && tty.output.length > 0) {
          Module["printErr"](UTF8ArrayToString(tty.output, 0));
          tty.output = [];
        }
      })
    }
  };
  var MEMFS = {
    ops_table: null,
    mount: (function(mount) {
      return MEMFS.createNode(null, "/", 16384 | 511, 0);
    }),
    createNode: (function(parent, name, mode, dev) {
      if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      if (!MEMFS.ops_table) {
        MEMFS.ops_table = {
          dir: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
              lookup: MEMFS.node_ops.lookup,
              mknod: MEMFS.node_ops.mknod,
              rename: MEMFS.node_ops.rename,
              unlink: MEMFS.node_ops.unlink,
              rmdir: MEMFS.node_ops.rmdir,
              readdir: MEMFS.node_ops.readdir,
              symlink: MEMFS.node_ops.symlink
            },
            stream: {llseek: MEMFS.stream_ops.llseek}
          },
          file: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr
            },
            stream: {
              llseek: MEMFS.stream_ops.llseek,
              read: MEMFS.stream_ops.read,
              write: MEMFS.stream_ops.write,
              allocate: MEMFS.stream_ops.allocate,
              mmap: MEMFS.stream_ops.mmap,
              msync: MEMFS.stream_ops.msync
            }
          },
          link: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
              readlink: MEMFS.node_ops.readlink
            },
            stream: {}
          },
          chrdev: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr
            },
            stream: FS.chrdev_stream_ops
          }
        };
      }
      var node = FS.createNode(parent, name, mode, dev);
      if (FS.isDir(node.mode)) {
        node.node_ops = MEMFS.ops_table.dir.node;
        node.stream_ops = MEMFS.ops_table.dir.stream;
        node.contents = {};
      } else if (FS.isFile(node.mode)) {
        node.node_ops = MEMFS.ops_table.file.node;
        node.stream_ops = MEMFS.ops_table.file.stream;
        node.usedBytes = 0;
        node.contents = null;
      } else if (FS.isLink(node.mode)) {
        node.node_ops = MEMFS.ops_table.link.node;
        node.stream_ops = MEMFS.ops_table.link.stream;
      } else if (FS.isChrdev(node.mode)) {
        node.node_ops = MEMFS.ops_table.chrdev.node;
        node.stream_ops = MEMFS.ops_table.chrdev.stream;
      }
      node.timestamp = Date.now();
      if (parent) {
        parent.contents[name] = node;
      }
      return node;
    }),
    getFileDataAsRegularArray: (function(node) {
      if (node.contents && node.contents.subarray) {
        var arr = [];
        for (var i = 0; i < node.usedBytes; ++i)
          arr.push(node.contents[i]);
        return arr;
      }
      return node.contents;
    }),
    getFileDataAsTypedArray: (function(node) {
      if (!node.contents)
        return new Uint8Array;
      if (node.contents.subarray)
        return node.contents.subarray(0, node.usedBytes);
      return new Uint8Array(node.contents);
    }),
    expandFileStorage: (function(node, newCapacity) {
      if (node.contents && node.contents.subarray && newCapacity > node.contents.length) {
        node.contents = MEMFS.getFileDataAsRegularArray(node);
        node.usedBytes = node.contents.length;
      }
      if (!node.contents || node.contents.subarray) {
        var prevCapacity = node.contents ? node.contents.buffer.byteLength : 0;
        if (prevCapacity >= newCapacity)
          return ;
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);
        if (prevCapacity != 0)
          newCapacity = Math.max(newCapacity, 256);
        var oldContents = node.contents;
        node.contents = new Uint8Array(newCapacity);
        if (node.usedBytes > 0)
          node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
        return ;
      }
      if (!node.contents && newCapacity > 0)
        node.contents = [];
      while (node.contents.length < newCapacity)
        node.contents.push(0);
    }),
    resizeFileStorage: (function(node, newSize) {
      if (node.usedBytes == newSize)
        return ;
      if (newSize == 0) {
        node.contents = null;
        node.usedBytes = 0;
        return ;
      }
      if (!node.contents || node.contents.subarray) {
        var oldContents = node.contents;
        node.contents = new Uint8Array(new ArrayBuffer(newSize));
        if (oldContents) {
          node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
        }
        node.usedBytes = newSize;
        return ;
      }
      if (!node.contents)
        node.contents = [];
      if (node.contents.length > newSize)
        node.contents.length = newSize;
      else
        while (node.contents.length < newSize)
          node.contents.push(0);
      node.usedBytes = newSize;
    }),
    node_ops: {
      getattr: (function(node) {
        var attr = {};
        attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
        attr.ino = node.id;
        attr.mode = node.mode;
        attr.nlink = 1;
        attr.uid = 0;
        attr.gid = 0;
        attr.rdev = node.rdev;
        if (FS.isDir(node.mode)) {
          attr.size = 4096;
        } else if (FS.isFile(node.mode)) {
          attr.size = node.usedBytes;
        } else if (FS.isLink(node.mode)) {
          attr.size = node.link.length;
        } else {
          attr.size = 0;
        }
        attr.atime = new Date(node.timestamp);
        attr.mtime = new Date(node.timestamp);
        attr.ctime = new Date(node.timestamp);
        attr.blksize = 4096;
        attr.blocks = Math.ceil(attr.size / attr.blksize);
        return attr;
      }),
      setattr: (function(node, attr) {
        if (attr.mode !== undefined) {
          node.mode = attr.mode;
        }
        if (attr.timestamp !== undefined) {
          node.timestamp = attr.timestamp;
        }
        if (attr.size !== undefined) {
          MEMFS.resizeFileStorage(node, attr.size);
        }
      }),
      lookup: (function(parent, name) {
        throw FS.genericErrors[ERRNO_CODES.ENOENT];
      }),
      mknod: (function(parent, name, mode, dev) {
        return MEMFS.createNode(parent, name, mode, dev);
      }),
      rename: (function(old_node, new_dir, new_name) {
        if (FS.isDir(old_node.mode)) {
          var new_node;
          try {
            new_node = FS.lookupNode(new_dir, new_name);
          } catch (e) {}
          if (new_node) {
            for (var i in new_node.contents) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
            }
          }
        }
        delete old_node.parent.contents[old_node.name];
        old_node.name = new_name;
        new_dir.contents[new_name] = old_node;
        old_node.parent = new_dir;
      }),
      unlink: (function(parent, name) {
        delete parent.contents[name];
      }),
      rmdir: (function(parent, name) {
        var node = FS.lookupNode(parent, name);
        for (var i in node.contents) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
        }
        delete parent.contents[name];
      }),
      readdir: (function(node) {
        var entries = [".", ".."];
        for (var key in node.contents) {
          if (!node.contents.hasOwnProperty(key)) {
            continue;
          }
          entries.push(key);
        }
        return entries;
      }),
      symlink: (function(parent, newname, oldpath) {
        var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
        node.link = oldpath;
        return node;
      }),
      readlink: (function(node) {
        if (!FS.isLink(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        return node.link;
      })
    },
    stream_ops: {
      read: (function(stream, buffer, offset, length, position) {
        var contents = stream.node.contents;
        if (position >= stream.node.usedBytes)
          return 0;
        var size = Math.min(stream.node.usedBytes - position, length);
        assert(size >= 0);
        if (size > 8 && contents.subarray) {
          buffer.set(contents.subarray(position, position + size), offset);
        } else {
          for (var i = 0; i < size; i++)
            buffer[offset + i] = contents[position + i];
        }
        return size;
      }),
      write: (function(stream, buffer, offset, length, position, canOwn) {
        if (!length)
          return 0;
        var node = stream.node;
        node.timestamp = Date.now();
        if (buffer.subarray && (!node.contents || node.contents.subarray)) {
          if (canOwn) {
            node.contents = buffer.subarray(offset, offset + length);
            node.usedBytes = length;
            return length;
          } else if (node.usedBytes === 0 && position === 0) {
            node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
            node.usedBytes = length;
            return length;
          } else if (position + length <= node.usedBytes) {
            node.contents.set(buffer.subarray(offset, offset + length), position);
            return length;
          }
        }
        MEMFS.expandFileStorage(node, position + length);
        if (node.contents.subarray && buffer.subarray)
          node.contents.set(buffer.subarray(offset, offset + length), position);
        else {
          for (var i = 0; i < length; i++) {
            node.contents[position + i] = buffer[offset + i];
          }
        }
        node.usedBytes = Math.max(node.usedBytes, position + length);
        return length;
      }),
      llseek: (function(stream, offset, whence) {
        var position = offset;
        if (whence === 1) {
          position += stream.position;
        } else if (whence === 2) {
          if (FS.isFile(stream.node.mode)) {
            position += stream.node.usedBytes;
          }
        }
        if (position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        return position;
      }),
      allocate: (function(stream, offset, length) {
        MEMFS.expandFileStorage(stream.node, offset + length);
        stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
      }),
      mmap: (function(stream, buffer, offset, length, position, prot, flags) {
        if (!FS.isFile(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        var ptr;
        var allocated;
        var contents = stream.node.contents;
        if (!(flags & 2) && (contents.buffer === buffer || contents.buffer === buffer.buffer)) {
          allocated = false;
          ptr = contents.byteOffset;
        } else {
          if (position > 0 || position + length < stream.node.usedBytes) {
            if (contents.subarray) {
              contents = contents.subarray(position, position + length);
            } else {
              contents = Array.prototype.slice.call(contents, position, position + length);
            }
          }
          allocated = true;
          ptr = _malloc(length);
          if (!ptr) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);
          }
          buffer.set(contents, ptr);
        }
        return {
          ptr: ptr,
          allocated: allocated
        };
      }),
      msync: (function(stream, buffer, offset, length, mmapFlags) {
        if (!FS.isFile(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        if (mmapFlags & 2) {
          return 0;
        }
        var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
        return 0;
      })
    }
  };
  var IDBFS = {
    dbs: {},
    indexedDB: (function() {
      if (typeof indexedDB !== "undefined")
        return indexedDB;
      var ret = null;
      if (typeof window === "object")
        ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      assert(ret, "IDBFS used, but indexedDB not supported");
      return ret;
    }),
    DB_VERSION: 21,
    DB_STORE_NAME: "FILE_DATA",
    mount: (function(mount) {
      return MEMFS.mount.apply(null, arguments);
    }),
    syncfs: (function(mount, populate, callback) {
      IDBFS.getLocalSet(mount, (function(err, local) {
        if (err)
          return callback(err);
        IDBFS.getRemoteSet(mount, (function(err, remote) {
          if (err)
            return callback(err);
          var src = populate ? remote : local;
          var dst = populate ? local : remote;
          IDBFS.reconcile(src, dst, callback);
        }));
      }));
    }),
    getDB: (function(name, callback) {
      var db = IDBFS.dbs[name];
      if (db) {
        return callback(null, db);
      }
      var req;
      try {
        req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
      } catch (e) {
        return callback(e);
      }
      req.onupgradeneeded = (function(e) {
        var db = e.target.result;
        var transaction = e.target.transaction;
        var fileStore;
        if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
          fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
        } else {
          fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
        }
        if (!fileStore.indexNames.contains("timestamp")) {
          fileStore.createIndex("timestamp", "timestamp", {unique: false});
        }
      });
      req.onsuccess = (function() {
        db = req.result;
        IDBFS.dbs[name] = db;
        callback(null, db);
      });
      req.onerror = (function(e) {
        callback(this.error);
        e.preventDefault();
      });
    }),
    getLocalSet: (function(mount, callback) {
      var entries = {};
      function isRealDir(p) {
        return p !== "." && p !== "..";
      }
      function toAbsolute(root) {
        return (function(p) {
          return PATH.join2(root, p);
        });
      }
      var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
      while (check.length) {
        var path = check.pop();
        var stat;
        try {
          stat = FS.stat(path);
        } catch (e) {
          return callback(e);
        }
        if (FS.isDir(stat.mode)) {
          check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
        }
        entries[path] = {timestamp: stat.mtime};
      }
      return callback(null, {
        type: "local",
        entries: entries
      });
    }),
    getRemoteSet: (function(mount, callback) {
      var entries = {};
      IDBFS.getDB(mount.mountpoint, (function(err, db) {
        if (err)
          return callback(err);
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readonly");
        transaction.onerror = (function(e) {
          callback(this.error);
          e.preventDefault();
        });
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
        var index = store.index("timestamp");
        index.openKeyCursor().onsuccess = (function(event) {
          var cursor = event.target.result;
          if (!cursor) {
            return callback(null, {
              type: "remote",
              db: db,
              entries: entries
            });
          }
          entries[cursor.primaryKey] = {timestamp: cursor.key};
          cursor.continue();
        });
      }));
    }),
    loadLocalEntry: (function(path, callback) {
      var stat,
          node;
      try {
        var lookup = FS.lookupPath(path);
        node = lookup.node;
        stat = FS.stat(path);
      } catch (e) {
        return callback(e);
      }
      if (FS.isDir(stat.mode)) {
        return callback(null, {
          timestamp: stat.mtime,
          mode: stat.mode
        });
      } else if (FS.isFile(stat.mode)) {
        node.contents = MEMFS.getFileDataAsTypedArray(node);
        return callback(null, {
          timestamp: stat.mtime,
          mode: stat.mode,
          contents: node.contents
        });
      } else {
        return callback(new Error("node type not supported"));
      }
    }),
    storeLocalEntry: (function(path, entry, callback) {
      try {
        if (FS.isDir(entry.mode)) {
          FS.mkdir(path, entry.mode);
        } else if (FS.isFile(entry.mode)) {
          FS.writeFile(path, entry.contents, {
            encoding: "binary",
            canOwn: true
          });
        } else {
          return callback(new Error("node type not supported"));
        }
        FS.chmod(path, entry.mode);
        FS.utime(path, entry.timestamp, entry.timestamp);
      } catch (e) {
        return callback(e);
      }
      callback(null);
    }),
    removeLocalEntry: (function(path, callback) {
      try {
        var lookup = FS.lookupPath(path);
        var stat = FS.stat(path);
        if (FS.isDir(stat.mode)) {
          FS.rmdir(path);
        } else if (FS.isFile(stat.mode)) {
          FS.unlink(path);
        }
      } catch (e) {
        return callback(e);
      }
      callback(null);
    }),
    loadRemoteEntry: (function(store, path, callback) {
      var req = store.get(path);
      req.onsuccess = (function(event) {
        callback(null, event.target.result);
      });
      req.onerror = (function(e) {
        callback(this.error);
        e.preventDefault();
      });
    }),
    storeRemoteEntry: (function(store, path, entry, callback) {
      var req = store.put(entry, path);
      req.onsuccess = (function() {
        callback(null);
      });
      req.onerror = (function(e) {
        callback(this.error);
        e.preventDefault();
      });
    }),
    removeRemoteEntry: (function(store, path, callback) {
      var req = store.delete(path);
      req.onsuccess = (function() {
        callback(null);
      });
      req.onerror = (function(e) {
        callback(this.error);
        e.preventDefault();
      });
    }),
    reconcile: (function(src, dst, callback) {
      var total = 0;
      var create = [];
      Object.keys(src.entries).forEach((function(key) {
        var e = src.entries[key];
        var e2 = dst.entries[key];
        if (!e2 || e.timestamp > e2.timestamp) {
          create.push(key);
          total++;
        }
      }));
      var remove = [];
      Object.keys(dst.entries).forEach((function(key) {
        var e = dst.entries[key];
        var e2 = src.entries[key];
        if (!e2) {
          remove.push(key);
          total++;
        }
      }));
      if (!total) {
        return callback(null);
      }
      var errored = false;
      var completed = 0;
      var db = src.type === "remote" ? src.db : dst.db;
      var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readwrite");
      var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
      function done(err) {
        if (err) {
          if (!done.errored) {
            done.errored = true;
            return callback(err);
          }
          return ;
        }
        if (++completed >= total) {
          return callback(null);
        }
      }
      transaction.onerror = (function(e) {
        done(this.error);
        e.preventDefault();
      });
      create.sort().forEach((function(path) {
        if (dst.type === "local") {
          IDBFS.loadRemoteEntry(store, path, (function(err, entry) {
            if (err)
              return done(err);
            IDBFS.storeLocalEntry(path, entry, done);
          }));
        } else {
          IDBFS.loadLocalEntry(path, (function(err, entry) {
            if (err)
              return done(err);
            IDBFS.storeRemoteEntry(store, path, entry, done);
          }));
        }
      }));
      remove.sort().reverse().forEach((function(path) {
        if (dst.type === "local") {
          IDBFS.removeLocalEntry(path, done);
        } else {
          IDBFS.removeRemoteEntry(store, path, done);
        }
      }));
    })
  };
  var NODEFS = {
    isWindows: false,
    staticInit: (function() {
      NODEFS.isWindows = !!process.platform.match(/^win/);
    }),
    mount: (function(mount) {
      assert(ENVIRONMENT_IS_NODE);
      return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0);
    }),
    createNode: (function(parent, name, mode, dev) {
      if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      var node = FS.createNode(parent, name, mode);
      node.node_ops = NODEFS.node_ops;
      node.stream_ops = NODEFS.stream_ops;
      return node;
    }),
    getMode: (function(path) {
      var stat;
      try {
        stat = fs.lstatSync(path);
        if (NODEFS.isWindows) {
          stat.mode = stat.mode | (stat.mode & 146) >> 1;
        }
      } catch (e) {
        if (!e.code)
          throw e;
        throw new FS.ErrnoError(ERRNO_CODES[e.code]);
      }
      return stat.mode;
    }),
    realPath: (function(node) {
      var parts = [];
      while (node.parent !== node) {
        parts.push(node.name);
        node = node.parent;
      }
      parts.push(node.mount.opts.root);
      parts.reverse();
      return PATH.join.apply(null, parts);
    }),
    flagsToPermissionStringMap: {
      0: "r",
      1: "r+",
      2: "r+",
      64: "r",
      65: "r+",
      66: "r+",
      129: "rx+",
      193: "rx+",
      514: "w+",
      577: "w",
      578: "w+",
      705: "wx",
      706: "wx+",
      1024: "a",
      1025: "a",
      1026: "a+",
      1089: "a",
      1090: "a+",
      1153: "ax",
      1154: "ax+",
      1217: "ax",
      1218: "ax+",
      4096: "rs",
      4098: "rs+"
    },
    flagsToPermissionString: (function(flags) {
      if (flags in NODEFS.flagsToPermissionStringMap) {
        return NODEFS.flagsToPermissionStringMap[flags];
      } else {
        return flags;
      }
    }),
    node_ops: {
      getattr: (function(node) {
        var path = NODEFS.realPath(node);
        var stat;
        try {
          stat = fs.lstatSync(path);
        } catch (e) {
          if (!e.code)
            throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
        if (NODEFS.isWindows && !stat.blksize) {
          stat.blksize = 4096;
        }
        if (NODEFS.isWindows && !stat.blocks) {
          stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0;
        }
        return {
          dev: stat.dev,
          ino: stat.ino,
          mode: stat.mode,
          nlink: stat.nlink,
          uid: stat.uid,
          gid: stat.gid,
          rdev: stat.rdev,
          size: stat.size,
          atime: stat.atime,
          mtime: stat.mtime,
          ctime: stat.ctime,
          blksize: stat.blksize,
          blocks: stat.blocks
        };
      }),
      setattr: (function(node, attr) {
        var path = NODEFS.realPath(node);
        try {
          if (attr.mode !== undefined) {
            fs.chmodSync(path, attr.mode);
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            var date = new Date(attr.timestamp);
            fs.utimesSync(path, date, date);
          }
          if (attr.size !== undefined) {
            fs.truncateSync(path, attr.size);
          }
        } catch (e) {
          if (!e.code)
            throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
      }),
      lookup: (function(parent, name) {
        var path = PATH.join2(NODEFS.realPath(parent), name);
        var mode = NODEFS.getMode(path);
        return NODEFS.createNode(parent, name, mode);
      }),
      mknod: (function(parent, name, mode, dev) {
        var node = NODEFS.createNode(parent, name, mode, dev);
        var path = NODEFS.realPath(node);
        try {
          if (FS.isDir(node.mode)) {
            fs.mkdirSync(path, node.mode);
          } else {
            fs.writeFileSync(path, "", {mode: node.mode});
          }
        } catch (e) {
          if (!e.code)
            throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
        return node;
      }),
      rename: (function(oldNode, newDir, newName) {
        var oldPath = NODEFS.realPath(oldNode);
        var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
        try {
          fs.renameSync(oldPath, newPath);
        } catch (e) {
          if (!e.code)
            throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
      }),
      unlink: (function(parent, name) {
        var path = PATH.join2(NODEFS.realPath(parent), name);
        try {
          fs.unlinkSync(path);
        } catch (e) {
          if (!e.code)
            throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
      }),
      rmdir: (function(parent, name) {
        var path = PATH.join2(NODEFS.realPath(parent), name);
        try {
          fs.rmdirSync(path);
        } catch (e) {
          if (!e.code)
            throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
      }),
      readdir: (function(node) {
        var path = NODEFS.realPath(node);
        try {
          return fs.readdirSync(path);
        } catch (e) {
          if (!e.code)
            throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
      }),
      symlink: (function(parent, newName, oldPath) {
        var newPath = PATH.join2(NODEFS.realPath(parent), newName);
        try {
          fs.symlinkSync(oldPath, newPath);
        } catch (e) {
          if (!e.code)
            throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
      }),
      readlink: (function(node) {
        var path = NODEFS.realPath(node);
        try {
          path = fs.readlinkSync(path);
          path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
          return path;
        } catch (e) {
          if (!e.code)
            throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
      })
    },
    stream_ops: {
      open: (function(stream) {
        var path = NODEFS.realPath(stream.node);
        try {
          if (FS.isFile(stream.node.mode)) {
            stream.nfd = fs.openSync(path, NODEFS.flagsToPermissionString(stream.flags));
          }
        } catch (e) {
          if (!e.code)
            throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
      }),
      close: (function(stream) {
        try {
          if (FS.isFile(stream.node.mode) && stream.nfd) {
            fs.closeSync(stream.nfd);
          }
        } catch (e) {
          if (!e.code)
            throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
      }),
      read: (function(stream, buffer, offset, length, position) {
        if (length === 0)
          return 0;
        var nbuffer = new Buffer(length);
        var res;
        try {
          res = fs.readSync(stream.nfd, nbuffer, 0, length, position);
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
        if (res > 0) {
          for (var i = 0; i < res; i++) {
            buffer[offset + i] = nbuffer[i];
          }
        }
        return res;
      }),
      write: (function(stream, buffer, offset, length, position) {
        var nbuffer = new Buffer(buffer.subarray(offset, offset + length));
        var res;
        try {
          res = fs.writeSync(stream.nfd, nbuffer, 0, length, position);
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
        return res;
      }),
      llseek: (function(stream, offset, whence) {
        var position = offset;
        if (whence === 1) {
          position += stream.position;
        } else if (whence === 2) {
          if (FS.isFile(stream.node.mode)) {
            try {
              var stat = fs.fstatSync(stream.nfd);
              position += stat.size;
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES[e.code]);
            }
          }
        }
        if (position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        return position;
      })
    }
  };
  var _stdin = allocate(1, "i32*", ALLOC_STATIC);
  var _stdout = allocate(1, "i32*", ALLOC_STATIC);
  var _stderr = allocate(1, "i32*", ALLOC_STATIC);
  function _fflush(stream) {}
  var FS = {
    root: null,
    mounts: [],
    devices: [null],
    streams: [],
    nextInode: 1,
    nameTable: null,
    currentPath: "/",
    initialized: false,
    ignorePermissions: true,
    trackingDelegate: {},
    tracking: {openFlags: {
        READ: 1,
        WRITE: 2
      }},
    ErrnoError: null,
    genericErrors: {},
    handleFSError: (function(e) {
      if (!(e instanceof FS.ErrnoError))
        throw e + " : " + stackTrace();
      return ___setErrNo(e.errno);
    }),
    lookupPath: (function(path, opts) {
      path = PATH.resolve(FS.cwd(), path);
      opts = opts || {};
      if (!path)
        return {
          path: "",
          node: null
        };
      var defaults = {
        follow_mount: true,
        recurse_count: 0
      };
      for (var key in defaults) {
        if (opts[key] === undefined) {
          opts[key] = defaults[key];
        }
      }
      if (opts.recurse_count > 8) {
        throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
      }
      var parts = PATH.normalizeArray(path.split("/").filter((function(p) {
        return !!p;
      })), false);
      var current = FS.root;
      var current_path = "/";
      for (var i = 0; i < parts.length; i++) {
        var islast = i === parts.length - 1;
        if (islast && opts.parent) {
          break;
        }
        current = FS.lookupNode(current, parts[i]);
        current_path = PATH.join2(current_path, parts[i]);
        if (FS.isMountpoint(current)) {
          if (!islast || islast && opts.follow_mount) {
            current = current.mounted.root;
          }
        }
        if (!islast || opts.follow) {
          var count = 0;
          while (FS.isLink(current.mode)) {
            var link = FS.readlink(current_path);
            current_path = PATH.resolve(PATH.dirname(current_path), link);
            var lookup = FS.lookupPath(current_path, {recurse_count: opts.recurse_count});
            current = lookup.node;
            if (count++ > 40) {
              throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
            }
          }
        }
      }
      return {
        path: current_path,
        node: current
      };
    }),
    getPath: (function(node) {
      var path;
      while (true) {
        if (FS.isRoot(node)) {
          var mount = node.mount.mountpoint;
          if (!path)
            return mount;
          return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path;
        }
        path = path ? node.name + "/" + path : node.name;
        node = node.parent;
      }
    }),
    hashName: (function(parentid, name) {
      var hash = 0;
      for (var i = 0; i < name.length; i++) {
        hash = (hash << 5) - hash + name.charCodeAt(i) | 0;
      }
      return (parentid + hash >>> 0) % FS.nameTable.length;
    }),
    hashAddNode: (function(node) {
      var hash = FS.hashName(node.parent.id, node.name);
      node.name_next = FS.nameTable[hash];
      FS.nameTable[hash] = node;
    }),
    hashRemoveNode: (function(node) {
      var hash = FS.hashName(node.parent.id, node.name);
      if (FS.nameTable[hash] === node) {
        FS.nameTable[hash] = node.name_next;
      } else {
        var current = FS.nameTable[hash];
        while (current) {
          if (current.name_next === node) {
            current.name_next = node.name_next;
            break;
          }
          current = current.name_next;
        }
      }
    }),
    lookupNode: (function(parent, name) {
      var err = FS.mayLookup(parent);
      if (err) {
        throw new FS.ErrnoError(err, parent);
      }
      var hash = FS.hashName(parent.id, name);
      for (var node = FS.nameTable[hash]; node; node = node.name_next) {
        var nodeName = node.name;
        if (node.parent.id === parent.id && nodeName === name) {
          return node;
        }
      }
      return FS.lookup(parent, name);
    }),
    createNode: (function(parent, name, mode, rdev) {
      if (!FS.FSNode) {
        FS.FSNode = (function(parent, name, mode, rdev) {
          if (!parent) {
            parent = this;
          }
          this.parent = parent;
          this.mount = parent.mount;
          this.mounted = null;
          this.id = FS.nextInode++;
          this.name = name;
          this.mode = mode;
          this.node_ops = {};
          this.stream_ops = {};
          this.rdev = rdev;
        });
        FS.FSNode.prototype = {};
        var readMode = 292 | 73;
        var writeMode = 146;
        Object.defineProperties(FS.FSNode.prototype, {
          read: {
            get: (function() {
              return (this.mode & readMode) === readMode;
            }),
            set: (function(val) {
              val ? this.mode |= readMode : this.mode &= ~readMode;
            })
          },
          write: {
            get: (function() {
              return (this.mode & writeMode) === writeMode;
            }),
            set: (function(val) {
              val ? this.mode |= writeMode : this.mode &= ~writeMode;
            })
          },
          isFolder: {get: (function() {
              return FS.isDir(this.mode);
            })},
          isDevice: {get: (function() {
              return FS.isChrdev(this.mode);
            })}
        });
      }
      var node = new FS.FSNode(parent, name, mode, rdev);
      FS.hashAddNode(node);
      return node;
    }),
    destroyNode: (function(node) {
      FS.hashRemoveNode(node);
    }),
    isRoot: (function(node) {
      return node === node.parent;
    }),
    isMountpoint: (function(node) {
      return !!node.mounted;
    }),
    isFile: (function(mode) {
      return (mode & 61440) === 32768;
    }),
    isDir: (function(mode) {
      return (mode & 61440) === 16384;
    }),
    isLink: (function(mode) {
      return (mode & 61440) === 40960;
    }),
    isChrdev: (function(mode) {
      return (mode & 61440) === 8192;
    }),
    isBlkdev: (function(mode) {
      return (mode & 61440) === 24576;
    }),
    isFIFO: (function(mode) {
      return (mode & 61440) === 4096;
    }),
    isSocket: (function(mode) {
      return (mode & 49152) === 49152;
    }),
    flagModes: {
      "r": 0,
      "rs": 1052672,
      "r+": 2,
      "w": 577,
      "wx": 705,
      "xw": 705,
      "w+": 578,
      "wx+": 706,
      "xw+": 706,
      "a": 1089,
      "ax": 1217,
      "xa": 1217,
      "a+": 1090,
      "ax+": 1218,
      "xa+": 1218
    },
    modeStringToFlags: (function(str) {
      var flags = FS.flagModes[str];
      if (typeof flags === "undefined") {
        throw new Error("Unknown file open mode: " + str);
      }
      return flags;
    }),
    flagsToPermissionString: (function(flag) {
      var accmode = flag & 2097155;
      var perms = ["r", "w", "rw"][accmode];
      if (flag & 512) {
        perms += "w";
      }
      return perms;
    }),
    nodePermissions: (function(node, perms) {
      if (FS.ignorePermissions) {
        return 0;
      }
      if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
        return ERRNO_CODES.EACCES;
      } else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
        return ERRNO_CODES.EACCES;
      } else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
        return ERRNO_CODES.EACCES;
      }
      return 0;
    }),
    mayLookup: (function(dir) {
      var err = FS.nodePermissions(dir, "x");
      if (err)
        return err;
      if (!dir.node_ops.lookup)
        return ERRNO_CODES.EACCES;
      return 0;
    }),
    mayCreate: (function(dir, name) {
      try {
        var node = FS.lookupNode(dir, name);
        return ERRNO_CODES.EEXIST;
      } catch (e) {}
      return FS.nodePermissions(dir, "wx");
    }),
    mayDelete: (function(dir, name, isdir) {
      var node;
      try {
        node = FS.lookupNode(dir, name);
      } catch (e) {
        return e.errno;
      }
      var err = FS.nodePermissions(dir, "wx");
      if (err) {
        return err;
      }
      if (isdir) {
        if (!FS.isDir(node.mode)) {
          return ERRNO_CODES.ENOTDIR;
        }
        if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
          return ERRNO_CODES.EBUSY;
        }
      } else {
        if (FS.isDir(node.mode)) {
          return ERRNO_CODES.EISDIR;
        }
      }
      return 0;
    }),
    mayOpen: (function(node, flags) {
      if (!node) {
        return ERRNO_CODES.ENOENT;
      }
      if (FS.isLink(node.mode)) {
        return ERRNO_CODES.ELOOP;
      } else if (FS.isDir(node.mode)) {
        if ((flags & 2097155) !== 0 || flags & 512) {
          return ERRNO_CODES.EISDIR;
        }
      }
      return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
    }),
    MAX_OPEN_FDS: 4096,
    nextfd: (function(fd_start, fd_end) {
      fd_start = fd_start || 0;
      fd_end = fd_end || FS.MAX_OPEN_FDS;
      for (var fd = fd_start; fd <= fd_end; fd++) {
        if (!FS.streams[fd]) {
          return fd;
        }
      }
      throw new FS.ErrnoError(ERRNO_CODES.EMFILE);
    }),
    getStream: (function(fd) {
      return FS.streams[fd];
    }),
    createStream: (function(stream, fd_start, fd_end) {
      if (!FS.FSStream) {
        FS.FSStream = (function() {});
        FS.FSStream.prototype = {};
        Object.defineProperties(FS.FSStream.prototype, {
          object: {
            get: (function() {
              return this.node;
            }),
            set: (function(val) {
              this.node = val;
            })
          },
          isRead: {get: (function() {
              return (this.flags & 2097155) !== 1;
            })},
          isWrite: {get: (function() {
              return (this.flags & 2097155) !== 0;
            })},
          isAppend: {get: (function() {
              return this.flags & 1024;
            })}
        });
      }
      var newStream = new FS.FSStream;
      for (var p in stream) {
        newStream[p] = stream[p];
      }
      stream = newStream;
      var fd = FS.nextfd(fd_start, fd_end);
      stream.fd = fd;
      FS.streams[fd] = stream;
      return stream;
    }),
    closeStream: (function(fd) {
      FS.streams[fd] = null;
    }),
    getStreamFromPtr: (function(ptr) {
      return FS.streams[ptr - 1];
    }),
    getPtrForStream: (function(stream) {
      return stream ? stream.fd + 1 : 0;
    }),
    chrdev_stream_ops: {
      open: (function(stream) {
        var device = FS.getDevice(stream.node.rdev);
        stream.stream_ops = device.stream_ops;
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
      }),
      llseek: (function() {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
      })
    },
    major: (function(dev) {
      return dev >> 8;
    }),
    minor: (function(dev) {
      return dev & 255;
    }),
    makedev: (function(ma, mi) {
      return ma << 8 | mi;
    }),
    registerDevice: (function(dev, ops) {
      FS.devices[dev] = {stream_ops: ops};
    }),
    getDevice: (function(dev) {
      return FS.devices[dev];
    }),
    getMounts: (function(mount) {
      var mounts = [];
      var check = [mount];
      while (check.length) {
        var m = check.pop();
        mounts.push(m);
        check.push.apply(check, m.mounts);
      }
      return mounts;
    }),
    syncfs: (function(populate, callback) {
      if (typeof populate === "function") {
        callback = populate;
        populate = false;
      }
      var mounts = FS.getMounts(FS.root.mount);
      var completed = 0;
      function done(err) {
        if (err) {
          if (!done.errored) {
            done.errored = true;
            return callback(err);
          }
          return ;
        }
        if (++completed >= mounts.length) {
          callback(null);
        }
      }
      mounts.forEach((function(mount) {
        if (!mount.type.syncfs) {
          return done(null);
        }
        mount.type.syncfs(mount, populate, done);
      }));
    }),
    mount: (function(type, opts, mountpoint) {
      var root = mountpoint === "/";
      var pseudo = !mountpoint;
      var node;
      if (root && FS.root) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
      } else if (!root && !pseudo) {
        var lookup = FS.lookupPath(mountpoint, {follow_mount: false});
        mountpoint = lookup.path;
        node = lookup.node;
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        if (!FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
      }
      var mount = {
        type: type,
        opts: opts,
        mountpoint: mountpoint,
        mounts: []
      };
      var mountRoot = type.mount(mount);
      mountRoot.mount = mount;
      mount.root = mountRoot;
      if (root) {
        FS.root = mountRoot;
      } else if (node) {
        node.mounted = mount;
        if (node.mount) {
          node.mount.mounts.push(mount);
        }
      }
      return mountRoot;
    }),
    unmount: (function(mountpoint) {
      var lookup = FS.lookupPath(mountpoint, {follow_mount: false});
      if (!FS.isMountpoint(lookup.node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      var node = lookup.node;
      var mount = node.mounted;
      var mounts = FS.getMounts(mount);
      Object.keys(FS.nameTable).forEach((function(hash) {
        var current = FS.nameTable[hash];
        while (current) {
          var next = current.name_next;
          if (mounts.indexOf(current.mount) !== -1) {
            FS.destroyNode(current);
          }
          current = next;
        }
      }));
      node.mounted = null;
      var idx = node.mount.mounts.indexOf(mount);
      assert(idx !== -1);
      node.mount.mounts.splice(idx, 1);
    }),
    lookup: (function(parent, name) {
      return parent.node_ops.lookup(parent, name);
    }),
    mknod: (function(path, mode, dev) {
      var lookup = FS.lookupPath(path, {parent: true});
      var parent = lookup.node;
      var name = PATH.basename(path);
      if (!name || name === "." || name === "..") {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      var err = FS.mayCreate(parent, name);
      if (err) {
        throw new FS.ErrnoError(err);
      }
      if (!parent.node_ops.mknod) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      return parent.node_ops.mknod(parent, name, mode, dev);
    }),
    create: (function(path, mode) {
      mode = mode !== undefined ? mode : 438;
      mode &= 4095;
      mode |= 32768;
      return FS.mknod(path, mode, 0);
    }),
    mkdir: (function(path, mode) {
      mode = mode !== undefined ? mode : 511;
      mode &= 511 | 512;
      mode |= 16384;
      return FS.mknod(path, mode, 0);
    }),
    mkdev: (function(path, mode, dev) {
      if (typeof dev === "undefined") {
        dev = mode;
        mode = 438;
      }
      mode |= 8192;
      return FS.mknod(path, mode, dev);
    }),
    symlink: (function(oldpath, newpath) {
      if (!PATH.resolve(oldpath)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }
      var lookup = FS.lookupPath(newpath, {parent: true});
      var parent = lookup.node;
      if (!parent) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }
      var newname = PATH.basename(newpath);
      var err = FS.mayCreate(parent, newname);
      if (err) {
        throw new FS.ErrnoError(err);
      }
      if (!parent.node_ops.symlink) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      return parent.node_ops.symlink(parent, newname, oldpath);
    }),
    rename: (function(old_path, new_path) {
      var old_dirname = PATH.dirname(old_path);
      var new_dirname = PATH.dirname(new_path);
      var old_name = PATH.basename(old_path);
      var new_name = PATH.basename(new_path);
      var lookup,
          old_dir,
          new_dir;
      try {
        lookup = FS.lookupPath(old_path, {parent: true});
        old_dir = lookup.node;
        lookup = FS.lookupPath(new_path, {parent: true});
        new_dir = lookup.node;
      } catch (e) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
      }
      if (!old_dir || !new_dir)
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      if (old_dir.mount !== new_dir.mount) {
        throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
      }
      var old_node = FS.lookupNode(old_dir, old_name);
      var relative = PATH.relative(old_path, new_dirname);
      if (relative.charAt(0) !== ".") {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      relative = PATH.relative(new_path, old_dirname);
      if (relative.charAt(0) !== ".") {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
      }
      var new_node;
      try {
        new_node = FS.lookupNode(new_dir, new_name);
      } catch (e) {}
      if (old_node === new_node) {
        return ;
      }
      var isdir = FS.isDir(old_node.mode);
      var err = FS.mayDelete(old_dir, old_name, isdir);
      if (err) {
        throw new FS.ErrnoError(err);
      }
      err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
      if (err) {
        throw new FS.ErrnoError(err);
      }
      if (!old_dir.node_ops.rename) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
      }
      if (new_dir !== old_dir) {
        err = FS.nodePermissions(old_dir, "w");
        if (err) {
          throw new FS.ErrnoError(err);
        }
      }
      try {
        if (FS.trackingDelegate["willMovePath"]) {
          FS.trackingDelegate["willMovePath"](old_path, new_path);
        }
      } catch (e) {
        console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
      }
      FS.hashRemoveNode(old_node);
      try {
        old_dir.node_ops.rename(old_node, new_dir, new_name);
      } catch (e) {
        throw e;
      } finally {
        FS.hashAddNode(old_node);
      }
      try {
        if (FS.trackingDelegate["onMovePath"])
          FS.trackingDelegate["onMovePath"](old_path, new_path);
      } catch (e) {
        console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
      }
    }),
    rmdir: (function(path) {
      var lookup = FS.lookupPath(path, {parent: true});
      var parent = lookup.node;
      var name = PATH.basename(path);
      var node = FS.lookupNode(parent, name);
      var err = FS.mayDelete(parent, name, true);
      if (err) {
        throw new FS.ErrnoError(err);
      }
      if (!parent.node_ops.rmdir) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
      }
      try {
        if (FS.trackingDelegate["willDeletePath"]) {
          FS.trackingDelegate["willDeletePath"](path);
        }
      } catch (e) {
        console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
      }
      parent.node_ops.rmdir(parent, name);
      FS.destroyNode(node);
      try {
        if (FS.trackingDelegate["onDeletePath"])
          FS.trackingDelegate["onDeletePath"](path);
      } catch (e) {
        console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
      }
    }),
    readdir: (function(path) {
      var lookup = FS.lookupPath(path, {follow: true});
      var node = lookup.node;
      if (!node.node_ops.readdir) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
      }
      return node.node_ops.readdir(node);
    }),
    unlink: (function(path) {
      var lookup = FS.lookupPath(path, {parent: true});
      var parent = lookup.node;
      var name = PATH.basename(path);
      var node = FS.lookupNode(parent, name);
      var err = FS.mayDelete(parent, name, false);
      if (err) {
        if (err === ERRNO_CODES.EISDIR)
          err = ERRNO_CODES.EPERM;
        throw new FS.ErrnoError(err);
      }
      if (!parent.node_ops.unlink) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
      }
      try {
        if (FS.trackingDelegate["willDeletePath"]) {
          FS.trackingDelegate["willDeletePath"](path);
        }
      } catch (e) {
        console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
      }
      parent.node_ops.unlink(parent, name);
      FS.destroyNode(node);
      try {
        if (FS.trackingDelegate["onDeletePath"])
          FS.trackingDelegate["onDeletePath"](path);
      } catch (e) {
        console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
      }
    }),
    readlink: (function(path) {
      var lookup = FS.lookupPath(path);
      var link = lookup.node;
      if (!link) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }
      if (!link.node_ops.readlink) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      return PATH.resolve(FS.getPath(lookup.node.parent), link.node_ops.readlink(link));
    }),
    stat: (function(path, dontFollow) {
      var lookup = FS.lookupPath(path, {follow: !dontFollow});
      var node = lookup.node;
      if (!node) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }
      if (!node.node_ops.getattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      return node.node_ops.getattr(node);
    }),
    lstat: (function(path) {
      return FS.stat(path, true);
    }),
    chmod: (function(path, mode, dontFollow) {
      var node;
      if (typeof path === "string") {
        var lookup = FS.lookupPath(path, {follow: !dontFollow});
        node = lookup.node;
      } else {
        node = path;
      }
      if (!node.node_ops.setattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      node.node_ops.setattr(node, {
        mode: mode & 4095 | node.mode & ~4095,
        timestamp: Date.now()
      });
    }),
    lchmod: (function(path, mode) {
      FS.chmod(path, mode, true);
    }),
    fchmod: (function(fd, mode) {
      var stream = FS.getStream(fd);
      if (!stream) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }
      FS.chmod(stream.node, mode);
    }),
    chown: (function(path, uid, gid, dontFollow) {
      var node;
      if (typeof path === "string") {
        var lookup = FS.lookupPath(path, {follow: !dontFollow});
        node = lookup.node;
      } else {
        node = path;
      }
      if (!node.node_ops.setattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      node.node_ops.setattr(node, {timestamp: Date.now()});
    }),
    lchown: (function(path, uid, gid) {
      FS.chown(path, uid, gid, true);
    }),
    fchown: (function(fd, uid, gid) {
      var stream = FS.getStream(fd);
      if (!stream) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }
      FS.chown(stream.node, uid, gid);
    }),
    truncate: (function(path, len) {
      if (len < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      var node;
      if (typeof path === "string") {
        var lookup = FS.lookupPath(path, {follow: true});
        node = lookup.node;
      } else {
        node = path;
      }
      if (!node.node_ops.setattr) {
        throw new FS.ErrnoError(ERRNO_CODES.EPERM);
      }
      if (FS.isDir(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
      }
      if (!FS.isFile(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      var err = FS.nodePermissions(node, "w");
      if (err) {
        throw new FS.ErrnoError(err);
      }
      node.node_ops.setattr(node, {
        size: len,
        timestamp: Date.now()
      });
    }),
    ftruncate: (function(fd, len) {
      var stream = FS.getStream(fd);
      if (!stream) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }
      if ((stream.flags & 2097155) === 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      FS.truncate(stream.node, len);
    }),
    utime: (function(path, atime, mtime) {
      var lookup = FS.lookupPath(path, {follow: true});
      var node = lookup.node;
      node.node_ops.setattr(node, {timestamp: Math.max(atime, mtime)});
    }),
    open: (function(path, flags, mode, fd_start, fd_end) {
      if (path === "") {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }
      flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
      mode = typeof mode === "undefined" ? 438 : mode;
      if (flags & 64) {
        mode = mode & 4095 | 32768;
      } else {
        mode = 0;
      }
      var node;
      if (typeof path === "object") {
        node = path;
      } else {
        path = PATH.normalize(path);
        try {
          var lookup = FS.lookupPath(path, {follow: !(flags & 131072)});
          node = lookup.node;
        } catch (e) {}
      }
      var created = false;
      if (flags & 64) {
        if (node) {
          if (flags & 128) {
            throw new FS.ErrnoError(ERRNO_CODES.EEXIST);
          }
        } else {
          node = FS.mknod(path, mode, 0);
          created = true;
        }
      }
      if (!node) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
      }
      if (FS.isChrdev(node.mode)) {
        flags &= ~512;
      }
      if (!created) {
        var err = FS.mayOpen(node, flags);
        if (err) {
          throw new FS.ErrnoError(err);
        }
      }
      if (flags & 512) {
        FS.truncate(node, 0);
      }
      flags &= ~(128 | 512);
      var stream = FS.createStream({
        node: node,
        path: FS.getPath(node),
        flags: flags,
        seekable: true,
        position: 0,
        stream_ops: node.stream_ops,
        ungotten: [],
        error: false
      }, fd_start, fd_end);
      if (stream.stream_ops.open) {
        stream.stream_ops.open(stream);
      }
      if (Module["logReadFiles"] && !(flags & 1)) {
        if (!FS.readFiles)
          FS.readFiles = {};
        if (!(path in FS.readFiles)) {
          FS.readFiles[path] = 1;
          Module["printErr"]("read file: " + path);
        }
      }
      try {
        if (FS.trackingDelegate["onOpenFile"]) {
          var trackingFlags = 0;
          if ((flags & 2097155) !== 1) {
            trackingFlags |= FS.tracking.openFlags.READ;
          }
          if ((flags & 2097155) !== 0) {
            trackingFlags |= FS.tracking.openFlags.WRITE;
          }
          FS.trackingDelegate["onOpenFile"](path, trackingFlags);
        }
      } catch (e) {
        console.log("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message);
      }
      return stream;
    }),
    close: (function(stream) {
      try {
        if (stream.stream_ops.close) {
          stream.stream_ops.close(stream);
        }
      } catch (e) {
        throw e;
      } finally {
        FS.closeStream(stream.fd);
      }
    }),
    llseek: (function(stream, offset, whence) {
      if (!stream.seekable || !stream.stream_ops.llseek) {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
      }
      stream.position = stream.stream_ops.llseek(stream, offset, whence);
      stream.ungotten = [];
      return stream.position;
    }),
    read: (function(stream, buffer, offset, length, position) {
      if (length < 0 || position < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      if ((stream.flags & 2097155) === 1) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }
      if (FS.isDir(stream.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
      }
      if (!stream.stream_ops.read) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      var seeking = true;
      if (typeof position === "undefined") {
        position = stream.position;
        seeking = false;
      } else if (!stream.seekable) {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
      }
      var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
      if (!seeking)
        stream.position += bytesRead;
      return bytesRead;
    }),
    write: (function(stream, buffer, offset, length, position, canOwn) {
      if (length < 0 || position < 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      if ((stream.flags & 2097155) === 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }
      if (FS.isDir(stream.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
      }
      if (!stream.stream_ops.write) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      if (stream.flags & 1024) {
        FS.llseek(stream, 0, 2);
      }
      var seeking = true;
      if (typeof position === "undefined") {
        position = stream.position;
        seeking = false;
      } else if (!stream.seekable) {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
      }
      var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
      if (!seeking)
        stream.position += bytesWritten;
      try {
        if (stream.path && FS.trackingDelegate["onWriteToFile"])
          FS.trackingDelegate["onWriteToFile"](stream.path);
      } catch (e) {
        console.log("FS.trackingDelegate['onWriteToFile']('" + path + "') threw an exception: " + e.message);
      }
      return bytesWritten;
    }),
    allocate: (function(stream, offset, length) {
      if (offset < 0 || length <= 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
      }
      if ((stream.flags & 2097155) === 0) {
        throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      }
      if (!FS.isFile(stream.node.mode) && !FS.isDir(node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
      }
      if (!stream.stream_ops.allocate) {
        throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
      }
      stream.stream_ops.allocate(stream, offset, length);
    }),
    mmap: (function(stream, buffer, offset, length, position, prot, flags) {
      if ((stream.flags & 2097155) === 1) {
        throw new FS.ErrnoError(ERRNO_CODES.EACCES);
      }
      if (!stream.stream_ops.mmap) {
        throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
      }
      return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
    }),
    msync: (function(stream, buffer, offset, length, mmapFlags) {
      if (!stream || !stream.stream_ops.msync) {
        return 0;
      }
      return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
    }),
    munmap: (function(stream) {
      return 0;
    }),
    ioctl: (function(stream, cmd, arg) {
      if (!stream.stream_ops.ioctl) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
      }
      return stream.stream_ops.ioctl(stream, cmd, arg);
    }),
    readFile: (function(path, opts) {
      opts = opts || {};
      opts.flags = opts.flags || "r";
      opts.encoding = opts.encoding || "binary";
      if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
        throw new Error('Invalid encoding type "' + opts.encoding + '"');
      }
      var ret;
      var stream = FS.open(path, opts.flags);
      var stat = FS.stat(path);
      var length = stat.size;
      var buf = new Uint8Array(length);
      FS.read(stream, buf, 0, length, 0);
      if (opts.encoding === "utf8") {
        ret = UTF8ArrayToString(buf, 0);
      } else if (opts.encoding === "binary") {
        ret = buf;
      }
      FS.close(stream);
      return ret;
    }),
    writeFile: (function(path, data, opts) {
      opts = opts || {};
      opts.flags = opts.flags || "w";
      opts.encoding = opts.encoding || "utf8";
      if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
        throw new Error('Invalid encoding type "' + opts.encoding + '"');
      }
      var stream = FS.open(path, opts.flags, opts.mode);
      if (opts.encoding === "utf8") {
        var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
        var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
        FS.write(stream, buf, 0, actualNumBytes, 0, opts.canOwn);
      } else if (opts.encoding === "binary") {
        FS.write(stream, data, 0, data.length, 0, opts.canOwn);
      }
      FS.close(stream);
    }),
    cwd: (function() {
      return FS.currentPath;
    }),
    chdir: (function(path) {
      var lookup = FS.lookupPath(path, {follow: true});
      if (!FS.isDir(lookup.node.mode)) {
        throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
      }
      var err = FS.nodePermissions(lookup.node, "x");
      if (err) {
        throw new FS.ErrnoError(err);
      }
      FS.currentPath = lookup.path;
    }),
    createDefaultDirectories: (function() {
      FS.mkdir("/tmp");
      FS.mkdir("/home");
      FS.mkdir("/home/web_user");
    }),
    createDefaultDevices: (function() {
      FS.mkdir("/dev");
      FS.registerDevice(FS.makedev(1, 3), {
        read: (function() {
          return 0;
        }),
        write: (function(stream, buffer, offset, length, pos) {
          return length;
        })
      });
      FS.mkdev("/dev/null", FS.makedev(1, 3));
      TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
      TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
      FS.mkdev("/dev/tty", FS.makedev(5, 0));
      FS.mkdev("/dev/tty1", FS.makedev(6, 0));
      var random_device;
      if (typeof crypto !== "undefined") {
        var randomBuffer = new Uint8Array(1);
        random_device = (function() {
          crypto.getRandomValues(randomBuffer);
          return randomBuffer[0];
        });
      } else if (ENVIRONMENT_IS_NODE) {
        random_device = (function() {
          return require("crypto").randomBytes(1)[0];
        });
      } else {
        random_device = (function() {
          return Math.random() * 256 | 0;
        });
      }
      FS.createDevice("/dev", "random", random_device);
      FS.createDevice("/dev", "urandom", random_device);
      FS.mkdir("/dev/shm");
      FS.mkdir("/dev/shm/tmp");
    }),
    createStandardStreams: (function() {
      if (Module["stdin"]) {
        FS.createDevice("/dev", "stdin", Module["stdin"]);
      } else {
        FS.symlink("/dev/tty", "/dev/stdin");
      }
      if (Module["stdout"]) {
        FS.createDevice("/dev", "stdout", null, Module["stdout"]);
      } else {
        FS.symlink("/dev/tty", "/dev/stdout");
      }
      if (Module["stderr"]) {
        FS.createDevice("/dev", "stderr", null, Module["stderr"]);
      } else {
        FS.symlink("/dev/tty1", "/dev/stderr");
      }
      var stdin = FS.open("/dev/stdin", "r");
      HEAP32[_stdin >> 2] = FS.getPtrForStream(stdin);
      assert(stdin.fd === 0, "invalid handle for stdin (" + stdin.fd + ")");
      var stdout = FS.open("/dev/stdout", "w");
      HEAP32[_stdout >> 2] = FS.getPtrForStream(stdout);
      assert(stdout.fd === 1, "invalid handle for stdout (" + stdout.fd + ")");
      var stderr = FS.open("/dev/stderr", "w");
      HEAP32[_stderr >> 2] = FS.getPtrForStream(stderr);
      assert(stderr.fd === 2, "invalid handle for stderr (" + stderr.fd + ")");
    }),
    ensureErrnoError: (function() {
      if (FS.ErrnoError)
        return ;
      FS.ErrnoError = function ErrnoError(errno, node) {
        this.node = node;
        this.setErrno = (function(errno) {
          this.errno = errno;
          for (var key in ERRNO_CODES) {
            if (ERRNO_CODES[key] === errno) {
              this.code = key;
              break;
            }
          }
        });
        this.setErrno(errno);
        this.message = ERRNO_MESSAGES[errno];
      };
      FS.ErrnoError.prototype = new Error;
      FS.ErrnoError.prototype.constructor = FS.ErrnoError;
      [ERRNO_CODES.ENOENT].forEach((function(code) {
        FS.genericErrors[code] = new FS.ErrnoError(code);
        FS.genericErrors[code].stack = "<generic error, no stack>";
      }));
    }),
    staticInit: (function() {
      FS.ensureErrnoError();
      FS.nameTable = new Array(4096);
      FS.mount(MEMFS, {}, "/");
      FS.createDefaultDirectories();
      FS.createDefaultDevices();
    }),
    init: (function(input, output, error) {
      assert(!FS.init.initialized, "FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");
      FS.init.initialized = true;
      FS.ensureErrnoError();
      Module["stdin"] = input || Module["stdin"];
      Module["stdout"] = output || Module["stdout"];
      Module["stderr"] = error || Module["stderr"];
      FS.createStandardStreams();
    }),
    quit: (function() {
      FS.init.initialized = false;
      for (var i = 0; i < FS.streams.length; i++) {
        var stream = FS.streams[i];
        if (!stream) {
          continue;
        }
        FS.close(stream);
      }
    }),
    getMode: (function(canRead, canWrite) {
      var mode = 0;
      if (canRead)
        mode |= 292 | 73;
      if (canWrite)
        mode |= 146;
      return mode;
    }),
    joinPath: (function(parts, forceRelative) {
      var path = PATH.join.apply(null, parts);
      if (forceRelative && path[0] == "/")
        path = path.substr(1);
      return path;
    }),
    absolutePath: (function(relative, base) {
      return PATH.resolve(base, relative);
    }),
    standardizePath: (function(path) {
      return PATH.normalize(path);
    }),
    findObject: (function(path, dontResolveLastLink) {
      var ret = FS.analyzePath(path, dontResolveLastLink);
      if (ret.exists) {
        return ret.object;
      } else {
        ___setErrNo(ret.error);
        return null;
      }
    }),
    analyzePath: (function(path, dontResolveLastLink) {
      try {
        var lookup = FS.lookupPath(path, {follow: !dontResolveLastLink});
        path = lookup.path;
      } catch (e) {}
      var ret = {
        isRoot: false,
        exists: false,
        error: 0,
        name: null,
        path: null,
        object: null,
        parentExists: false,
        parentPath: null,
        parentObject: null
      };
      try {
        var lookup = FS.lookupPath(path, {parent: true});
        ret.parentExists = true;
        ret.parentPath = lookup.path;
        ret.parentObject = lookup.node;
        ret.name = PATH.basename(path);
        lookup = FS.lookupPath(path, {follow: !dontResolveLastLink});
        ret.exists = true;
        ret.path = lookup.path;
        ret.object = lookup.node;
        ret.name = lookup.node.name;
        ret.isRoot = lookup.path === "/";
      } catch (e) {
        ret.error = e.errno;
      }
      return ret;
    }),
    createFolder: (function(parent, name, canRead, canWrite) {
      var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
      var mode = FS.getMode(canRead, canWrite);
      return FS.mkdir(path, mode);
    }),
    createPath: (function(parent, path, canRead, canWrite) {
      parent = typeof parent === "string" ? parent : FS.getPath(parent);
      var parts = path.split("/").reverse();
      while (parts.length) {
        var part = parts.pop();
        if (!part)
          continue;
        var current = PATH.join2(parent, part);
        try {
          FS.mkdir(current);
        } catch (e) {}
        parent = current;
      }
      return current;
    }),
    createFile: (function(parent, name, properties, canRead, canWrite) {
      var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
      var mode = FS.getMode(canRead, canWrite);
      return FS.create(path, mode);
    }),
    createDataFile: (function(parent, name, data, canRead, canWrite, canOwn) {
      var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
      var mode = FS.getMode(canRead, canWrite);
      var node = FS.create(path, mode);
      if (data) {
        if (typeof data === "string") {
          var arr = new Array(data.length);
          for (var i = 0,
              len = data.length; i < len; ++i)
            arr[i] = data.charCodeAt(i);
          data = arr;
        }
        FS.chmod(node, mode | 146);
        var stream = FS.open(node, "w");
        FS.write(stream, data, 0, data.length, 0, canOwn);
        FS.close(stream);
        FS.chmod(node, mode);
      }
      return node;
    }),
    createDevice: (function(parent, name, input, output) {
      var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
      var mode = FS.getMode(!!input, !!output);
      if (!FS.createDevice.major)
        FS.createDevice.major = 64;
      var dev = FS.makedev(FS.createDevice.major++, 0);
      FS.registerDevice(dev, {
        open: (function(stream) {
          stream.seekable = false;
        }),
        close: (function(stream) {
          if (output && output.buffer && output.buffer.length) {
            output(10);
          }
        }),
        read: (function(stream, buffer, offset, length, pos) {
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = input();
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
            if (result === null || result === undefined)
              break;
            bytesRead++;
            buffer[offset + i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        }),
        write: (function(stream, buffer, offset, length, pos) {
          for (var i = 0; i < length; i++) {
            try {
              output(buffer[offset + i]);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        })
      });
      return FS.mkdev(path, mode, dev);
    }),
    createLink: (function(parent, name, target, canRead, canWrite) {
      var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
      return FS.symlink(target, path);
    }),
    forceLoadFile: (function(obj) {
      if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
        return true;
      var success = true;
      if (typeof XMLHttpRequest !== "undefined") {
        throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
      } else if (Module["read"]) {
        try {
          obj.contents = intArrayFromString(Module["read"](obj.url), true);
          obj.usedBytes = obj.contents.length;
        } catch (e) {
          success = false;
        }
      } else {
        throw new Error("Cannot load without read() or XMLHttpRequest.");
      }
      if (!success)
        ___setErrNo(ERRNO_CODES.EIO);
      return success;
    }),
    createLazyFile: (function(parent, name, url, canRead, canWrite) {
      function LazyUint8Array() {
        this.lengthKnown = false;
        this.chunks = [];
      }
      LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
        if (idx > this.length - 1 || idx < 0) {
          return undefined;
        }
        var chunkOffset = idx % this.chunkSize;
        var chunkNum = idx / this.chunkSize | 0;
        return this.getter(chunkNum)[chunkOffset];
      };
      LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
        this.getter = getter;
      };
      LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
        var xhr = new XMLHttpRequest;
        xhr.open("HEAD", url, false);
        xhr.send(null);
        if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
          throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
        var datalength = Number(xhr.getResponseHeader("Content-length"));
        var header;
        var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
        var chunkSize = 1024 * 1024;
        if (!hasByteServing)
          chunkSize = datalength;
        var doXHR = (function(from, to) {
          if (from > to)
            throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
          if (to > datalength - 1)
            throw new Error("only " + datalength + " bytes available! programmer error!");
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, false);
          if (datalength !== chunkSize)
            xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
          if (typeof Uint8Array != "undefined")
            xhr.responseType = "arraybuffer";
          if (xhr.overrideMimeType) {
            xhr.overrideMimeType("text/plain; charset=x-user-defined");
          }
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
            throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          if (xhr.response !== undefined) {
            return new Uint8Array(xhr.response || []);
          } else {
            return intArrayFromString(xhr.responseText || "", true);
          }
        });
        var lazyArray = this;
        lazyArray.setDataGetter((function(chunkNum) {
          var start = chunkNum * chunkSize;
          var end = (chunkNum + 1) * chunkSize - 1;
          end = Math.min(end, datalength - 1);
          if (typeof lazyArray.chunks[chunkNum] === "undefined") {
            lazyArray.chunks[chunkNum] = doXHR(start, end);
          }
          if (typeof lazyArray.chunks[chunkNum] === "undefined")
            throw new Error("doXHR failed!");
          return lazyArray.chunks[chunkNum];
        }));
        this._length = datalength;
        this._chunkSize = chunkSize;
        this.lengthKnown = true;
      };
      if (typeof XMLHttpRequest !== "undefined") {
        if (!ENVIRONMENT_IS_WORKER)
          throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
        var lazyArray = new LazyUint8Array;
        Object.defineProperty(lazyArray, "length", {get: (function() {
            if (!this.lengthKnown) {
              this.cacheLength();
            }
            return this._length;
          })});
        Object.defineProperty(lazyArray, "chunkSize", {get: (function() {
            if (!this.lengthKnown) {
              this.cacheLength();
            }
            return this._chunkSize;
          })});
        var properties = {
          isDevice: false,
          contents: lazyArray
        };
      } else {
        var properties = {
          isDevice: false,
          url: url
        };
      }
      var node = FS.createFile(parent, name, properties, canRead, canWrite);
      if (properties.contents) {
        node.contents = properties.contents;
      } else if (properties.url) {
        node.contents = null;
        node.url = properties.url;
      }
      Object.defineProperty(node, "usedBytes", {get: (function() {
          return this.contents.length;
        })});
      var stream_ops = {};
      var keys = Object.keys(node.stream_ops);
      keys.forEach((function(key) {
        var fn = node.stream_ops[key];
        stream_ops[key] = function forceLoadLazyFile() {
          if (!FS.forceLoadFile(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
          }
          return fn.apply(null, arguments);
        };
      }));
      stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
        if (!FS.forceLoadFile(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EIO);
        }
        var contents = stream.node.contents;
        if (position >= contents.length)
          return 0;
        var size = Math.min(contents.length - position, length);
        assert(size >= 0);
        if (contents.slice) {
          for (var i = 0; i < size; i++) {
            buffer[offset + i] = contents[position + i];
          }
        } else {
          for (var i = 0; i < size; i++) {
            buffer[offset + i] = contents.get(position + i);
          }
        }
        return size;
      };
      node.stream_ops = stream_ops;
      return node;
    }),
    createPreloadedFile: (function(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
      Browser.init();
      var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
      var dep = getUniqueRunDependency("cp " + fullname);
      function processData(byteArray) {
        function finish(byteArray) {
          if (preFinish)
            preFinish();
          if (!dontCreateFile) {
            FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
          }
          if (onload)
            onload();
          removeRunDependency(dep);
        }
        var handled = false;
        Module["preloadPlugins"].forEach((function(plugin) {
          if (handled)
            return ;
          if (plugin["canHandle"](fullname)) {
            plugin["handle"](byteArray, fullname, finish, (function() {
              if (onerror)
                onerror();
              removeRunDependency(dep);
            }));
            handled = true;
          }
        }));
        if (!handled)
          finish(byteArray);
      }
      addRunDependency(dep);
      if (typeof url == "string") {
        Browser.asyncLoad(url, (function(byteArray) {
          processData(byteArray);
        }), onerror);
      } else {
        processData(url);
      }
    }),
    indexedDB: (function() {
      return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    }),
    DB_NAME: (function() {
      return "EM_FS_" + window.location.pathname;
    }),
    DB_VERSION: 20,
    DB_STORE_NAME: "FILE_DATA",
    saveFilesToDB: (function(paths, onload, onerror) {
      onload = onload || (function() {});
      onerror = onerror || (function() {});
      var indexedDB = FS.indexedDB();
      try {
        var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
      } catch (e) {
        return onerror(e);
      }
      openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
        console.log("creating db");
        var db = openRequest.result;
        db.createObjectStore(FS.DB_STORE_NAME);
      };
      openRequest.onsuccess = function openRequest_onsuccess() {
        var db = openRequest.result;
        var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
        var files = transaction.objectStore(FS.DB_STORE_NAME);
        var ok = 0,
            fail = 0,
            total = paths.length;
        function finish() {
          if (fail == 0)
            onload();
          else
            onerror();
        }
        paths.forEach((function(path) {
          var putRequest = files.put(FS.analyzePath(path).object.contents, path);
          putRequest.onsuccess = function putRequest_onsuccess() {
            ok++;
            if (ok + fail == total)
              finish();
          };
          putRequest.onerror = function putRequest_onerror() {
            fail++;
            if (ok + fail == total)
              finish();
          };
        }));
        transaction.onerror = onerror;
      };
      openRequest.onerror = onerror;
    }),
    loadFilesFromDB: (function(paths, onload, onerror) {
      onload = onload || (function() {});
      onerror = onerror || (function() {});
      var indexedDB = FS.indexedDB();
      try {
        var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
      } catch (e) {
        return onerror(e);
      }
      openRequest.onupgradeneeded = onerror;
      openRequest.onsuccess = function openRequest_onsuccess() {
        var db = openRequest.result;
        try {
          var transaction = db.transaction([FS.DB_STORE_NAME], "readonly");
        } catch (e) {
          onerror(e);
          return ;
        }
        var files = transaction.objectStore(FS.DB_STORE_NAME);
        var ok = 0,
            fail = 0,
            total = paths.length;
        function finish() {
          if (fail == 0)
            onload();
          else
            onerror();
        }
        paths.forEach((function(path) {
          var getRequest = files.get(path);
          getRequest.onsuccess = function getRequest_onsuccess() {
            if (FS.analyzePath(path).exists) {
              FS.unlink(path);
            }
            FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
            ok++;
            if (ok + fail == total)
              finish();
          };
          getRequest.onerror = function getRequest_onerror() {
            fail++;
            if (ok + fail == total)
              finish();
          };
        }));
        transaction.onerror = onerror;
      };
      openRequest.onerror = onerror;
    })
  };
  function _mkport() {
    throw "TODO";
  }
  var SOCKFS = {
    mount: (function(mount) {
      Module["websocket"] = Module["websocket"] && "object" === typeof Module["websocket"] ? Module["websocket"] : {};
      Module["websocket"]._callbacks = {};
      Module["websocket"]["on"] = (function(event, callback) {
        if ("function" === typeof callback) {
          this._callbacks[event] = callback;
        }
        return this;
      });
      Module["websocket"].emit = (function(event, param) {
        if ("function" === typeof this._callbacks[event]) {
          this._callbacks[event].call(this, param);
        }
      });
      return FS.createNode(null, "/", 16384 | 511, 0);
    }),
    createSocket: (function(family, type, protocol) {
      var streaming = type == 1;
      if (protocol) {
        assert(streaming == (protocol == 6));
      }
      var sock = {
        family: family,
        type: type,
        protocol: protocol,
        server: null,
        error: null,
        peers: {},
        pending: [],
        recv_queue: [],
        sock_ops: SOCKFS.websocket_sock_ops
      };
      var name = SOCKFS.nextname();
      var node = FS.createNode(SOCKFS.root, name, 49152, 0);
      node.sock = sock;
      var stream = FS.createStream({
        path: name,
        node: node,
        flags: FS.modeStringToFlags("r+"),
        seekable: false,
        stream_ops: SOCKFS.stream_ops
      });
      sock.stream = stream;
      return sock;
    }),
    getSocket: (function(fd) {
      var stream = FS.getStream(fd);
      if (!stream || !FS.isSocket(stream.node.mode)) {
        return null;
      }
      return stream.node.sock;
    }),
    stream_ops: {
      poll: (function(stream) {
        var sock = stream.node.sock;
        return sock.sock_ops.poll(sock);
      }),
      ioctl: (function(stream, request, varargs) {
        var sock = stream.node.sock;
        return sock.sock_ops.ioctl(sock, request, varargs);
      }),
      read: (function(stream, buffer, offset, length, position) {
        var sock = stream.node.sock;
        var msg = sock.sock_ops.recvmsg(sock, length);
        if (!msg) {
          return 0;
        }
        buffer.set(msg.buffer, offset);
        return msg.buffer.length;
      }),
      write: (function(stream, buffer, offset, length, position) {
        var sock = stream.node.sock;
        return sock.sock_ops.sendmsg(sock, buffer, offset, length);
      }),
      close: (function(stream) {
        var sock = stream.node.sock;
        sock.sock_ops.close(sock);
      })
    },
    nextname: (function() {
      if (!SOCKFS.nextname.current) {
        SOCKFS.nextname.current = 0;
      }
      return "socket[" + SOCKFS.nextname.current++ + "]";
    }),
    websocket_sock_ops: {
      createPeer: (function(sock, addr, port) {
        var ws;
        if (typeof addr === "object") {
          ws = addr;
          addr = null;
          port = null;
        }
        if (ws) {
          if (ws._socket) {
            addr = ws._socket.remoteAddress;
            port = ws._socket.remotePort;
          } else {
            var result = /ws[s]?:\/\/([^:]+):(\d+)/.exec(ws.url);
            if (!result) {
              throw new Error("WebSocket URL must be in the format ws(s)://address:port");
            }
            addr = result[1];
            port = parseInt(result[2], 10);
          }
        } else {
          try {
            var runtimeConfig = Module["websocket"] && "object" === typeof Module["websocket"];
            var url = "ws:#".replace("#", "//");
            if (runtimeConfig) {
              if ("string" === typeof Module["websocket"]["url"]) {
                url = Module["websocket"]["url"];
              }
            }
            if (url === "ws://" || url === "wss://") {
              var parts = addr.split("/");
              url = url + parts[0] + ":" + port + "/" + parts.slice(1).join("/");
            }
            var subProtocols = "binary";
            if (runtimeConfig) {
              if ("string" === typeof Module["websocket"]["subprotocol"]) {
                subProtocols = Module["websocket"]["subprotocol"];
              }
            }
            subProtocols = subProtocols.replace(/^ +| +$/g, "").split(/ *, */);
            var opts = ENVIRONMENT_IS_NODE ? {"protocol": subProtocols.toString()} : subProtocols;
            var WebSocket = ENVIRONMENT_IS_NODE ? require("ws") : window["WebSocket"];
            ws = new WebSocket(url, opts);
            ws.binaryType = "arraybuffer";
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES.EHOSTUNREACH);
          }
        }
        var peer = {
          addr: addr,
          port: port,
          socket: ws,
          dgram_send_queue: []
        };
        SOCKFS.websocket_sock_ops.addPeer(sock, peer);
        SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);
        if (sock.type === 2 && typeof sock.sport !== "undefined") {
          peer.dgram_send_queue.push(new Uint8Array([255, 255, 255, 255, "p".charCodeAt(0), "o".charCodeAt(0), "r".charCodeAt(0), "t".charCodeAt(0), (sock.sport & 65280) >> 8, sock.sport & 255]));
        }
        return peer;
      }),
      getPeer: (function(sock, addr, port) {
        return sock.peers[addr + ":" + port];
      }),
      addPeer: (function(sock, peer) {
        sock.peers[peer.addr + ":" + peer.port] = peer;
      }),
      removePeer: (function(sock, peer) {
        delete sock.peers[peer.addr + ":" + peer.port];
      }),
      handlePeerEvents: (function(sock, peer) {
        var first = true;
        var handleOpen = (function() {
          Module["websocket"].emit("open", sock.stream.fd);
          try {
            var queued = peer.dgram_send_queue.shift();
            while (queued) {
              peer.socket.send(queued);
              queued = peer.dgram_send_queue.shift();
            }
          } catch (e) {
            peer.socket.close();
          }
        });
        function handleMessage(data) {
          assert(typeof data !== "string" && data.byteLength !== undefined);
          data = new Uint8Array(data);
          var wasfirst = first;
          first = false;
          if (wasfirst && data.length === 10 && data[0] === 255 && data[1] === 255 && data[2] === 255 && data[3] === 255 && data[4] === "p".charCodeAt(0) && data[5] === "o".charCodeAt(0) && data[6] === "r".charCodeAt(0) && data[7] === "t".charCodeAt(0)) {
            var newport = data[8] << 8 | data[9];
            SOCKFS.websocket_sock_ops.removePeer(sock, peer);
            peer.port = newport;
            SOCKFS.websocket_sock_ops.addPeer(sock, peer);
            return ;
          }
          sock.recv_queue.push({
            addr: peer.addr,
            port: peer.port,
            data: data
          });
          Module["websocket"].emit("message", sock.stream.fd);
        }
        if (ENVIRONMENT_IS_NODE) {
          peer.socket.on("open", handleOpen);
          peer.socket.on("message", (function(data, flags) {
            if (!flags.binary) {
              return ;
            }
            handleMessage((new Uint8Array(data)).buffer);
          }));
          peer.socket.on("close", (function() {
            Module["websocket"].emit("close", sock.stream.fd);
          }));
          peer.socket.on("error", (function(error) {
            sock.error = ERRNO_CODES.ECONNREFUSED;
            Module["websocket"].emit("error", [sock.stream.fd, sock.error, "ECONNREFUSED: Connection refused"]);
          }));
        } else {
          peer.socket.onopen = handleOpen;
          peer.socket.onclose = (function() {
            Module["websocket"].emit("close", sock.stream.fd);
          });
          peer.socket.onmessage = function peer_socket_onmessage(event) {
            handleMessage(event.data);
          };
          peer.socket.onerror = (function(error) {
            sock.error = ERRNO_CODES.ECONNREFUSED;
            Module["websocket"].emit("error", [sock.stream.fd, sock.error, "ECONNREFUSED: Connection refused"]);
          });
        }
      }),
      poll: (function(sock) {
        if (sock.type === 1 && sock.server) {
          return sock.pending.length ? 64 | 1 : 0;
        }
        var mask = 0;
        var dest = sock.type === 1 ? SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport) : null;
        if (sock.recv_queue.length || !dest || dest && dest.socket.readyState === dest.socket.CLOSING || dest && dest.socket.readyState === dest.socket.CLOSED) {
          mask |= 64 | 1;
        }
        if (!dest || dest && dest.socket.readyState === dest.socket.OPEN) {
          mask |= 4;
        }
        if (dest && dest.socket.readyState === dest.socket.CLOSING || dest && dest.socket.readyState === dest.socket.CLOSED) {
          mask |= 16;
        }
        return mask;
      }),
      ioctl: (function(sock, request, arg) {
        switch (request) {
          case 21531:
            var bytes = 0;
            if (sock.recv_queue.length) {
              bytes = sock.recv_queue[0].data.length;
            }
            HEAP32[arg >> 2] = bytes;
            return 0;
          default:
            return ERRNO_CODES.EINVAL;
        }
      }),
      close: (function(sock) {
        if (sock.server) {
          try {
            sock.server.close();
          } catch (e) {}
          sock.server = null;
        }
        var peers = Object.keys(sock.peers);
        for (var i = 0; i < peers.length; i++) {
          var peer = sock.peers[peers[i]];
          try {
            peer.socket.close();
          } catch (e) {}
          SOCKFS.websocket_sock_ops.removePeer(sock, peer);
        }
        return 0;
      }),
      bind: (function(sock, addr, port) {
        if (typeof sock.saddr !== "undefined" || typeof sock.sport !== "undefined") {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        sock.saddr = addr;
        sock.sport = port || _mkport();
        if (sock.type === 2) {
          if (sock.server) {
            sock.server.close();
            sock.server = null;
          }
          try {
            sock.sock_ops.listen(sock, 0);
          } catch (e) {
            if (!(e instanceof FS.ErrnoError))
              throw e;
            if (e.errno !== ERRNO_CODES.EOPNOTSUPP)
              throw e;
          }
        }
      }),
      connect: (function(sock, addr, port) {
        if (sock.server) {
          throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
        }
        if (typeof sock.daddr !== "undefined" && typeof sock.dport !== "undefined") {
          var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
          if (dest) {
            if (dest.socket.readyState === dest.socket.CONNECTING) {
              throw new FS.ErrnoError(ERRNO_CODES.EALREADY);
            } else {
              throw new FS.ErrnoError(ERRNO_CODES.EISCONN);
            }
          }
        }
        var peer = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
        sock.daddr = peer.addr;
        sock.dport = peer.port;
        throw new FS.ErrnoError(ERRNO_CODES.EINPROGRESS);
      }),
      listen: (function(sock, backlog) {
        if (!ENVIRONMENT_IS_NODE) {
          throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
        }
        if (sock.server) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var WebSocketServer = require("ws").Server;
        var host = sock.saddr;
        sock.server = new WebSocketServer({
          host: host,
          port: sock.sport
        });
        Module["websocket"].emit("listen", sock.stream.fd);
        sock.server.on("connection", (function(ws) {
          if (sock.type === 1) {
            var newsock = SOCKFS.createSocket(sock.family, sock.type, sock.protocol);
            var peer = SOCKFS.websocket_sock_ops.createPeer(newsock, ws);
            newsock.daddr = peer.addr;
            newsock.dport = peer.port;
            sock.pending.push(newsock);
            Module["websocket"].emit("connection", newsock.stream.fd);
          } else {
            SOCKFS.websocket_sock_ops.createPeer(sock, ws);
            Module["websocket"].emit("connection", sock.stream.fd);
          }
        }));
        sock.server.on("closed", (function() {
          Module["websocket"].emit("close", sock.stream.fd);
          sock.server = null;
        }));
        sock.server.on("error", (function(error) {
          sock.error = ERRNO_CODES.EHOSTUNREACH;
          Module["websocket"].emit("error", [sock.stream.fd, sock.error, "EHOSTUNREACH: Host is unreachable"]);
        }));
      }),
      accept: (function(listensock) {
        if (!listensock.server) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var newsock = listensock.pending.shift();
        newsock.stream.flags = listensock.stream.flags;
        return newsock;
      }),
      getname: (function(sock, peer) {
        var addr,
            port;
        if (peer) {
          if (sock.daddr === undefined || sock.dport === undefined) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
          }
          addr = sock.daddr;
          port = sock.dport;
        } else {
          addr = sock.saddr || 0;
          port = sock.sport || 0;
        }
        return {
          addr: addr,
          port: port
        };
      }),
      sendmsg: (function(sock, buffer, offset, length, addr, port) {
        if (sock.type === 2) {
          if (addr === undefined || port === undefined) {
            addr = sock.daddr;
            port = sock.dport;
          }
          if (addr === undefined || port === undefined) {
            throw new FS.ErrnoError(ERRNO_CODES.EDESTADDRREQ);
          }
        } else {
          addr = sock.daddr;
          port = sock.dport;
        }
        var dest = SOCKFS.websocket_sock_ops.getPeer(sock, addr, port);
        if (sock.type === 1) {
          if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
          } else if (dest.socket.readyState === dest.socket.CONNECTING) {
            throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
          }
        }
        var data;
        if (buffer instanceof Array || buffer instanceof ArrayBuffer) {
          data = buffer.slice(offset, offset + length);
        } else {
          data = buffer.buffer.slice(buffer.byteOffset + offset, buffer.byteOffset + offset + length);
        }
        if (sock.type === 2) {
          if (!dest || dest.socket.readyState !== dest.socket.OPEN) {
            if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
              dest = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
            }
            dest.dgram_send_queue.push(data);
            return length;
          }
        }
        try {
          dest.socket.send(data);
          return length;
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
      }),
      recvmsg: (function(sock, length) {
        if (sock.type === 1 && sock.server) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
        }
        var queued = sock.recv_queue.shift();
        if (!queued) {
          if (sock.type === 1) {
            var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
            if (!dest) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
            } else if (dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
              return null;
            } else {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
          } else {
            throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
          }
        }
        var queuedLength = queued.data.byteLength || queued.data.length;
        var queuedOffset = queued.data.byteOffset || 0;
        var queuedBuffer = queued.data.buffer || queued.data;
        var bytesRead = Math.min(length, queuedLength);
        var res = {
          buffer: new Uint8Array(queuedBuffer, queuedOffset, bytesRead),
          addr: queued.addr,
          port: queued.port
        };
        if (sock.type === 1 && bytesRead < queuedLength) {
          var bytesRemaining = queuedLength - bytesRead;
          queued.data = new Uint8Array(queuedBuffer, queuedOffset + bytesRead, bytesRemaining);
          sock.recv_queue.unshift(queued);
        }
        return res;
      })
    }
  };
  function _recv(fd, buf, len, flags) {
    var sock = SOCKFS.getSocket(fd);
    if (!sock) {
      ___setErrNo(ERRNO_CODES.EBADF);
      return -1;
    }
    return _read(fd, buf, len);
  }
  function _pread(fildes, buf, nbyte, offset) {
    var stream = FS.getStream(fildes);
    if (!stream) {
      ___setErrNo(ERRNO_CODES.EBADF);
      return -1;
    }
    try {
      var slab = HEAP8;
      return FS.read(stream, slab, buf, nbyte, offset);
    } catch (e) {
      FS.handleFSError(e);
      return -1;
    }
  }
  function _read(fildes, buf, nbyte) {
    var stream = FS.getStream(fildes);
    if (!stream) {
      ___setErrNo(ERRNO_CODES.EBADF);
      return -1;
    }
    try {
      var slab = HEAP8;
      return FS.read(stream, slab, buf, nbyte);
    } catch (e) {
      FS.handleFSError(e);
      return -1;
    }
  }
  function _fread(ptr, size, nitems, stream) {
    var bytesToRead = nitems * size;
    if (bytesToRead == 0) {
      return 0;
    }
    var bytesRead = 0;
    var streamObj = FS.getStreamFromPtr(stream);
    if (!streamObj) {
      ___setErrNo(ERRNO_CODES.EBADF);
      return 0;
    }
    while (streamObj.ungotten.length && bytesToRead > 0) {
      HEAP8[ptr++ >> 0] = streamObj.ungotten.pop();
      bytesToRead--;
      bytesRead++;
    }
    var err = _read(streamObj.fd, ptr, bytesToRead);
    if (err == -1) {
      if (streamObj)
        streamObj.error = true;
      return 0;
    }
    bytesRead += err;
    if (bytesRead < bytesToRead)
      streamObj.eof = true;
    return bytesRead / size | 0;
  }
  function _fgetc(stream) {
    var streamObj = FS.getStreamFromPtr(stream);
    if (!streamObj)
      return -1;
    if (streamObj.eof || streamObj.error)
      return -1;
    var ret = _fread(_fgetc.ret, 1, 1, stream);
    if (ret == 0) {
      return -1;
    } else if (ret == -1) {
      streamObj.error = true;
      return -1;
    } else {
      return HEAPU8[_fgetc.ret >> 0];
    }
  }
  Module["_memset"] = _memset;
  function _close(fildes) {
    var stream = FS.getStream(fildes);
    if (!stream) {
      ___setErrNo(ERRNO_CODES.EBADF);
      return -1;
    }
    try {
      FS.close(stream);
      return 0;
    } catch (e) {
      FS.handleFSError(e);
      return -1;
    }
  }
  function _fileno(stream) {
    stream = FS.getStreamFromPtr(stream);
    if (!stream)
      return -1;
    return stream.fd;
  }
  function _fclose(stream) {
    var fd = _fileno(stream);
    return _close(fd);
  }
  Module["_strlen"] = _strlen;
  Module["_strcat"] = _strcat;
  function _strerror_r(errnum, strerrbuf, buflen) {
    if (errnum in ERRNO_MESSAGES) {
      if (ERRNO_MESSAGES[errnum].length > buflen - 1) {
        return ___setErrNo(ERRNO_CODES.ERANGE);
      } else {
        var msg = ERRNO_MESSAGES[errnum];
        writeAsciiToMemory(msg, strerrbuf);
        return 0;
      }
    } else {
      return ___setErrNo(ERRNO_CODES.EINVAL);
    }
  }
  function _strerror(errnum) {
    if (!_strerror.buffer)
      _strerror.buffer = _malloc(256);
    _strerror_r(errnum, _strerror.buffer, 256);
    return _strerror.buffer;
  }
  Module["_bitshift64Shl"] = _bitshift64Shl;
  function _abort() {
    Module["abort"]();
  }
  function _send(fd, buf, len, flags) {
    var sock = SOCKFS.getSocket(fd);
    if (!sock) {
      ___setErrNo(ERRNO_CODES.EBADF);
      return -1;
    }
    return _write(fd, buf, len);
  }
  function _pwrite(fildes, buf, nbyte, offset) {
    var stream = FS.getStream(fildes);
    if (!stream) {
      ___setErrNo(ERRNO_CODES.EBADF);
      return -1;
    }
    try {
      var slab = HEAP8;
      return FS.write(stream, slab, buf, nbyte, offset);
    } catch (e) {
      FS.handleFSError(e);
      return -1;
    }
  }
  function _write(fildes, buf, nbyte) {
    var stream = FS.getStream(fildes);
    if (!stream) {
      ___setErrNo(ERRNO_CODES.EBADF);
      return -1;
    }
    try {
      var slab = HEAP8;
      return FS.write(stream, slab, buf, nbyte);
    } catch (e) {
      FS.handleFSError(e);
      return -1;
    }
  }
  function _fwrite(ptr, size, nitems, stream) {
    var bytesToWrite = nitems * size;
    if (bytesToWrite == 0)
      return 0;
    var fd = _fileno(stream);
    var bytesWritten = _write(fd, ptr, bytesToWrite);
    if (bytesWritten == -1) {
      var streamObj = FS.getStreamFromPtr(stream);
      if (streamObj)
        streamObj.error = true;
      return 0;
    } else {
      return bytesWritten / size | 0;
    }
  }
  function __reallyNegative(x) {
    return x < 0 || x === 0 && 1 / x === -Infinity;
  }
  function __formatString(format, varargs) {
    assert((varargs & 3) === 0);
    var textIndex = format;
    var argIndex = 0;
    function getNextArg(type) {
      var ret;
      argIndex = Runtime.prepVararg(argIndex, type);
      if (type === "double") {
        ret = (HEAP32[tempDoublePtr >> 2] = HEAP32[varargs + argIndex >> 2], HEAP32[tempDoublePtr + 4 >> 2] = HEAP32[varargs + (argIndex + 4) >> 2], +HEAPF64[tempDoublePtr >> 3]);
        argIndex += 8;
      } else if (type == "i64") {
        ret = [HEAP32[varargs + argIndex >> 2], HEAP32[varargs + (argIndex + 4) >> 2]];
        argIndex += 8;
      } else {
        assert((argIndex & 3) === 0);
        type = "i32";
        ret = HEAP32[varargs + argIndex >> 2];
        argIndex += 4;
      }
      return ret;
    }
    var ret = [];
    var curr,
        next,
        currArg;
    while (1) {
      var startTextIndex = textIndex;
      curr = HEAP8[textIndex >> 0];
      if (curr === 0)
        break;
      next = HEAP8[textIndex + 1 >> 0];
      if (curr == 37) {
        var flagAlwaysSigned = false;
        var flagLeftAlign = false;
        var flagAlternative = false;
        var flagZeroPad = false;
        var flagPadSign = false;
        flagsLoop: while (1) {
          switch (next) {
            case 43:
              flagAlwaysSigned = true;
              break;
            case 45:
              flagLeftAlign = true;
              break;
            case 35:
              flagAlternative = true;
              break;
            case 48:
              if (flagZeroPad) {
                break flagsLoop;
              } else {
                flagZeroPad = true;
                break;
              }
              ;
            case 32:
              flagPadSign = true;
              break;
            default:
              break flagsLoop;
          }
          textIndex++;
          next = HEAP8[textIndex + 1 >> 0];
        }
        var width = 0;
        if (next == 42) {
          width = getNextArg("i32");
          textIndex++;
          next = HEAP8[textIndex + 1 >> 0];
        } else {
          while (next >= 48 && next <= 57) {
            width = width * 10 + (next - 48);
            textIndex++;
            next = HEAP8[textIndex + 1 >> 0];
          }
        }
        var precisionSet = false,
            precision = -1;
        if (next == 46) {
          precision = 0;
          precisionSet = true;
          textIndex++;
          next = HEAP8[textIndex + 1 >> 0];
          if (next == 42) {
            precision = getNextArg("i32");
            textIndex++;
          } else {
            while (1) {
              var precisionChr = HEAP8[textIndex + 1 >> 0];
              if (precisionChr < 48 || precisionChr > 57)
                break;
              precision = precision * 10 + (precisionChr - 48);
              textIndex++;
            }
          }
          next = HEAP8[textIndex + 1 >> 0];
        }
        if (precision < 0) {
          precision = 6;
          precisionSet = false;
        }
        var argSize;
        switch (String.fromCharCode(next)) {
          case "h":
            var nextNext = HEAP8[textIndex + 2 >> 0];
            if (nextNext == 104) {
              textIndex++;
              argSize = 1;
            } else {
              argSize = 2;
            }
            break;
          case "l":
            var nextNext = HEAP8[textIndex + 2 >> 0];
            if (nextNext == 108) {
              textIndex++;
              argSize = 8;
            } else {
              argSize = 4;
            }
            break;
          case "L":
          case "q":
          case "j":
            argSize = 8;
            break;
          case "z":
          case "t":
          case "I":
            argSize = 4;
            break;
          default:
            argSize = null;
        }
        if (argSize)
          textIndex++;
        next = HEAP8[textIndex + 1 >> 0];
        switch (String.fromCharCode(next)) {
          case "d":
          case "i":
          case "u":
          case "o":
          case "x":
          case "X":
          case "p":
            {
              var signed = next == 100 || next == 105;
              argSize = argSize || 4;
              var currArg = getNextArg("i" + argSize * 8);
              var origArg = currArg;
              var argText;
              if (argSize == 8) {
                currArg = Runtime.makeBigInt(currArg[0], currArg[1], next == 117);
              }
              if (argSize <= 4) {
                var limit = Math.pow(256, argSize) - 1;
                currArg = (signed ? reSign : unSign)(currArg & limit, argSize * 8);
              }
              var currAbsArg = Math.abs(currArg);
              var prefix = "";
              if (next == 100 || next == 105) {
                if (argSize == 8 && i64Math)
                  argText = i64Math.stringify(origArg[0], origArg[1], null);
                else
                  argText = reSign(currArg, 8 * argSize, 1).toString(10);
              } else if (next == 117) {
                if (argSize == 8 && i64Math)
                  argText = i64Math.stringify(origArg[0], origArg[1], true);
                else
                  argText = unSign(currArg, 8 * argSize, 1).toString(10);
                currArg = Math.abs(currArg);
              } else if (next == 111) {
                argText = (flagAlternative ? "0" : "") + currAbsArg.toString(8);
              } else if (next == 120 || next == 88) {
                prefix = flagAlternative && currArg != 0 ? "0x" : "";
                if (argSize == 8 && i64Math) {
                  if (origArg[1]) {
                    argText = (origArg[1] >>> 0).toString(16);
                    var lower = (origArg[0] >>> 0).toString(16);
                    while (lower.length < 8)
                      lower = "0" + lower;
                    argText += lower;
                  } else {
                    argText = (origArg[0] >>> 0).toString(16);
                  }
                } else if (currArg < 0) {
                  currArg = -currArg;
                  argText = (currAbsArg - 1).toString(16);
                  var buffer = [];
                  for (var i = 0; i < argText.length; i++) {
                    buffer.push((15 - parseInt(argText[i], 16)).toString(16));
                  }
                  argText = buffer.join("");
                  while (argText.length < argSize * 2)
                    argText = "f" + argText;
                } else {
                  argText = currAbsArg.toString(16);
                }
                if (next == 88) {
                  prefix = prefix.toUpperCase();
                  argText = argText.toUpperCase();
                }
              } else if (next == 112) {
                if (currAbsArg === 0) {
                  argText = "(nil)";
                } else {
                  prefix = "0x";
                  argText = currAbsArg.toString(16);
                }
              }
              if (precisionSet) {
                while (argText.length < precision) {
                  argText = "0" + argText;
                }
              }
              if (currArg >= 0) {
                if (flagAlwaysSigned) {
                  prefix = "+" + prefix;
                } else if (flagPadSign) {
                  prefix = " " + prefix;
                }
              }
              if (argText.charAt(0) == "-") {
                prefix = "-" + prefix;
                argText = argText.substr(1);
              }
              while (prefix.length + argText.length < width) {
                if (flagLeftAlign) {
                  argText += " ";
                } else {
                  if (flagZeroPad) {
                    argText = "0" + argText;
                  } else {
                    prefix = " " + prefix;
                  }
                }
              }
              argText = prefix + argText;
              argText.split("").forEach((function(chr) {
                ret.push(chr.charCodeAt(0));
              }));
              break;
            }
            ;
          case "f":
          case "F":
          case "e":
          case "E":
          case "g":
          case "G":
            {
              var currArg = getNextArg("double");
              var argText;
              if (isNaN(currArg)) {
                argText = "nan";
                flagZeroPad = false;
              } else if (!isFinite(currArg)) {
                argText = (currArg < 0 ? "-" : "") + "inf";
                flagZeroPad = false;
              } else {
                var isGeneral = false;
                var effectivePrecision = Math.min(precision, 20);
                if (next == 103 || next == 71) {
                  isGeneral = true;
                  precision = precision || 1;
                  var exponent = parseInt(currArg.toExponential(effectivePrecision).split("e")[1], 10);
                  if (precision > exponent && exponent >= -4) {
                    next = (next == 103 ? "f" : "F").charCodeAt(0);
                    precision -= exponent + 1;
                  } else {
                    next = (next == 103 ? "e" : "E").charCodeAt(0);
                    precision--;
                  }
                  effectivePrecision = Math.min(precision, 20);
                }
                if (next == 101 || next == 69) {
                  argText = currArg.toExponential(effectivePrecision);
                  if (/[eE][-+]\d$/.test(argText)) {
                    argText = argText.slice(0, -1) + "0" + argText.slice(-1);
                  }
                } else if (next == 102 || next == 70) {
                  argText = currArg.toFixed(effectivePrecision);
                  if (currArg === 0 && __reallyNegative(currArg)) {
                    argText = "-" + argText;
                  }
                }
                var parts = argText.split("e");
                if (isGeneral && !flagAlternative) {
                  while (parts[0].length > 1 && parts[0].indexOf(".") != -1 && (parts[0].slice(-1) == "0" || parts[0].slice(-1) == ".")) {
                    parts[0] = parts[0].slice(0, -1);
                  }
                } else {
                  if (flagAlternative && argText.indexOf(".") == -1)
                    parts[0] += ".";
                  while (precision > effectivePrecision++)
                    parts[0] += "0";
                }
                argText = parts[0] + (parts.length > 1 ? "e" + parts[1] : "");
                if (next == 69)
                  argText = argText.toUpperCase();
                if (currArg >= 0) {
                  if (flagAlwaysSigned) {
                    argText = "+" + argText;
                  } else if (flagPadSign) {
                    argText = " " + argText;
                  }
                }
              }
              while (argText.length < width) {
                if (flagLeftAlign) {
                  argText += " ";
                } else {
                  if (flagZeroPad && (argText[0] == "-" || argText[0] == "+")) {
                    argText = argText[0] + "0" + argText.slice(1);
                  } else {
                    argText = (flagZeroPad ? "0" : " ") + argText;
                  }
                }
              }
              if (next < 97)
                argText = argText.toUpperCase();
              argText.split("").forEach((function(chr) {
                ret.push(chr.charCodeAt(0));
              }));
              break;
            }
            ;
          case "s":
            {
              var arg = getNextArg("i8*");
              var argLength = arg ? _strlen(arg) : "(null)".length;
              if (precisionSet)
                argLength = Math.min(argLength, precision);
              if (!flagLeftAlign) {
                while (argLength < width--) {
                  ret.push(32);
                }
              }
              if (arg) {
                for (var i = 0; i < argLength; i++) {
                  ret.push(HEAPU8[arg++ >> 0]);
                }
              } else {
                ret = ret.concat(intArrayFromString("(null)".substr(0, argLength), true));
              }
              if (flagLeftAlign) {
                while (argLength < width--) {
                  ret.push(32);
                }
              }
              break;
            }
            ;
          case "c":
            {
              if (flagLeftAlign)
                ret.push(getNextArg("i8"));
              while (--width > 0) {
                ret.push(32);
              }
              if (!flagLeftAlign)
                ret.push(getNextArg("i8"));
              break;
            }
            ;
          case "n":
            {
              var ptr = getNextArg("i32*");
              HEAP32[ptr >> 2] = ret.length;
              break;
            }
            ;
          case "%":
            {
              ret.push(curr);
              break;
            }
            ;
          default:
            {
              for (var i = startTextIndex; i < textIndex + 2; i++) {
                ret.push(HEAP8[i >> 0]);
              }
            }
        }
        textIndex += 2;
      } else {
        ret.push(curr);
        textIndex += 1;
      }
    }
    return ret;
  }
  function _fprintf(stream, format, varargs) {
    var result = __formatString(format, varargs);
    var stack = Runtime.stackSave();
    var ret = _fwrite(allocate(result, "i8", ALLOC_STACK), 1, result.length, stream);
    Runtime.stackRestore(stack);
    return ret;
  }
  function _free() {}
  Module["_free"] = _free;
  function _malloc(bytes) {
    var ptr = Runtime.dynamicAlloc(bytes + 8);
    return ptr + 8 & 4294967288;
  }
  Module["_malloc"] = _malloc;
  function embind_init_charCodes() {
    var codes = new Array(256);
    for (var i = 0; i < 256; ++i) {
      codes[i] = String.fromCharCode(i);
    }
    embind_charCodes = codes;
  }
  var embind_charCodes = undefined;
  function readLatin1String(ptr) {
    var ret = "";
    var c = ptr;
    while (HEAPU8[c]) {
      ret += embind_charCodes[HEAPU8[c++]];
    }
    return ret;
  }
  var awaitingDependencies = {};
  var registeredTypes = {};
  var typeDependencies = {};
  var char_0 = 48;
  var char_9 = 57;
  function makeLegalFunctionName(name) {
    if (undefined === name) {
      return "_unknown";
    }
    name = name.replace(/[^a-zA-Z0-9_]/g, "$");
    var f = name.charCodeAt(0);
    if (f >= char_0 && f <= char_9) {
      return "_" + name;
    } else {
      return name;
    }
  }
  function createNamedFunction(name, body) {
    name = makeLegalFunctionName(name);
    return (new Function("body", "return function " + name + "() {\n" + '    "use strict";' + "    return body.apply(this, arguments);\n" + "};\n"))(body);
  }
  function extendError(baseErrorType, errorName) {
    var errorClass = createNamedFunction(errorName, (function(message) {
      this.name = errorName;
      this.message = message;
      var stack = (new Error(message)).stack;
      if (stack !== undefined) {
        this.stack = this.toString() + "\n" + stack.replace(/^Error(:[^\n]*)?\n/, "");
      }
    }));
    errorClass.prototype = Object.create(baseErrorType.prototype);
    errorClass.prototype.constructor = errorClass;
    errorClass.prototype.toString = (function() {
      if (this.message === undefined) {
        return this.name;
      } else {
        return this.name + ": " + this.message;
      }
    });
    return errorClass;
  }
  var BindingError = undefined;
  function throwBindingError(message) {
    throw new BindingError(message);
  }
  var InternalError = undefined;
  function throwInternalError(message) {
    throw new InternalError(message);
  }
  function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
    myTypes.forEach((function(type) {
      typeDependencies[type] = dependentTypes;
    }));
    function onComplete(typeConverters) {
      var myTypeConverters = getTypeConverters(typeConverters);
      if (myTypeConverters.length !== myTypes.length) {
        throwInternalError("Mismatched type converter count");
      }
      for (var i = 0; i < myTypes.length; ++i) {
        registerType(myTypes[i], myTypeConverters[i]);
      }
    }
    var typeConverters = new Array(dependentTypes.length);
    var unregisteredTypes = [];
    var registered = 0;
    dependentTypes.forEach((function(dt, i) {
      if (registeredTypes.hasOwnProperty(dt)) {
        typeConverters[i] = registeredTypes[dt];
      } else {
        unregisteredTypes.push(dt);
        if (!awaitingDependencies.hasOwnProperty(dt)) {
          awaitingDependencies[dt] = [];
        }
        awaitingDependencies[dt].push((function() {
          typeConverters[i] = registeredTypes[dt];
          ++registered;
          if (registered === unregisteredTypes.length) {
            onComplete(typeConverters);
          }
        }));
      }
    }));
    if (0 === unregisteredTypes.length) {
      onComplete(typeConverters);
    }
  }
  function registerType(rawType, registeredInstance, options) {
    options = options || {};
    if (!("argPackAdvance" in registeredInstance)) {
      throw new TypeError("registerType registeredInstance requires argPackAdvance");
    }
    var name = registeredInstance.name;
    if (!rawType) {
      throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
    }
    if (registeredTypes.hasOwnProperty(rawType)) {
      if (options.ignoreDuplicateRegistrations) {
        return ;
      } else {
        throwBindingError("Cannot register type '" + name + "' twice");
      }
    }
    registeredTypes[rawType] = registeredInstance;
    delete typeDependencies[rawType];
    if (awaitingDependencies.hasOwnProperty(rawType)) {
      var callbacks = awaitingDependencies[rawType];
      delete awaitingDependencies[rawType];
      callbacks.forEach((function(cb) {
        cb();
      }));
    }
  }
  function simpleReadValueFromPointer(pointer) {
    return this["fromWireType"](HEAPU32[pointer >> 2]);
  }
  function __embind_register_std_string(rawType, name) {
    name = readLatin1String(name);
    registerType(rawType, {
      name: name,
      "fromWireType": (function(value) {
        var length = HEAPU32[value >> 2];
        var a = new Array(length);
        for (var i = 0; i < length; ++i) {
          a[i] = String.fromCharCode(HEAPU8[value + 4 + i]);
        }
        _free(value);
        return a.join("");
      }),
      "toWireType": (function(destructors, value) {
        if (value instanceof ArrayBuffer) {
          value = new Uint8Array(value);
        }
        function getTAElement(ta, index) {
          return ta[index];
        }
        function getStringElement(string, index) {
          return string.charCodeAt(index);
        }
        var getElement;
        if (value instanceof Uint8Array) {
          getElement = getTAElement;
        } else if (value instanceof Int8Array) {
          getElement = getTAElement;
        } else if (typeof value === "string") {
          getElement = getStringElement;
        } else {
          throwBindingError("Cannot pass non-string to std::string");
        }
        var length = value.length;
        var ptr = _malloc(4 + length);
        HEAPU32[ptr >> 2] = length;
        for (var i = 0; i < length; ++i) {
          var charCode = getElement(value, i);
          if (charCode > 255) {
            _free(ptr);
            throwBindingError("String has UTF-16 code units that do not fit in 8 bits");
          }
          HEAPU8[ptr + 4 + i] = charCode;
        }
        if (destructors !== null) {
          destructors.push(_free, ptr);
        }
        return ptr;
      }),
      "argPackAdvance": 8,
      "readValueFromPointer": simpleReadValueFromPointer,
      destructorFunction: (function(ptr) {
        _free(ptr);
      })
    });
  }
  function _printf(format, varargs) {
    var stdout = HEAP32[_stdout >> 2];
    return _fprintf(stdout, format, varargs);
  }
  function _open(path, oflag, varargs) {
    var mode = HEAP32[varargs >> 2];
    path = Pointer_stringify(path);
    try {
      var stream = FS.open(path, oflag, mode);
      return stream.fd;
    } catch (e) {
      FS.handleFSError(e);
      return -1;
    }
  }
  function _fopen(filename, mode) {
    var flags;
    mode = Pointer_stringify(mode);
    if (mode[0] == "r") {
      if (mode.indexOf("+") != -1) {
        flags = 2;
      } else {
        flags = 0;
      }
    } else if (mode[0] == "w") {
      if (mode.indexOf("+") != -1) {
        flags = 2;
      } else {
        flags = 1;
      }
      flags |= 64;
      flags |= 512;
    } else if (mode[0] == "a") {
      if (mode.indexOf("+") != -1) {
        flags = 2;
      } else {
        flags = 1;
      }
      flags |= 64;
      flags |= 1024;
    } else {
      ___setErrNo(ERRNO_CODES.EINVAL);
      return 0;
    }
    var fd = _open(filename, flags, allocate([511, 0, 0, 0], "i32", ALLOC_STACK));
    return fd === -1 ? 0 : FS.getPtrForStream(FS.getStream(fd));
  }
  function _environment(cmd, _data) {
    var str,
        buffer;
    switch (cmd) {
      case Module.ENVIRONMENT_SET_ROTATION:
        return Module.environment(cmd, Module.getValue(_data, "i32"));
      case Module.ENVIRONMENT_GET_OVERSCAN:
        Module.setValue(_data, Module.environment(cmd), "i32");
        return true;
      case Module.ENVIRONMENT_GET_CAN_DUPE:
        Module.setValue(_data, Module.environment(cmd), "i8");
        return true;
      case Module.ENVIRONMENT_SHUTDOWN:
        return Module.environment(cmd);
      case Module.ENVIRONMENT_SET_PERFORMANCE_LEVEL:
        return Module.environment(cmd, Module.getValue(_data, "i32"));
      case Module.ENVIRONMENT_GET_SYSTEM_DIRECTORY:
        str = Module.environment(cmd);
        buffer = Module._malloc(str.length + 1);
        Module.writeStringToMemory(str, buffer);
        Module.setValue(_data, buffer, "*");
        return true;
      case Module.ENVIRONMENT_SET_PIXEL_FORMAT:
        return Module.environment(cmd, Module.getValue(_data, "i32"));
      case Module.ENVIRONMENT_GET_VARIABLE_UPDATE:
        Module.setValue(_data, Module.environment(cmd), "i8");
        return true;
      case Module.ENVIRONMENT_SET_SUPPORT_NO_GAME:
        return Module.environment(cmd, Module.getValue(_data, "i8"));
      case Module.ENVIRONMENT_GET_LIBPATH:
        str = Module.environment(cmd);
        buffer = Module._malloc(str.length + 1);
        Module.writeStringToMemory(str, buffer);
        Module.setValue(_data, buffer, "*");
        return true;
      case Module.ENVIRONMENT_GET_INPUT_DEVICE_CAPABILITIES:
        Module.setValue(_data, Module.environment(cmd), "i64");
        return true;
      case Module.ENVIRONMENT_GET_LOG_INTERFACE:
        Module.setValue(_data, Runtime.addFunction(Module.environment(cmd)), "*");
        return true;
      case Module.ENVIRONMENT_GET_CORE_ASSETS_DIRECTORY:
        str = Module.environment(cmd);
        buffer = Module._malloc(str.length + 1);
        Module.writeStringToMemory(str, buffer);
        Module.setValue(_data, buffer, "*");
        return true;
      case Module.ENVIRONMENT_GET_SAVE_DIRECTORY:
        str = Module.environment(cmd);
        buffer = Module._malloc(str.length + 1);
        Module.writeStringToMemory(str, buffer);
        Module.setValue(_data, buffer, "*");
        return true;
      case Module.ENVIRONMENT_SET_GEOMETRY:
        return Module.environment(cmd, {
          base_width: Module.getValue(_data, "i32"),
          base_height: Module.getValue(_data + 4, "i32"),
          max_width: Module.getValue(_data + 8, "i32"),
          max_height: Module.getValue(_data + 12, "i32"),
          aspect_ratio: Module.getValue(_data + 16, "float")
        });
      case Module.ENVIRONMENT_GET_USERNAME:
        str = Module.environment(cmd);
        buffer = Module._malloc(str.length + 1);
        Module.writeStringToMemory(str, buffer);
        Module.setValue(_data, buffer, "*");
        return true;
      case Module.ENVIRONMENT_GET_LANGUAGE:
        Module.setValue(_data, Module.environment(cmd), "i32");
        return true;
      default:
        return Module.environment(cmd, _data);
    }
  }
  Module["_i64Add"] = _i64Add;
  function _fputs(s, stream) {
    var fd = _fileno(stream);
    return _write(fd, s, _strlen(s));
  }
  function _fputc(c, stream) {
    var chr = unSign(c & 255);
    HEAP8[_fputc.ret >> 0] = chr;
    var fd = _fileno(stream);
    var ret = _write(fd, _fputc.ret, 1);
    if (ret == -1) {
      var streamObj = FS.getStreamFromPtr(stream);
      if (streamObj)
        streamObj.error = true;
      return -1;
    } else {
      return chr;
    }
  }
  function _puts(s) {
    var stdout = HEAP32[_stdout >> 2];
    var ret = _fputs(s, stdout);
    if (ret < 0) {
      return ret;
    } else {
      var newlineRet = _fputc(10, stdout);
      return newlineRet < 0 ? -1 : ret + 1;
    }
  }
  function _lseek(fildes, offset, whence) {
    var stream = FS.getStream(fildes);
    if (!stream) {
      ___setErrNo(ERRNO_CODES.EBADF);
      return -1;
    }
    try {
      return FS.llseek(stream, offset, whence);
    } catch (e) {
      FS.handleFSError(e);
      return -1;
    }
  }
  function _fseek(stream, offset, whence) {
    var fd = _fileno(stream);
    var ret = _lseek(fd, offset, whence);
    if (ret == -1) {
      return -1;
    }
    stream = FS.getStreamFromPtr(stream);
    stream.eof = false;
    return 0;
  }
  function _input_poll() {
    Module.input_poll();
  }
  function _embind_repr(v) {
    if (v === null) {
      return "null";
    }
    var t = typeof v;
    if (t === "object" || t === "array" || t === "function") {
      return v.toString();
    } else {
      return "" + v;
    }
  }
  function getShiftFromSize(size) {
    switch (size) {
      case 1:
        return 0;
      case 2:
        return 1;
      case 4:
        return 2;
      case 8:
        return 3;
      default:
        throw new TypeError("Unknown type size: " + size);
    }
  }
  function integerReadValueFromPointer(name, shift, signed) {
    switch (shift) {
      case 0:
        return signed ? function readS8FromPointer(pointer) {
          return HEAP8[pointer];
        } : function readU8FromPointer(pointer) {
          return HEAPU8[pointer];
        };
      case 1:
        return signed ? function readS16FromPointer(pointer) {
          return HEAP16[pointer >> 1];
        } : function readU16FromPointer(pointer) {
          return HEAPU16[pointer >> 1];
        };
      case 2:
        return signed ? function readS32FromPointer(pointer) {
          return HEAP32[pointer >> 2];
        } : function readU32FromPointer(pointer) {
          return HEAPU32[pointer >> 2];
        };
      default:
        throw new TypeError("Unknown integer type: " + name);
    }
  }
  function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
    name = readLatin1String(name);
    if (maxRange === -1) {
      maxRange = 4294967295;
    }
    var shift = getShiftFromSize(size);
    var fromWireType = (function(value) {
      return value;
    });
    if (minRange === 0) {
      var bitshift = 32 - 8 * size;
      fromWireType = (function(value) {
        return value << bitshift >>> bitshift;
      });
    }
    registerType(primitiveType, {
      name: name,
      "fromWireType": fromWireType,
      "toWireType": (function(destructors, value) {
        if (typeof value !== "number" && typeof value !== "boolean") {
          throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
        }
        if (value < minRange || value > maxRange) {
          throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ", " + maxRange + "]!");
        }
        return value | 0;
      }),
      "argPackAdvance": 8,
      "readValueFromPointer": integerReadValueFromPointer(name, shift, minRange !== 0),
      destructorFunction: null
    });
  }
  function __embind_register_void(rawType, name) {
    name = readLatin1String(name);
    registerType(rawType, {
      isVoid: true,
      name: name,
      "argPackAdvance": 0,
      "fromWireType": (function() {
        return undefined;
      }),
      "toWireType": (function(destructors, o) {
        return undefined;
      })
    });
  }
  function _ftell(stream) {
    stream = FS.getStreamFromPtr(stream);
    if (!stream) {
      ___setErrNo(ERRNO_CODES.EBADF);
      return -1;
    }
    if (FS.isChrdev(stream.node.mode)) {
      ___setErrNo(ERRNO_CODES.ESPIPE);
      return -1;
    } else {
      return stream.position;
    }
  }
  function _audio_sample(left, right) {
    return Module.audio_sample(left, right);
  }
  function _emscripten_set_main_loop_timing(mode, value) {
    Browser.mainLoop.timingMode = mode;
    Browser.mainLoop.timingValue = value;
    if (!Browser.mainLoop.func) {
      return 1;
    }
    if (mode == 0) {
      Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler() {
        setTimeout(Browser.mainLoop.runner, value);
      };
      Browser.mainLoop.method = "timeout";
    } else if (mode == 1) {
      Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler() {
        Browser.requestAnimationFrame(Browser.mainLoop.runner);
      };
      Browser.mainLoop.method = "rAF";
    }
    return 0;
  }
  function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
    Module["noExitRuntime"] = true;
    assert(!Browser.mainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
    Browser.mainLoop.func = func;
    Browser.mainLoop.arg = arg;
    var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
    Browser.mainLoop.runner = function Browser_mainLoop_runner() {
      if (ABORT)
        return ;
      if (Browser.mainLoop.queue.length > 0) {
        var start = Date.now();
        var blocker = Browser.mainLoop.queue.shift();
        blocker.func(blocker.arg);
        if (Browser.mainLoop.remainingBlockers) {
          var remaining = Browser.mainLoop.remainingBlockers;
          var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
          if (blocker.counted) {
            Browser.mainLoop.remainingBlockers = next;
          } else {
            next = next + .5;
            Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9;
          }
        }
        console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + " ms");
        Browser.mainLoop.updateStatus();
        setTimeout(Browser.mainLoop.runner, 0);
        return ;
      }
      if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop)
        return ;
      Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
      if (Browser.mainLoop.timingMode == 1 && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
        Browser.mainLoop.scheduler();
        return ;
      }
      if (Browser.mainLoop.method === "timeout" && Module.ctx) {
        Module.printErr("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");
        Browser.mainLoop.method = "";
      }
      Browser.mainLoop.runIter((function() {
        if (typeof arg !== "undefined") {
          Runtime.dynCall("vi", func, [arg]);
        } else {
          Runtime.dynCall("v", func);
        }
      }));
      if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop)
        return ;
      if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData)
        SDL.audio.queueNewAudioData();
      Browser.mainLoop.scheduler();
    };
    if (!noSetTiming) {
      if (fps && fps > 0)
        _emscripten_set_main_loop_timing(0, 1e3 / fps);
      else
        _emscripten_set_main_loop_timing(1, 1);
      Browser.mainLoop.scheduler();
    }
    if (simulateInfiniteLoop) {
      throw "SimulateInfiniteLoop";
    }
  }
  var Browser = {
    mainLoop: {
      scheduler: null,
      method: "",
      currentlyRunningMainloop: 0,
      func: null,
      arg: 0,
      timingMode: 0,
      timingValue: 0,
      currentFrameNumber: 0,
      queue: [],
      pause: (function() {
        Browser.mainLoop.scheduler = null;
        Browser.mainLoop.currentlyRunningMainloop++;
      }),
      resume: (function() {
        Browser.mainLoop.currentlyRunningMainloop++;
        var timingMode = Browser.mainLoop.timingMode;
        var timingValue = Browser.mainLoop.timingValue;
        var func = Browser.mainLoop.func;
        Browser.mainLoop.func = null;
        _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true);
        _emscripten_set_main_loop_timing(timingMode, timingValue);
        Browser.mainLoop.scheduler();
      }),
      updateStatus: (function() {
        if (Module["setStatus"]) {
          var message = Module["statusMessage"] || "Please wait...";
          var remaining = Browser.mainLoop.remainingBlockers;
          var expected = Browser.mainLoop.expectedBlockers;
          if (remaining) {
            if (remaining < expected) {
              Module["setStatus"](message + " (" + (expected - remaining) + "/" + expected + ")");
            } else {
              Module["setStatus"](message);
            }
          } else {
            Module["setStatus"]("");
          }
        }
      }),
      runIter: (function(func) {
        if (ABORT)
          return ;
        if (Module["preMainLoop"]) {
          var preRet = Module["preMainLoop"]();
          if (preRet === false) {
            return ;
          }
        }
        try {
          func();
        } catch (e) {
          if (e instanceof ExitStatus) {
            return ;
          } else {
            if (e && typeof e === "object" && e.stack)
              Module.printErr("exception thrown: " + [e, e.stack]);
            throw e;
          }
        }
        if (Module["postMainLoop"])
          Module["postMainLoop"]();
      })
    },
    isFullScreen: false,
    pointerLock: false,
    moduleContextCreatedCallbacks: [],
    workers: [],
    init: (function() {
      if (!Module["preloadPlugins"])
        Module["preloadPlugins"] = [];
      if (Browser.initted)
        return ;
      Browser.initted = true;
      try {
        new Blob;
        Browser.hasBlobConstructor = true;
      } catch (e) {
        Browser.hasBlobConstructor = false;
        console.log("warning: no blob constructor, cannot create blobs with mimetypes");
      }
      Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : !Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null;
      Browser.URLObject = typeof window != "undefined" ? window.URL ? window.URL : window.webkitURL : undefined;
      if (!Module.noImageDecoding && typeof Browser.URLObject === "undefined") {
        console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
        Module.noImageDecoding = true;
      }
      var imagePlugin = {};
      imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
        return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
      };
      imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
        var b = null;
        if (Browser.hasBlobConstructor) {
          try {
            b = new Blob([byteArray], {type: Browser.getMimetype(name)});
            if (b.size !== byteArray.length) {
              b = new Blob([(new Uint8Array(byteArray)).buffer], {type: Browser.getMimetype(name)});
            }
          } catch (e) {
            Runtime.warnOnce("Blob constructor present but fails: " + e + "; falling back to blob builder");
          }
        }
        if (!b) {
          var bb = new Browser.BlobBuilder;
          bb.append((new Uint8Array(byteArray)).buffer);
          b = bb.getBlob();
        }
        var url = Browser.URLObject.createObjectURL(b);
        var img = new Image;
        img.onload = function img_onload() {
          assert(img.complete, "Image " + name + " could not be decoded");
          var canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          Module["preloadedImages"][name] = canvas;
          Browser.URLObject.revokeObjectURL(url);
          if (onload)
            onload(byteArray);
        };
        img.onerror = function img_onerror(event) {
          console.log("Image " + url + " could not be decoded");
          if (onerror)
            onerror();
        };
        img.src = url;
      };
      Module["preloadPlugins"].push(imagePlugin);
      var audioPlugin = {};
      audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
        return !Module.noAudioDecoding && name.substr(-4) in {
          ".ogg": 1,
          ".wav": 1,
          ".mp3": 1
        };
      };
      audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
        var done = false;
        function finish(audio) {
          if (done)
            return ;
          done = true;
          Module["preloadedAudios"][name] = audio;
          if (onload)
            onload(byteArray);
        }
        function fail() {
          if (done)
            return ;
          done = true;
          Module["preloadedAudios"][name] = new Audio;
          if (onerror)
            onerror();
        }
        if (Browser.hasBlobConstructor) {
          try {
            var b = new Blob([byteArray], {type: Browser.getMimetype(name)});
          } catch (e) {
            return fail();
          }
          var url = Browser.URLObject.createObjectURL(b);
          var audio = new Audio;
          audio.addEventListener("canplaythrough", (function() {
            finish(audio);
          }), false);
          audio.onerror = function audio_onerror(event) {
            if (done)
              return ;
            console.log("warning: browser could not fully decode audio " + name + ", trying slower base64 approach");
            function encode64(data) {
              var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
              var PAD = "=";
              var ret = "";
              var leftchar = 0;
              var leftbits = 0;
              for (var i = 0; i < data.length; i++) {
                leftchar = leftchar << 8 | data[i];
                leftbits += 8;
                while (leftbits >= 6) {
                  var curr = leftchar >> leftbits - 6 & 63;
                  leftbits -= 6;
                  ret += BASE[curr];
                }
              }
              if (leftbits == 2) {
                ret += BASE[(leftchar & 3) << 4];
                ret += PAD + PAD;
              } else if (leftbits == 4) {
                ret += BASE[(leftchar & 15) << 2];
                ret += PAD;
              }
              return ret;
            }
            audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
            finish(audio);
          };
          audio.src = url;
          Browser.safeSetTimeout((function() {
            finish(audio);
          }), 1e4);
        } else {
          return fail();
        }
      };
      Module["preloadPlugins"].push(audioPlugin);
      var canvas = Module["canvas"];
      function pointerLockChange() {
        Browser.pointerLock = document["pointerLockElement"] === canvas || document["mozPointerLockElement"] === canvas || document["webkitPointerLockElement"] === canvas || document["msPointerLockElement"] === canvas;
      }
      if (canvas) {
        canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || (function() {});
        canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || (function() {});
        canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
        document.addEventListener("pointerlockchange", pointerLockChange, false);
        document.addEventListener("mozpointerlockchange", pointerLockChange, false);
        document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
        document.addEventListener("mspointerlockchange", pointerLockChange, false);
        if (Module["elementPointerLock"]) {
          canvas.addEventListener("click", (function(ev) {
            if (!Browser.pointerLock && canvas.requestPointerLock) {
              canvas.requestPointerLock();
              ev.preventDefault();
            }
          }), false);
        }
      }
    }),
    createContext: (function(canvas, useWebGL, setInModule, webGLContextAttributes) {
      if (useWebGL && Module.ctx && canvas == Module.canvas)
        return Module.ctx;
      var ctx;
      var contextHandle;
      if (useWebGL) {
        var contextAttributes = {
          antialias: false,
          alpha: false
        };
        if (webGLContextAttributes) {
          for (var attribute in webGLContextAttributes) {
            contextAttributes[attribute] = webGLContextAttributes[attribute];
          }
        }
        contextHandle = GL.createContext(canvas, contextAttributes);
        if (contextHandle) {
          ctx = GL.getContext(contextHandle).GLctx;
        }
        canvas.style.backgroundColor = "black";
      } else {
        ctx = canvas.getContext("2d");
      }
      if (!ctx)
        return null;
      if (setInModule) {
        if (!useWebGL)
          assert(typeof GLctx === "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
        Module.ctx = ctx;
        if (useWebGL)
          GL.makeContextCurrent(contextHandle);
        Module.useWebGL = useWebGL;
        Browser.moduleContextCreatedCallbacks.forEach((function(callback) {
          callback();
        }));
        Browser.init();
      }
      return ctx;
    }),
    destroyContext: (function(canvas, useWebGL, setInModule) {}),
    fullScreenHandlersInstalled: false,
    lockPointer: undefined,
    resizeCanvas: undefined,
    requestFullScreen: (function(lockPointer, resizeCanvas, vrDevice) {
      Browser.lockPointer = lockPointer;
      Browser.resizeCanvas = resizeCanvas;
      Browser.vrDevice = vrDevice;
      if (typeof Browser.lockPointer === "undefined")
        Browser.lockPointer = true;
      if (typeof Browser.resizeCanvas === "undefined")
        Browser.resizeCanvas = false;
      if (typeof Browser.vrDevice === "undefined")
        Browser.vrDevice = null;
      var canvas = Module["canvas"];
      function fullScreenChange() {
        Browser.isFullScreen = false;
        var canvasContainer = canvas.parentNode;
        if ((document["webkitFullScreenElement"] || document["webkitFullscreenElement"] || document["mozFullScreenElement"] || document["mozFullscreenElement"] || document["fullScreenElement"] || document["fullscreenElement"] || document["msFullScreenElement"] || document["msFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
          canvas.cancelFullScreen = document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["webkitCancelFullScreen"] || document["msExitFullscreen"] || document["exitFullscreen"] || (function() {});
          canvas.cancelFullScreen = canvas.cancelFullScreen.bind(document);
          if (Browser.lockPointer)
            canvas.requestPointerLock();
          Browser.isFullScreen = true;
          if (Browser.resizeCanvas)
            Browser.setFullScreenCanvasSize();
        } else {
          canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
          canvasContainer.parentNode.removeChild(canvasContainer);
          if (Browser.resizeCanvas)
            Browser.setWindowedCanvasSize();
        }
        if (Module["onFullScreen"])
          Module["onFullScreen"](Browser.isFullScreen);
        Browser.updateCanvasDimensions(canvas);
      }
      if (!Browser.fullScreenHandlersInstalled) {
        Browser.fullScreenHandlersInstalled = true;
        document.addEventListener("fullscreenchange", fullScreenChange, false);
        document.addEventListener("mozfullscreenchange", fullScreenChange, false);
        document.addEventListener("webkitfullscreenchange", fullScreenChange, false);
        document.addEventListener("MSFullscreenChange", fullScreenChange, false);
      }
      var canvasContainer = document.createElement("div");
      canvas.parentNode.insertBefore(canvasContainer, canvas);
      canvasContainer.appendChild(canvas);
      canvasContainer.requestFullScreen = canvasContainer["requestFullScreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullScreen"] ? (function() {
        canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]);
      }) : null);
      if (vrDevice) {
        canvasContainer.requestFullScreen({vrDisplay: vrDevice});
      } else {
        canvasContainer.requestFullScreen();
      }
    }),
    nextRAF: 0,
    fakeRequestAnimationFrame: (function(func) {
      var now = Date.now();
      if (Browser.nextRAF === 0) {
        Browser.nextRAF = now + 1e3 / 60;
      } else {
        while (now + 2 >= Browser.nextRAF) {
          Browser.nextRAF += 1e3 / 60;
        }
      }
      var delay = Math.max(Browser.nextRAF - now, 0);
      setTimeout(func, delay);
    }),
    requestAnimationFrame: function requestAnimationFrame(func) {
      if (typeof window === "undefined") {
        Browser.fakeRequestAnimationFrame(func);
      } else {
        if (!window.requestAnimationFrame) {
          window.requestAnimationFrame = window["requestAnimationFrame"] || window["mozRequestAnimationFrame"] || window["webkitRequestAnimationFrame"] || window["msRequestAnimationFrame"] || window["oRequestAnimationFrame"] || Browser.fakeRequestAnimationFrame;
        }
        window.requestAnimationFrame(func);
      }
    },
    safeCallback: (function(func) {
      return (function() {
        if (!ABORT)
          return func.apply(null, arguments);
      });
    }),
    allowAsyncCallbacks: true,
    queuedAsyncCallbacks: [],
    pauseAsyncCallbacks: (function() {
      Browser.allowAsyncCallbacks = false;
    }),
    resumeAsyncCallbacks: (function() {
      Browser.allowAsyncCallbacks = true;
      if (Browser.queuedAsyncCallbacks.length > 0) {
        var callbacks = Browser.queuedAsyncCallbacks;
        Browser.queuedAsyncCallbacks = [];
        callbacks.forEach((function(func) {
          func();
        }));
      }
    }),
    safeRequestAnimationFrame: (function(func) {
      return Browser.requestAnimationFrame((function() {
        if (ABORT)
          return ;
        if (Browser.allowAsyncCallbacks) {
          func();
        } else {
          Browser.queuedAsyncCallbacks.push(func);
        }
      }));
    }),
    safeSetTimeout: (function(func, timeout) {
      Module["noExitRuntime"] = true;
      return setTimeout((function() {
        if (ABORT)
          return ;
        if (Browser.allowAsyncCallbacks) {
          func();
        } else {
          Browser.queuedAsyncCallbacks.push(func);
        }
      }), timeout);
    }),
    safeSetInterval: (function(func, timeout) {
      Module["noExitRuntime"] = true;
      return setInterval((function() {
        if (ABORT)
          return ;
        if (Browser.allowAsyncCallbacks) {
          func();
        }
      }), timeout);
    }),
    getMimetype: (function(name) {
      return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "bmp": "image/bmp",
        "ogg": "audio/ogg",
        "wav": "audio/wav",
        "mp3": "audio/mpeg"
      }[name.substr(name.lastIndexOf(".") + 1)];
    }),
    getUserMedia: (function(func) {
      if (!window.getUserMedia) {
        window.getUserMedia = navigator["getUserMedia"] || navigator["mozGetUserMedia"];
      }
      window.getUserMedia(func);
    }),
    getMovementX: (function(event) {
      return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0;
    }),
    getMovementY: (function(event) {
      return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0;
    }),
    getMouseWheelDelta: (function(event) {
      var delta = 0;
      switch (event.type) {
        case "DOMMouseScroll":
          delta = event.detail;
          break;
        case "mousewheel":
          delta = event.wheelDelta;
          break;
        case "wheel":
          delta = event["deltaY"];
          break;
        default:
          throw "unrecognized mouse wheel event: " + event.type;
      }
      return delta;
    }),
    mouseX: 0,
    mouseY: 0,
    mouseMovementX: 0,
    mouseMovementY: 0,
    touches: {},
    lastTouches: {},
    calculateMouseEvent: (function(event) {
      if (Browser.pointerLock) {
        if (event.type != "mousemove" && "mozMovementX" in event) {
          Browser.mouseMovementX = Browser.mouseMovementY = 0;
        } else {
          Browser.mouseMovementX = Browser.getMovementX(event);
          Browser.mouseMovementY = Browser.getMovementY(event);
        }
        if (typeof SDL != "undefined") {
          Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
          Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
        } else {
          Browser.mouseX += Browser.mouseMovementX;
          Browser.mouseY += Browser.mouseMovementY;
        }
      } else {
        var rect = Module["canvas"].getBoundingClientRect();
        var cw = Module["canvas"].width;
        var ch = Module["canvas"].height;
        var scrollX = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
        var scrollY = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
        if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
          var touch = event.touch;
          if (touch === undefined) {
            return ;
          }
          var adjustedX = touch.pageX - (scrollX + rect.left);
          var adjustedY = touch.pageY - (scrollY + rect.top);
          adjustedX = adjustedX * (cw / rect.width);
          adjustedY = adjustedY * (ch / rect.height);
          var coords = {
            x: adjustedX,
            y: adjustedY
          };
          if (event.type === "touchstart") {
            Browser.lastTouches[touch.identifier] = coords;
            Browser.touches[touch.identifier] = coords;
          } else if (event.type === "touchend" || event.type === "touchmove") {
            var last = Browser.touches[touch.identifier];
            if (!last)
              last = coords;
            Browser.lastTouches[touch.identifier] = last;
            Browser.touches[touch.identifier] = coords;
          }
          return ;
        }
        var x = event.pageX - (scrollX + rect.left);
        var y = event.pageY - (scrollY + rect.top);
        x = x * (cw / rect.width);
        y = y * (ch / rect.height);
        Browser.mouseMovementX = x - Browser.mouseX;
        Browser.mouseMovementY = y - Browser.mouseY;
        Browser.mouseX = x;
        Browser.mouseY = y;
      }
    }),
    xhrLoad: (function(url, onload, onerror) {
      var xhr = new XMLHttpRequest;
      xhr.open("GET", url, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = function xhr_onload() {
        if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
          onload(xhr.response);
        } else {
          onerror();
        }
      };
      xhr.onerror = onerror;
      xhr.send(null);
    }),
    asyncLoad: (function(url, onload, onerror, noRunDep) {
      Browser.xhrLoad(url, (function(arrayBuffer) {
        assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
        onload(new Uint8Array(arrayBuffer));
        if (!noRunDep)
          removeRunDependency("al " + url);
      }), (function(event) {
        if (onerror) {
          onerror();
        } else {
          throw 'Loading data file "' + url + '" failed.';
        }
      }));
      if (!noRunDep)
        addRunDependency("al " + url);
    }),
    resizeListeners: [],
    updateResizeListeners: (function() {
      var canvas = Module["canvas"];
      Browser.resizeListeners.forEach((function(listener) {
        listener(canvas.width, canvas.height);
      }));
    }),
    setCanvasSize: (function(width, height, noUpdates) {
      var canvas = Module["canvas"];
      Browser.updateCanvasDimensions(canvas, width, height);
      if (!noUpdates)
        Browser.updateResizeListeners();
    }),
    windowedWidth: 0,
    windowedHeight: 0,
    setFullScreenCanvasSize: (function() {
      if (typeof SDL != "undefined") {
        var flags = HEAPU32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2];
        flags = flags | 8388608;
        HEAP32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2] = flags;
      }
      Browser.updateResizeListeners();
    }),
    setWindowedCanvasSize: (function() {
      if (typeof SDL != "undefined") {
        var flags = HEAPU32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2];
        flags = flags & ~8388608;
        HEAP32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2] = flags;
      }
      Browser.updateResizeListeners();
    }),
    updateCanvasDimensions: (function(canvas, wNative, hNative) {
      if (wNative && hNative) {
        canvas.widthNative = wNative;
        canvas.heightNative = hNative;
      } else {
        wNative = canvas.widthNative;
        hNative = canvas.heightNative;
      }
      var w = wNative;
      var h = hNative;
      if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
        if (w / h < Module["forcedAspectRatio"]) {
          w = Math.round(h * Module["forcedAspectRatio"]);
        } else {
          h = Math.round(w / Module["forcedAspectRatio"]);
        }
      }
      if ((document["webkitFullScreenElement"] || document["webkitFullscreenElement"] || document["mozFullScreenElement"] || document["mozFullscreenElement"] || document["fullScreenElement"] || document["fullscreenElement"] || document["msFullScreenElement"] || document["msFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
        var factor = Math.min(screen.width / w, screen.height / h);
        w = Math.round(w * factor);
        h = Math.round(h * factor);
      }
      if (Browser.resizeCanvas) {
        if (canvas.width != w)
          canvas.width = w;
        if (canvas.height != h)
          canvas.height = h;
        if (typeof canvas.style != "undefined") {
          canvas.style.removeProperty("width");
          canvas.style.removeProperty("height");
        }
      } else {
        if (canvas.width != wNative)
          canvas.width = wNative;
        if (canvas.height != hNative)
          canvas.height = hNative;
        if (typeof canvas.style != "undefined") {
          if (w != wNative || h != hNative) {
            canvas.style.setProperty("width", w + "px", "important");
            canvas.style.setProperty("height", h + "px", "important");
          } else {
            canvas.style.removeProperty("width");
            canvas.style.removeProperty("height");
          }
        }
      }
    }),
    wgetRequests: {},
    nextWgetRequestHandle: 0,
    getNextWgetRequestHandle: (function() {
      var handle = Browser.nextWgetRequestHandle;
      Browser.nextWgetRequestHandle++;
      return handle;
    })
  };
  function floatReadValueFromPointer(name, shift) {
    switch (shift) {
      case 2:
        return (function(pointer) {
          return this["fromWireType"](HEAPF32[pointer >> 2]);
        });
      case 3:
        return (function(pointer) {
          return this["fromWireType"](HEAPF64[pointer >> 3]);
        });
      default:
        throw new TypeError("Unknown float type: " + name);
    }
  }
  function __embind_register_float(rawType, name, size) {
    var shift = getShiftFromSize(size);
    name = readLatin1String(name);
    registerType(rawType, {
      name: name,
      "fromWireType": (function(value) {
        return value;
      }),
      "toWireType": (function(destructors, value) {
        if (typeof value !== "number" && typeof value !== "boolean") {
          throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
        }
        return value;
      }),
      "argPackAdvance": 8,
      "readValueFromPointer": floatReadValueFromPointer(name, shift),
      destructorFunction: null
    });
  }
  function __exit(status) {
    Module["exit"](status);
  }
  function _exit(status) {
    __exit(status);
  }
  function _stat(path, buf, dontResolveLastLink) {
    path = typeof path !== "string" ? Pointer_stringify(path) : path;
    try {
      var stat = dontResolveLastLink ? FS.lstat(path) : FS.stat(path);
      HEAP32[buf >> 2] = stat.dev;
      HEAP32[buf + 4 >> 2] = 0;
      HEAP32[buf + 8 >> 2] = stat.ino;
      HEAP32[buf + 12 >> 2] = stat.mode;
      HEAP32[buf + 16 >> 2] = stat.nlink;
      HEAP32[buf + 20 >> 2] = stat.uid;
      HEAP32[buf + 24 >> 2] = stat.gid;
      HEAP32[buf + 28 >> 2] = stat.rdev;
      HEAP32[buf + 32 >> 2] = 0;
      HEAP32[buf + 36 >> 2] = stat.size;
      HEAP32[buf + 40 >> 2] = 4096;
      HEAP32[buf + 44 >> 2] = stat.blocks;
      HEAP32[buf + 48 >> 2] = stat.atime.getTime() / 1e3 | 0;
      HEAP32[buf + 52 >> 2] = 0;
      HEAP32[buf + 56 >> 2] = stat.mtime.getTime() / 1e3 | 0;
      HEAP32[buf + 60 >> 2] = 0;
      HEAP32[buf + 64 >> 2] = stat.ctime.getTime() / 1e3 | 0;
      HEAP32[buf + 68 >> 2] = 0;
      HEAP32[buf + 72 >> 2] = stat.ino;
      return 0;
    } catch (e) {
      if (e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
        e.setErrno(ERRNO_CODES.ENOTDIR);
      }
      FS.handleFSError(e);
      return -1;
    }
  }
  Module["_bitshift64Lshr"] = _bitshift64Lshr;
  var _BDtoILow = true;
  var _BDtoIHigh = true;
  function _input_state(port, device, index, id) {
    return Module.input_state(port, device, index, id);
  }
  function new_(constructor, argumentList) {
    if (!(constructor instanceof Function)) {
      throw new TypeError("new_ called with constructor type " + typeof constructor + " which is not a function");
    }
    var dummy = createNamedFunction(constructor.name || "unknownFunctionName", (function() {}));
    dummy.prototype = constructor.prototype;
    var obj = new dummy;
    var r = constructor.apply(obj, argumentList);
    return r instanceof Object ? r : obj;
  }
  function runDestructors(destructors) {
    while (destructors.length) {
      var ptr = destructors.pop();
      var del = destructors.pop();
      del(ptr);
    }
  }
  function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
    var argCount = argTypes.length;
    if (argCount < 2) {
      throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
    }
    var isClassMethodFunc = argTypes[1] !== null && classType !== null;
    var argsList = "";
    var argsListWired = "";
    for (var i = 0; i < argCount - 2; ++i) {
      argsList += (i !== 0 ? ", " : "") + "arg" + i;
      argsListWired += (i !== 0 ? ", " : "") + "arg" + i + "Wired";
    }
    var invokerFnBody = "return function " + makeLegalFunctionName(humanName) + "(" + argsList + ") {\n" + "if (arguments.length !== " + (argCount - 2) + ") {\n" + "throwBindingError('function " + humanName + " called with ' + arguments.length + ' arguments, expected " + (argCount - 2) + " args!');\n" + "}\n";
    var needsDestructorStack = false;
    for (var i = 1; i < argTypes.length; ++i) {
      if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) {
        needsDestructorStack = true;
        break;
      }
    }
    if (needsDestructorStack) {
      invokerFnBody += "var destructors = [];\n";
    }
    var dtorStack = needsDestructorStack ? "destructors" : "null";
    var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
    var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
    if (isClassMethodFunc) {
      invokerFnBody += "var thisWired = classParam.toWireType(" + dtorStack + ", this);\n";
    }
    for (var i = 0; i < argCount - 2; ++i) {
      invokerFnBody += "var arg" + i + "Wired = argType" + i + ".toWireType(" + dtorStack + ", arg" + i + "); // " + argTypes[i + 2].name + "\n";
      args1.push("argType" + i);
      args2.push(argTypes[i + 2]);
    }
    if (isClassMethodFunc) {
      argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
    }
    var returns = argTypes[0].name !== "void";
    invokerFnBody += (returns ? "var rv = " : "") + "invoker(fn" + (argsListWired.length > 0 ? ", " : "") + argsListWired + ");\n";
    if (needsDestructorStack) {
      invokerFnBody += "runDestructors(destructors);\n";
    } else {
      for (var i = isClassMethodFunc ? 1 : 2; i < argTypes.length; ++i) {
        var paramName = i === 1 ? "thisWired" : "arg" + (i - 2) + "Wired";
        if (argTypes[i].destructorFunction !== null) {
          invokerFnBody += paramName + "_dtor(" + paramName + "); // " + argTypes[i].name + "\n";
          args1.push(paramName + "_dtor");
          args2.push(argTypes[i].destructorFunction);
        }
      }
    }
    if (returns) {
      invokerFnBody += "var ret = retType.fromWireType(rv);\n" + "return ret;\n";
    } else {}
    invokerFnBody += "}\n";
    args1.push(invokerFnBody);
    var invokerFunction = new_(Function, args1).apply(null, args2);
    return invokerFunction;
  }
  function ensureOverloadTable(proto, methodName, humanName) {
    if (undefined === proto[methodName].overloadTable) {
      var prevFunc = proto[methodName];
      proto[methodName] = (function() {
        if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
          throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
        }
        return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
      });
      proto[methodName].overloadTable = [];
      proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
    }
  }
  function exposePublicSymbol(name, value, numArguments) {
    if (Module.hasOwnProperty(name)) {
      if (undefined === numArguments || undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments]) {
        throwBindingError("Cannot register public name '" + name + "' twice");
      }
      ensureOverloadTable(Module, name, name);
      if (Module.hasOwnProperty(numArguments)) {
        throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
      }
      Module[name].overloadTable[numArguments] = value;
    } else {
      Module[name] = value;
      if (undefined !== numArguments) {
        Module[name].numArguments = numArguments;
      }
    }
  }
  function heap32VectorToArray(count, firstElement) {
    var array = [];
    for (var i = 0; i < count; i++) {
      array.push(HEAP32[(firstElement >> 2) + i]);
    }
    return array;
  }
  function replacePublicSymbol(name, value, numArguments) {
    if (!Module.hasOwnProperty(name)) {
      throwInternalError("Replacing nonexistant public symbol");
    }
    if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
      Module[name].overloadTable[numArguments] = value;
    } else {
      Module[name] = value;
    }
  }
  function requireFunction(signature, rawFunction) {
    signature = readLatin1String(signature);
    function makeDynCaller(dynCall) {
      var args = [];
      for (var i = 1; i < signature.length; ++i) {
        args.push("a" + i);
      }
      var name = "dynCall_" + signature + "_" + rawFunction;
      var body = "return function " + name + "(" + args.join(", ") + ") {\n";
      body += "    return dynCall(rawFunction" + (args.length ? ", " : "") + args.join(", ") + ");\n";
      body += "};\n";
      return (new Function("dynCall", "rawFunction", body))(dynCall, rawFunction);
    }
    var fp;
    if (Module["FUNCTION_TABLE_" + signature] !== undefined) {
      fp = Module["FUNCTION_TABLE_" + signature][rawFunction];
    } else if (typeof FUNCTION_TABLE !== "undefined") {
      fp = FUNCTION_TABLE[rawFunction];
    } else {
      var dc = asm["dynCall_" + signature];
      if (dc === undefined) {
        dc = asm["dynCall_" + signature.replace(/f/g, "d")];
        if (dc === undefined) {
          throwBindingError("No dynCall invoker for signature: " + signature);
        }
      }
      fp = makeDynCaller(dc);
    }
    if (typeof fp !== "function") {
      throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
    }
    return fp;
  }
  var UnboundTypeError = undefined;
  function throwUnboundTypeError(message, types) {
    var unboundTypes = [];
    var seen = {};
    function visit(type) {
      if (seen[type]) {
        return ;
      }
      if (registeredTypes[type]) {
        return ;
      }
      if (typeDependencies[type]) {
        typeDependencies[type].forEach(visit);
        return ;
      }
      unboundTypes.push(type);
      seen[type] = true;
    }
    types.forEach(visit);
    throw new UnboundTypeError(message + ": " + unboundTypes.map(getTypeName).join([", "]));
  }
  function __embind_register_function(name, argCount, rawArgTypesAddr, signature, rawInvoker, fn) {
    var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
    name = readLatin1String(name);
    rawInvoker = requireFunction(signature, rawInvoker);
    exposePublicSymbol(name, (function() {
      throwUnboundTypeError("Cannot call " + name + " due to unbound types", argTypes);
    }), argCount - 1);
    whenDependentTypesAreResolved([], argTypes, (function(argTypes) {
      var invokerArgsArray = [argTypes[0], null].concat(argTypes.slice(1));
      replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null, rawInvoker, fn), argCount - 1);
      return [];
    }));
  }
  var emval_free_list = [];
  var emval_handle_array = [{}, {value: undefined}, {value: null}, {value: true}, {value: false}];
  function __emval_decref(handle) {
    if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
      emval_handle_array[handle] = undefined;
      emval_free_list.push(handle);
    }
  }
  function count_emval_handles() {
    var count = 0;
    for (var i = 5; i < emval_handle_array.length; ++i) {
      if (emval_handle_array[i] !== undefined) {
        ++count;
      }
    }
    return count;
  }
  function get_first_emval() {
    for (var i = 5; i < emval_handle_array.length; ++i) {
      if (emval_handle_array[i] !== undefined) {
        return emval_handle_array[i];
      }
    }
    return null;
  }
  function init_emval() {
    Module["count_emval_handles"] = count_emval_handles;
    Module["get_first_emval"] = get_first_emval;
  }
  function __emval_register(value) {
    switch (value) {
      case undefined:
        {
          return 1;
        }
        ;
      case null:
        {
          return 2;
        }
        ;
      case true:
        {
          return 3;
        }
        ;
      case false:
        {
          return 4;
        }
        ;
      default:
        {
          var handle = emval_free_list.length ? emval_free_list.pop() : emval_handle_array.length;
          emval_handle_array[handle] = {
            refcount: 1,
            value: value
          };
          return handle;
        }
    }
  }
  function __embind_register_emval(rawType, name) {
    name = readLatin1String(name);
    registerType(rawType, {
      name: name,
      "fromWireType": (function(handle) {
        var rv = emval_handle_array[handle].value;
        __emval_decref(handle);
        return rv;
      }),
      "toWireType": (function(destructors, value) {
        return __emval_register(value);
      }),
      "argPackAdvance": 8,
      "readValueFromPointer": simpleReadValueFromPointer,
      destructorFunction: null
    });
  }
  function __embind_register_constant(name, type, value) {
    name = readLatin1String(name);
    whenDependentTypesAreResolved([], [type], (function(type) {
      type = type[0];
      Module[name] = type["fromWireType"](value);
      return [];
    }));
  }
  function _emscripten_memcpy_big(dest, src, num) {
    HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
    return dest;
  }
  Module["_memcpy"] = _memcpy;
  function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
    var shift = getShiftFromSize(size);
    name = readLatin1String(name);
    registerType(rawType, {
      name: name,
      "fromWireType": (function(wt) {
        return !!wt;
      }),
      "toWireType": (function(destructors, o) {
        return o ? trueValue : falseValue;
      }),
      "argPackAdvance": 8,
      "readValueFromPointer": (function(pointer) {
        var heap;
        if (size === 1) {
          heap = HEAP8;
        } else if (size === 2) {
          heap = HEAP16;
        } else if (size === 4) {
          heap = HEAP32;
        } else {
          throw new TypeError("Unknown boolean type size: " + name);
        }
        return this["fromWireType"](heap[pointer >> shift]);
      }),
      destructorFunction: null
    });
  }
  function getTypeName(type) {
    var ptr = ___getTypeName(type);
    var rv = readLatin1String(ptr);
    _free(ptr);
    return rv;
  }
  function requireRegisteredType(rawType, humanName) {
    var impl = registeredTypes[rawType];
    if (undefined === impl) {
      throwBindingError(humanName + " has unknown type " + getTypeName(rawType));
    }
    return impl;
  }
  function __embind_register_enum_value(rawEnumType, name, enumValue) {
    var enumType = requireRegisteredType(rawEnumType, "enum");
    name = readLatin1String(name);
    var Enum = enumType.constructor;
    var Value = Object.create(enumType.constructor.prototype, {
      value: {value: enumValue},
      constructor: {value: createNamedFunction(enumType.name + "_" + name, (function() {}))}
    });
    Enum.values[enumValue] = Value;
    Enum[name] = Value;
  }
  function _sbrk(bytes) {
    var self = _sbrk;
    if (!self.called) {
      DYNAMICTOP = alignMemoryPage(DYNAMICTOP);
      self.called = true;
      assert(Runtime.dynamicAlloc);
      self.alloc = Runtime.dynamicAlloc;
      Runtime.dynamicAlloc = (function() {
        abort("cannot dynamically allocate, sbrk now has control");
      });
    }
    var ret = DYNAMICTOP;
    if (bytes != 0) {
      var success = self.alloc(bytes);
      if (!success)
        return -1 >>> 0;
    }
    return ret;
  }
  function __embind_register_std_wstring(rawType, charSize, name) {
    name = readLatin1String(name);
    var getHeap,
        shift;
    if (charSize === 2) {
      getHeap = (function() {
        return HEAPU16;
      });
      shift = 1;
    } else if (charSize === 4) {
      getHeap = (function() {
        return HEAPU32;
      });
      shift = 2;
    }
    registerType(rawType, {
      name: name,
      "fromWireType": (function(value) {
        var HEAP = getHeap();
        var length = HEAPU32[value >> 2];
        var a = new Array(length);
        var start = value + 4 >> shift;
        for (var i = 0; i < length; ++i) {
          a[i] = String.fromCharCode(HEAP[start + i]);
        }
        _free(value);
        return a.join("");
      }),
      "toWireType": (function(destructors, value) {
        var HEAP = getHeap();
        var length = value.length;
        var ptr = _malloc(4 + length * charSize);
        HEAPU32[ptr >> 2] = length;
        var start = ptr + 4 >> shift;
        for (var i = 0; i < length; ++i) {
          HEAP[start + i] = value.charCodeAt(i);
        }
        if (destructors !== null) {
          destructors.push(_free, ptr);
        }
        return ptr;
      }),
      "argPackAdvance": 8,
      "readValueFromPointer": simpleReadValueFromPointer,
      destructorFunction: (function(ptr) {
        _free(ptr);
      })
    });
  }
  function ___errno_location() {
    return ___errno_state;
  }
  var _BItoD = true;
  Module["_strcpy"] = _strcpy;
  function __embind_register_memory_view(rawType, dataTypeIndex, name) {
    var typeMapping = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
    var TA = typeMapping[dataTypeIndex];
    function decodeMemoryView(handle) {
      handle = handle >> 2;
      var heap = HEAPU32;
      var size = heap[handle];
      var data = heap[handle + 1];
      return new TA(heap["buffer"], data, size);
    }
    name = readLatin1String(name);
    registerType(rawType, {
      name: name,
      "fromWireType": decodeMemoryView,
      "argPackAdvance": 8,
      "readValueFromPointer": decodeMemoryView
    }, {ignoreDuplicateRegistrations: true});
  }
  function _time(ptr) {
    var ret = Date.now() / 1e3 | 0;
    if (ptr) {
      HEAP32[ptr >> 2] = ret;
    }
    return ret;
  }
  function _video_refresh(_data, width, height, pitch) {
    var data = new Uint8Array(Module.HEAP8.buffer, _data, height * pitch);
    Module.video_refresh(data, width, height, pitch);
  }
  function _audio_sample_batch(_data, frames) {
    var left = new Float32Array(frames);
    var right = new Float32Array(frames);
    var data = new Int16Array(Module.HEAP8.buffer, _data, frames * 4);
    for (var i = 0; i < frames; i++) {
      left[i] = data[i * 2] / 32768;
      right[i] = data[i * 2 + 1] / 32768;
    }
    return Module.audio_sample_batch(left, right, frames);
  }
  function enumReadValueFromPointer(name, shift, signed) {
    switch (shift) {
      case 0:
        return (function(pointer) {
          var heap = signed ? HEAP8 : HEAPU8;
          return this["fromWireType"](heap[pointer]);
        });
      case 1:
        return (function(pointer) {
          var heap = signed ? HEAP16 : HEAPU16;
          return this["fromWireType"](heap[pointer >> 1]);
        });
      case 2:
        return (function(pointer) {
          var heap = signed ? HEAP32 : HEAPU32;
          return this["fromWireType"](heap[pointer >> 2]);
        });
      default:
        throw new TypeError("Unknown integer type: " + name);
    }
  }
  function __embind_register_enum(rawType, name, size, isSigned) {
    var shift = getShiftFromSize(size);
    name = readLatin1String(name);
    function constructor() {}
    constructor.values = {};
    registerType(rawType, {
      name: name,
      constructor: constructor,
      "fromWireType": (function(c) {
        return this.constructor.values[c];
      }),
      "toWireType": (function(destructors, c) {
        return c.value;
      }),
      "argPackAdvance": 8,
      "readValueFromPointer": enumReadValueFromPointer(name, shift, isSigned),
      destructorFunction: null
    });
    exposePublicSymbol(name, constructor);
  }
  ___errno_state = Runtime.staticAlloc(4);
  HEAP32[___errno_state >> 2] = 0;
  _fgetc.ret = allocate([0], "i8", ALLOC_STATIC);
  FS.staticInit();
  __ATINIT__.unshift((function() {
    if (!Module["noFSInit"] && !FS.init.initialized)
      FS.init();
  }));
  __ATMAIN__.push((function() {
    FS.ignorePermissions = false;
  }));
  __ATEXIT__.push((function() {
    FS.quit();
  }));
  Module["FS_createFolder"] = FS.createFolder;
  Module["FS_createPath"] = FS.createPath;
  Module["FS_createDataFile"] = FS.createDataFile;
  Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
  Module["FS_createLazyFile"] = FS.createLazyFile;
  Module["FS_createLink"] = FS.createLink;
  Module["FS_createDevice"] = FS.createDevice;
  __ATINIT__.unshift((function() {
    TTY.init();
  }));
  __ATEXIT__.push((function() {
    TTY.shutdown();
  }));
  if (ENVIRONMENT_IS_NODE) {
    var fs = require("fs");
    var NODEJS_PATH = require("path");
    NODEFS.staticInit();
  }
  __ATINIT__.push((function() {
    SOCKFS.root = FS.mount(SOCKFS, {}, null);
  }));
  embind_init_charCodes();
  BindingError = Module["BindingError"] = extendError(Error, "BindingError");
  InternalError = Module["InternalError"] = extendError(Error, "InternalError");
  _fputc.ret = allocate([0], "i8", ALLOC_STATIC);
  Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) {
    Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice);
  };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) {
    Browser.requestAnimationFrame(func);
  };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) {
    Browser.setCanvasSize(width, height, noUpdates);
  };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() {
    Browser.mainLoop.pause();
  };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() {
    Browser.mainLoop.resume();
  };
  Module["getUserMedia"] = function Module_getUserMedia() {
    Browser.getUserMedia();
  };
  Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
    return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes);
  };
  UnboundTypeError = Module["UnboundTypeError"] = extendError(Error, "UnboundTypeError");
  init_emval();
  STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);
  staticSealed = true;
  STACK_MAX = STACK_BASE + TOTAL_STACK;
  DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);
  assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");
  var cttz_i8 = allocate([8, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 6, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 7, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 6, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0], "i8", ALLOC_DYNAMIC);
  function invoke_iiii(index, a1, a2, a3) {
    try {
      return Module["dynCall_iiii"](index, a1, a2, a3);
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp")
        throw e;
      asm["setThrew"](1, 0);
    }
  }
  function jsCall_iiii(index, a1, a2, a3) {
    return Runtime.functionPointers[index](a1, a2, a3);
  }
  function invoke_viiiii(index, a1, a2, a3, a4, a5) {
    try {
      Module["dynCall_viiiii"](index, a1, a2, a3, a4, a5);
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp")
        throw e;
      asm["setThrew"](1, 0);
    }
  }
  function jsCall_viiiii(index, a1, a2, a3, a4, a5) {
    Runtime.functionPointers[index](a1, a2, a3, a4, a5);
  }
  function invoke_i(index) {
    try {
      return Module["dynCall_i"](index);
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp")
        throw e;
      asm["setThrew"](1, 0);
    }
  }
  function jsCall_i(index) {
    return Runtime.functionPointers[index]();
  }
  function invoke_vi(index, a1) {
    try {
      Module["dynCall_vi"](index, a1);
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp")
        throw e;
      asm["setThrew"](1, 0);
    }
  }
  function jsCall_vi(index, a1) {
    Runtime.functionPointers[index](a1);
  }
  function invoke_vii(index, a1, a2) {
    try {
      Module["dynCall_vii"](index, a1, a2);
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp")
        throw e;
      asm["setThrew"](1, 0);
    }
  }
  function jsCall_vii(index, a1, a2) {
    Runtime.functionPointers[index](a1, a2);
  }
  function invoke_ii(index, a1) {
    try {
      return Module["dynCall_ii"](index, a1);
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp")
        throw e;
      asm["setThrew"](1, 0);
    }
  }
  function jsCall_ii(index, a1) {
    return Runtime.functionPointers[index](a1);
  }
  function invoke_viii(index, a1, a2, a3) {
    try {
      Module["dynCall_viii"](index, a1, a2, a3);
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp")
        throw e;
      asm["setThrew"](1, 0);
    }
  }
  function jsCall_viii(index, a1, a2, a3) {
    Runtime.functionPointers[index](a1, a2, a3);
  }
  function invoke_v(index) {
    try {
      Module["dynCall_v"](index);
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp")
        throw e;
      asm["setThrew"](1, 0);
    }
  }
  function jsCall_v(index) {
    Runtime.functionPointers[index]();
  }
  function invoke_iiiii(index, a1, a2, a3, a4) {
    try {
      return Module["dynCall_iiiii"](index, a1, a2, a3, a4);
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp")
        throw e;
      asm["setThrew"](1, 0);
    }
  }
  function jsCall_iiiii(index, a1, a2, a3, a4) {
    return Runtime.functionPointers[index](a1, a2, a3, a4);
  }
  function invoke_viiiiii(index, a1, a2, a3, a4, a5, a6) {
    try {
      Module["dynCall_viiiiii"](index, a1, a2, a3, a4, a5, a6);
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp")
        throw e;
      asm["setThrew"](1, 0);
    }
  }
  function jsCall_viiiiii(index, a1, a2, a3, a4, a5, a6) {
    Runtime.functionPointers[index](a1, a2, a3, a4, a5, a6);
  }
  function invoke_iii(index, a1, a2) {
    try {
      return Module["dynCall_iii"](index, a1, a2);
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp")
        throw e;
      asm["setThrew"](1, 0);
    }
  }
  function jsCall_iii(index, a1, a2) {
    return Runtime.functionPointers[index](a1, a2);
  }
  function invoke_viiii(index, a1, a2, a3, a4) {
    try {
      Module["dynCall_viiii"](index, a1, a2, a3, a4);
    } catch (e) {
      if (typeof e !== "number" && e !== "longjmp")
        throw e;
      asm["setThrew"](1, 0);
    }
  }
  function jsCall_viiii(index, a1, a2, a3, a4) {
    Runtime.functionPointers[index](a1, a2, a3, a4);
  }
  Module.asmGlobalArg = {
    "Math": Math,
    "Int8Array": Int8Array,
    "Int16Array": Int16Array,
    "Int32Array": Int32Array,
    "Uint8Array": Uint8Array,
    "Uint16Array": Uint16Array,
    "Uint32Array": Uint32Array,
    "Float32Array": Float32Array,
    "Float64Array": Float64Array,
    "NaN": NaN,
    "Infinity": Infinity,
    "byteLength": byteLength
  };
  Module.asmLibraryArg = {
    "abort": abort,
    "assert": assert,
    "invoke_iiii": invoke_iiii,
    "jsCall_iiii": jsCall_iiii,
    "invoke_viiiii": invoke_viiiii,
    "jsCall_viiiii": jsCall_viiiii,
    "invoke_i": invoke_i,
    "jsCall_i": jsCall_i,
    "invoke_vi": invoke_vi,
    "jsCall_vi": jsCall_vi,
    "invoke_vii": invoke_vii,
    "jsCall_vii": jsCall_vii,
    "invoke_ii": invoke_ii,
    "jsCall_ii": jsCall_ii,
    "invoke_viii": invoke_viii,
    "jsCall_viii": jsCall_viii,
    "invoke_v": invoke_v,
    "jsCall_v": jsCall_v,
    "invoke_iiiii": invoke_iiiii,
    "jsCall_iiiii": jsCall_iiiii,
    "invoke_viiiiii": invoke_viiiiii,
    "jsCall_viiiiii": jsCall_viiiiii,
    "invoke_iii": invoke_iii,
    "jsCall_iii": jsCall_iii,
    "invoke_viiii": invoke_viiii,
    "jsCall_viiii": jsCall_viiii,
    "floatReadValueFromPointer": floatReadValueFromPointer,
    "simpleReadValueFromPointer": simpleReadValueFromPointer,
    "_fread": _fread,
    "get_first_emval": get_first_emval,
    "_audio_sample_batch": _audio_sample_batch,
    "getShiftFromSize": getShiftFromSize,
    "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing,
    "_sbrk": _sbrk,
    "_emscripten_memcpy_big": _emscripten_memcpy_big,
    "_sysconf": _sysconf,
    "_video_refresh": _video_refresh,
    "_close": _close,
    "throwInternalError": throwInternalError,
    "_puts": _puts,
    "_write": _write,
    "whenDependentTypesAreResolved": whenDependentTypesAreResolved,
    "_ftell": _ftell,
    "__embind_register_constant": __embind_register_constant,
    "_send": _send,
    "embind_init_charCodes": embind_init_charCodes,
    "_strerror_r": _strerror_r,
    "_audio_sample": _audio_sample,
    "___setErrNo": ___setErrNo,
    "__embind_register_bool": __embind_register_bool,
    "createNamedFunction": createNamedFunction,
    "__embind_register_emval": __embind_register_emval,
    "__emval_decref": __emval_decref,
    "_printf": _printf,
    "_fopen": _fopen,
    "heap32VectorToArray": heap32VectorToArray,
    "_stat": _stat,
    "_read": _read,
    "_fwrite": _fwrite,
    "_time": _time,
    "_fprintf": _fprintf,
    "new_": new_,
    "_exit": _exit,
    "replacePublicSymbol": replacePublicSymbol,
    "_input_state": _input_state,
    "_lseek": _lseek,
    "__embind_register_integer": __embind_register_integer,
    "_input_poll": _input_poll,
    "_pwrite": _pwrite,
    "_open": _open,
    "enumReadValueFromPointer": enumReadValueFromPointer,
    "getTypeName": getTypeName,
    "_fseek": _fseek,
    "throwUnboundTypeError": throwUnboundTypeError,
    "craftInvokerFunction": craftInvokerFunction,
    "_fclose": _fclose,
    "runDestructors": runDestructors,
    "requireRegisteredType": requireRegisteredType,
    "makeLegalFunctionName": makeLegalFunctionName,
    "init_emval": init_emval,
    "_recv": _recv,
    "_environment": _environment,
    "registerType": registerType,
    "_abort": _abort,
    "throwBindingError": throwBindingError,
    "_embind_repr": _embind_repr,
    "exposePublicSymbol": exposePublicSymbol,
    "__embind_register_std_string": __embind_register_std_string,
    "__embind_register_memory_view": __embind_register_memory_view,
    "extendError": extendError,
    "ensureOverloadTable": ensureOverloadTable,
    "__embind_register_void": __embind_register_void,
    "_fflush": _fflush,
    "__reallyNegative": __reallyNegative,
    "__emval_register": __emval_register,
    "__embind_register_std_wstring": __embind_register_std_wstring,
    "_fileno": _fileno,
    "__exit": __exit,
    "readLatin1String": readLatin1String,
    "_pread": _pread,
    "_mkport": _mkport,
    "__embind_register_float": __embind_register_float,
    "integerReadValueFromPointer": integerReadValueFromPointer,
    "__embind_register_function": __embind_register_function,
    "__embind_register_enum_value": __embind_register_enum_value,
    "_emscripten_set_main_loop": _emscripten_set_main_loop,
    "___errno_location": ___errno_location,
    "_fgetc": _fgetc,
    "_fputc": _fputc,
    "__embind_register_enum": __embind_register_enum,
    "count_emval_handles": count_emval_handles,
    "requireFunction": requireFunction,
    "_strerror": _strerror,
    "__formatString": __formatString,
    "_fputs": _fputs,
    "STACKTOP": STACKTOP,
    "STACK_MAX": STACK_MAX,
    "tempDoublePtr": tempDoublePtr,
    "ABORT": ABORT,
    "cttz_i8": cttz_i8,
    "_stderr": _stderr
  };
  var asm = (function(global, env, buffer) {
    "use asm";
    var a = global.Int8Array;
    var b = global.Int16Array;
    var c = global.Int32Array;
    var d = global.Uint8Array;
    var e = global.Uint16Array;
    var f = global.Uint32Array;
    var g = global.Float32Array;
    var h = global.Float64Array;
    var i = new a(buffer);
    var j = new b(buffer);
    var k = new c(buffer);
    var l = new d(buffer);
    var m = new e(buffer);
    var n = new f(buffer);
    var o = new g(buffer);
    var p = new h(buffer);
    var q = global.byteLength;
    var r = env.STACKTOP | 0;
    var s = env.STACK_MAX | 0;
    var t = env.tempDoublePtr | 0;
    var u = env.ABORT | 0;
    var v = env.cttz_i8 | 0;
    var w = env._stderr | 0;
    var x = 0;
    var y = 0;
    var z = 0;
    var A = 0;
    var B = global.NaN,
        C = global.Infinity;
    var D = 0,
        E = 0,
        F = 0,
        G = 0,
        H = 0.0,
        I = 0,
        J = 0,
        K = 0,
        L = 0.0;
    var M = 0;
    var N = 0;
    var O = 0;
    var P = 0;
    var Q = 0;
    var R = 0;
    var S = 0;
    var T = 0;
    var U = 0;
    var V = 0;
    var W = global.Math.floor;
    var X = global.Math.abs;
    var Y = global.Math.sqrt;
    var Z = global.Math.pow;
    var _ = global.Math.cos;
    var $ = global.Math.sin;
    var aa = global.Math.tan;
    var ba = global.Math.acos;
    var ca = global.Math.asin;
    var da = global.Math.atan;
    var ea = global.Math.atan2;
    var fa = global.Math.exp;
    var ga = global.Math.log;
    var ha = global.Math.ceil;
    var ia = global.Math.imul;
    var ja = global.Math.min;
    var ka = global.Math.clz32;
    var la = env.abort;
    var ma = env.assert;
    var na = env.invoke_iiii;
    var oa = env.jsCall_iiii;
    var pa = env.invoke_viiiii;
    var qa = env.jsCall_viiiii;
    var ra = env.invoke_i;
    var sa = env.jsCall_i;
    var ta = env.invoke_vi;
    var ua = env.jsCall_vi;
    var va = env.invoke_vii;
    var wa = env.jsCall_vii;
    var xa = env.invoke_ii;
    var ya = env.jsCall_ii;
    var za = env.invoke_viii;
    var Aa = env.jsCall_viii;
    var Ba = env.invoke_v;
    var Ca = env.jsCall_v;
    var Da = env.invoke_iiiii;
    var Ea = env.jsCall_iiiii;
    var Fa = env.invoke_viiiiii;
    var Ga = env.jsCall_viiiiii;
    var Ha = env.invoke_iii;
    var Ia = env.jsCall_iii;
    var Ja = env.invoke_viiii;
    var Ka = env.jsCall_viiii;
    var La = env.floatReadValueFromPointer;
    var Ma = env.simpleReadValueFromPointer;
    var Na = env._fread;
    var Oa = env.get_first_emval;
    var Pa = env._audio_sample_batch;
    var Qa = env.getShiftFromSize;
    var Ra = env._emscripten_set_main_loop_timing;
    var Sa = env._sbrk;
    var Ta = env._emscripten_memcpy_big;
    var Ua = env._sysconf;
    var Va = env._video_refresh;
    var Wa = env._close;
    var Xa = env.throwInternalError;
    var Ya = env._puts;
    var Za = env._write;
    var _a = env.whenDependentTypesAreResolved;
    var $a = env._ftell;
    var ab = env.__embind_register_constant;
    var bb = env._send;
    var cb = env.embind_init_charCodes;
    var db = env._strerror_r;
    var eb = env._audio_sample;
    var fb = env.___setErrNo;
    var gb = env.__embind_register_bool;
    var hb = env.createNamedFunction;
    var ib = env.__embind_register_emval;
    var jb = env.__emval_decref;
    var kb = env._printf;
    var lb = env._fopen;
    var mb = env.heap32VectorToArray;
    var nb = env._stat;
    var ob = env._read;
    var pb = env._fwrite;
    var qb = env._time;
    var rb = env._fprintf;
    var sb = env.new_;
    var tb = env._exit;
    var ub = env.replacePublicSymbol;
    var vb = env._input_state;
    var wb = env._lseek;
    var xb = env.__embind_register_integer;
    var yb = env._input_poll;
    var zb = env._pwrite;
    var Ab = env._open;
    var Bb = env.enumReadValueFromPointer;
    var Cb = env.getTypeName;
    var Db = env._fseek;
    var Eb = env.throwUnboundTypeError;
    var Fb = env.craftInvokerFunction;
    var Gb = env._fclose;
    var Hb = env.runDestructors;
    var Ib = env.requireRegisteredType;
    var Jb = env.makeLegalFunctionName;
    var Kb = env.init_emval;
    var Lb = env._recv;
    var Mb = env._environment;
    var Nb = env.registerType;
    var Ob = env._abort;
    var Pb = env.throwBindingError;
    var Qb = env._embind_repr;
    var Rb = env.exposePublicSymbol;
    var Sb = env.__embind_register_std_string;
    var Tb = env.__embind_register_memory_view;
    var Ub = env.extendError;
    var Vb = env.ensureOverloadTable;
    var Wb = env.__embind_register_void;
    var Xb = env._fflush;
    var Yb = env.__reallyNegative;
    var Zb = env.__emval_register;
    var _b = env.__embind_register_std_wstring;
    var $b = env._fileno;
    var ac = env.__exit;
    var bc = env.readLatin1String;
    var cc = env._pread;
    var dc = env._mkport;
    var ec = env.__embind_register_float;
    var fc = env.integerReadValueFromPointer;
    var gc = env.__embind_register_function;
    var hc = env.__embind_register_enum_value;
    var ic = env._emscripten_set_main_loop;
    var jc = env.___errno_location;
    var kc = env._fgetc;
    var lc = env._fputc;
    var mc = env.__embind_register_enum;
    var nc = env.count_emval_handles;
    var oc = env.requireFunction;
    var pc = env._strerror;
    var qc = env.__formatString;
    var rc = env._fputs;
    var sc = 0.0;
    function _emscripten_replace_memory(newBuffer) {
      if (q(newBuffer) & 16777215 || q(newBuffer) <= 16777215 || q(newBuffer) > 2147483648)
        return false;
      i = new a(newBuffer);
      j = new b(newBuffer);
      k = new c(newBuffer);
      l = new d(newBuffer);
      m = new e(newBuffer);
      n = new f(newBuffer);
      o = new g(newBuffer);
      p = new h(newBuffer);
      buffer = newBuffer;
      return true;
    }
    function Fc(a) {
      a = a | 0;
      var b = 0;
      b = r;
      r = r + a | 0;
      r = r + 15 & -16;
      return b | 0;
    }
    function Gc() {
      return r | 0;
    }
    function Hc(a) {
      a = a | 0;
      r = a;
    }
    function Ic(a, b) {
      a = a | 0;
      b = b | 0;
      r = a;
      s = b;
    }
    function Jc(a, b) {
      a = a | 0;
      b = b | 0;
      if (!x) {
        x = a;
        y = b;
      }
    }
    function Kc(a) {
      a = a | 0;
      i[t >> 0] = i[a >> 0];
      i[t + 1 >> 0] = i[a + 1 >> 0];
      i[t + 2 >> 0] = i[a + 2 >> 0];
      i[t + 3 >> 0] = i[a + 3 >> 0];
    }
    function Lc(a) {
      a = a | 0;
      i[t >> 0] = i[a >> 0];
      i[t + 1 >> 0] = i[a + 1 >> 0];
      i[t + 2 >> 0] = i[a + 2 >> 0];
      i[t + 3 >> 0] = i[a + 3 >> 0];
      i[t + 4 >> 0] = i[a + 4 >> 0];
      i[t + 5 >> 0] = i[a + 5 >> 0];
      i[t + 6 >> 0] = i[a + 6 >> 0];
      i[t + 7 >> 0] = i[a + 7 >> 0];
    }
    function Mc(a) {
      a = a | 0;
      M = a;
    }
    function Nc() {
      return M | 0;
    }
    function Oc() {
      Pd(42);
      je();
      Qd(45);
      Sd(43);
      Rd(42);
      Td(42);
      Ud(42);
      return ;
    }
    function Pc(a) {
      a = a | 0;
      ab(246412, 448, 1);
      ab(246424, 448, 8);
      ab(246442, 448, 255);
      ab(246454, 448, 0);
      ab(246466, 448, 1);
      ab(246480, 448, 2);
      ab(246493, 448, 3);
      ab(246509, 448, 4);
      ab(246525, 448, 5);
      ab(246539, 448, 6);
      ab(246554, 448, 0);
      ab(246573, 448, 1);
      ab(246592, 448, 2);
      ab(246616, 448, 3);
      ab(246639, 448, 4);
      ab(246659, 448, 5);
      ab(246681, 448, 6);
      ab(246703, 448, 7);
      ab(246726, 448, 8);
      ab(246745, 448, 9);
      ab(246764, 448, 10);
      ab(246783, 448, 11);
      ab(246802, 448, 12);
      ab(246822, 448, 13);
      ab(246842, 448, 14);
      ab(246862, 448, 15);
      ab(246882, 448, 0);
      ab(246907, 448, 1);
      ab(246933, 448, 0);
      ab(246952, 448, 1);
      ab(246971, 448, 0);
      ab(246989, 448, 1);
      ab(247007, 448, 2);
      ab(247028, 448, 3);
      ab(247050, 448, 4);
      ab(247074, 448, 5);
      ab(247100, 448, 6);
      ab(247123, 448, 7);
      ab(247153, 448, 8);
      ab(247185, 448, 0);
      ab(247206, 448, 1);
      ab(247227, 448, 2);
      ab(247254, 448, 3);
      ab(247280, 448, 4);
      ab(247305, 448, 5);
      ab(247330, 448, 6);
      ab(247355, 448, 0);
      ab(247375, 448, 1);
      ab(247395, 448, 2);
      ab(247421, 448, 0);
      ab(247433, 448, 1);
      ab(247444, 448, 255);
      ab(247456, 448, 0);
      ab(247472, 448, 1);
      ab(247483, 448, 2);
      ab(247501, 448, 3);
      ab(247518, 448, 65536);
      ab(247543, 448, 131072);
      ab(247563, 448, 1);
      ab(247588, 448, 2);
      ab(247613, 448, 3);
      ab(247638, 448, 6);
      ab(247662, 448, 7);
      ab(247683, 448, 8);
      ab(247717, 448, 9);
      ab(247750, 448, 10);
      ab(247779, 448, 11);
      ab(247813, 448, 12);
      ab(247847, 448, 13);
      ab(247886, 448, 14);
      ab(247912, 448, 15);
      ab(247937, 448, 16);
      ab(247963, 448, 17);
      ab(247995, 448, 18);
      ab(248027, 448, 19);
      ab(248057, 448, 22);
      ab(248088, 448, 21);
      ab(248124, 448, 23);
      ab(248157, 448, 24);
      ab(248199, 448, 65561);
      ab(248232, 448, 65562);
      ab(248265, 448, 27);
      ab(248295, 448, 28);
      ab(248326, 448, 29);
      ab(248361, 448, 30);
      ab(248399, 448, 31);
      ab(248430, 448, 32);
      ab(248461, 448, 33);
      ab(248499, 448, 34);
      ab(248530, 448, 35);
      ab(248562, 448, 65572);
      ab(248590, 448, 37);
      ab(248615, 448, 38);
      ab(248640, 448, 39);
      ab(248665, 448, 1);
      ab(248679, 448, 2);
      ab(248697, 448, 65536);
      ab(248713, 448, 131072);
      ab(248729, 448, 196608);
      ab(248745, 448, 16777216);
      ab(248763, 448, 33554432);
      ab(248781, 448, 50331648);
      ab(248799, 448, 1);
      ab(248808, 448, 2);
      ab(248818, 448, 4);
      ab(248827, 448, 8);
      ab(248839, 448, 16);
      ab(248848, 448, 32);
      ab(248858, 448, 64);
      ab(248868, 448, 128);
      ab(248879, 448, 256);
      ab(248888, 448, 512);
      ab(248900, 448, 1024);
      ab(248910, 448, 2048);
      ab(248921, 448, 4096);
      ab(248931, 448, 8192);
      ab(248941, 448, 16384);
      ab(248949, 448, 32768);
      ab(248958, 448, 0);
      ab(248981, 448, 1);
      ab(249004, 448, 2);
      ab(249027, 376, -1);
      mc(8, 249049, 4, 0);
      hc(8, 249058, 2147483647);
      hc(8, 249073, 12);
      hc(8, 249087, 11);
      hc(8, 249115, 10);
      hc(8, 249144, 9);
      hc(8, 249160, 8);
      hc(8, 249177, 7);
      hc(8, 249197, 6);
      hc(8, 249212, 5);
      hc(8, 249229, 4);
      hc(8, 249245, 3);
      hc(8, 249262, 2);
      hc(8, 249278, 1);
      hc(8, 249296, 0);
      mc(16, 249313, 4, 0);
      hc(16, 249317, 2147483647);
      hc(16, 249325, 323);
      hc(16, 249332, 322);
      hc(16, 249339, 321);
      hc(16, 249346, 320);
      hc(16, 249354, 319);
      hc(16, 249361, 318);
      hc(16, 249369, 317);
      hc(16, 249378, 316);
      hc(16, 249386, 315);
      hc(16, 249393, 314);
      hc(16, 249403, 313);
      hc(16, 249410, 312);
      hc(16, 249419, 311);
      hc(16, 249428, 310);
      hc(16, 249436, 309);
      hc(16, 249444, 308);
      hc(16, 249451, 307);
      hc(16, 249458, 306);
      hc(16, 249466, 305);
      hc(16, 249474, 304);
      hc(16, 249483, 303);
      hc(16, 249492, 302);
      hc(16, 249504, 301);
      hc(16, 249515, 300);
      hc(16, 249525, 296);
      hc(16, 249531, 295);
      hc(16, 249537, 294);
      hc(16, 249543, 293);
      hc(16, 249549, 292);
      hc(16, 249555, 291);
      hc(16, 249561, 290);
      hc(16, 249566, 289);
      hc(16, 249571, 288);
      hc(16, 249576, 287);
      hc(16, 249581, 286);
      hc(16, 249586, 285);
      hc(16, 249591, 284);
      hc(16, 249596, 283);
      hc(16, 249601, 282);
      hc(16, 249606, 281);
      hc(16, 249617, 280);
      hc(16, 249626, 279);
      hc(16, 249632, 278);
      hc(16, 249639, 277);
      hc(16, 249648, 276);
      hc(16, 249655, 275);
      hc(16, 249663, 274);
      hc(16, 249670, 273);
      hc(16, 249675, 272);
      hc(16, 249687, 271);
      hc(16, 249698, 270);
      hc(16, 249708, 269);
      hc(16, 249719, 268);
      hc(16, 249733, 267);
      hc(16, 249745, 266);
      hc(16, 249757, 265);
      hc(16, 249763, 264);
      hc(16, 249769, 263);
      hc(16, 249775, 262);
      hc(16, 249781, 261);
      hc(16, 249787, 260);
      hc(16, 249793, 259);
      hc(16, 249799, 258);
      hc(16, 249805, 257);
      hc(16, 249811, 256);
      hc(16, 249817, 127);
      hc(16, 249826, 122);
      hc(16, 249830, 121);
      hc(16, 249834, 120);
      hc(16, 249838, 119);
      hc(16, 249842, 118);
      hc(16, 249846, 117);
      hc(16, 249850, 116);
      hc(16, 249854, 115);
      hc(16, 249858, 114);
      hc(16, 249862, 113);
      hc(16, 249866, 112);
      hc(16, 249870, 111);
      hc(16, 249874, 110);
      hc(16, 249878, 109);
      hc(16, 249882, 108);
      hc(16, 249886, 107);
      hc(16, 249890, 106);
      hc(16, 249894, 105);
      hc(16, 249898, 104);
      hc(16, 249902, 103);
      hc(16, 249906, 102);
      hc(16, 249910, 101);
      hc(16, 249914, 100);
      hc(16, 249918, 99);
      hc(16, 249922, 98);
      hc(16, 249926, 97);
      hc(16, 249930, 96);
      hc(16, 249942, 95);
      hc(16, 249955, 94);
      hc(16, 249963, 93);
      hc(16, 249978, 92);
      hc(16, 249990, 91);
      hc(16, 250004, 64);
      hc(16, 250009, 63);
      hc(16, 250020, 62);
      hc(16, 250030, 61);
      hc(16, 250039, 60);
      hc(16, 250046, 59);
      hc(16, 250058, 58);
      hc(16, 250066, 57);
      hc(16, 250070, 56);
      hc(16, 250074, 55);
      hc(16, 250078, 54);
      hc(16, 250082, 53);
      hc(16, 250086, 52);
      hc(16, 250090, 51);
      hc(16, 250094, 50);
      hc(16, 250098, 49);
      hc(16, 250102, 48);
      hc(16, 250106, 47);
      hc(16, 250114, 46);
      hc(16, 250123, 45);
      hc(16, 250131, 44);
      hc(16, 250139, 43);
      hc(16, 250146, 42);
      hc(16, 250157, 41);
      hc(16, 250170, 40);
      hc(16, 250182, 39);
      hc(16, 250190, 38);
      hc(16, 250202, 36);
      hc(16, 250211, 35);
      hc(16, 250218, 34);
      hc(16, 250229, 33);
      hc(16, 250239, 32);
      hc(16, 250247, 27);
      hc(16, 250256, 19);
      hc(16, 250264, 13);
      hc(16, 250273, 12);
      hc(16, 250281, 9);
      hc(16, 250287, 8);
      hc(16, 250299, 0);
      hc(16, 250307, 0);
      mc(24, 250317, 4, 0);
      hc(24, 250321, 2147483647);
      hc(24, 250331, 64);
      hc(24, 250345, 32);
      hc(24, 250358, 16);
      hc(24, 250370, 8);
      hc(24, 250379, 4);
      hc(24, 250387, 2);
      hc(24, 250396, 1);
      hc(24, 250406, 0);
      mc(32, 250415, 4, 0);
      hc(32, 250425, 2147483647);
      hc(32, 250435, 3);
      hc(32, 250445, 2);
      hc(32, 250454, 1);
      hc(32, 250463, 0);
      mc(40, 250473, 4, 0);
      hc(40, 250487, 2147483647);
      hc(40, 250500, 1);
      hc(40, 250529, 0);
      mc(48, 250557, 4, 0);
      hc(48, 250571, 2147483647);
      hc(48, 250591, 1);
      hc(48, 250621, 0);
      mc(56, 250650, 4, 0);
      hc(56, 250664, 2147483647);
      hc(56, 250677, 1);
      hc(56, 250689, 0);
      mc(64, 250703, 4, 0);
      hc(64, 250719, 2147483647);
      hc(64, 250736, 5);
      hc(64, 250764, 4);
      hc(64, 250785, 3);
      hc(64, 250808, 2);
      hc(64, 250829, 1);
      hc(64, 250847, 0);
      mc(72, 250863, 4, 0);
      hc(72, 250876, 2147483647);
      hc(72, 250897, 2);
      hc(72, 250917, 1);
      hc(72, 250939, 0);
      gc(250961, 1, 552, 250966, 51, 43);
      gc(250969, 1, 552, 250966, 51, 44);
      gc(250976, 1, 556, 250988, 42, 42);
      gc(250991, 1, 552, 250966, 51, 45);
      gc(250997, 1, 552, 250966, 51, 46);
      gc(251001, 1, 552, 250966, 51, 47);
      gc(251013, 1, 556, 250988, 42, 43);
      gc(251024, 1, 552, 250966, 51, 48);
      gc(251036, 2, 560, 251052, 44, 43);
      gc(251056, 1, 556, 250988, 42, 44);
      gc(251071, 3, 568, 251098, 42, 43);
      return ;
    }
    function Qc(a) {
      a = a | 0;
      Ac[a & 63]();
      return ;
    }
    function Rc(a) {
      a = a | 0;
      return vc[a & 63]() | 0;
    }
    function Sc(a, b) {
      a = a | 0;
      b = b | 0;
      return yc[a & 63](b) | 0;
    }
    function Tc(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      xc[a & 63](b, c);
      return ;
    }
    function Uc() {
      Pc(0);
      return ;
    }
    function Vc(a) {
      a = a | 0;
      var b = 0,
          c = 0.0,
          d = 0.0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          j = 0,
          m = 0,
          n = 0,
          o = 0,
          q = 0.0;
      g = (l[252742] | 0) << 8 | (l[252743] | 0) | (l[252741] | 0) << 16;
      b = i[252734] | 0;
      f = l[252744] | 0;
      if ((f & 144 | 0) == 144)
        e = (af() | 0) % 2 | 0;
      else
        e = 0;
      o = (b & 4) != 0;
      a: do
        if (!(f & 16)) {
          b = g;
          f = 0;
          while (1) {
            m = b & 1 ^ e;
            n = 0;
            while (1) {
              if ((f | 0) >= 1056)
                break a;
              g = l[253330 + ((k[297] | 0) != 0 ? (f | 0) / 3 | 0 : 499) >> 0] | 0;
              h = (g & 128 | 0) != 0;
              if (h)
                j = ia(g << 4 & 240, m) | 0;
              else
                j = 0;
              e = f + 1 | 0;
              i[a + f >> 0] = j;
              n = n + 1 | 0;
              if ((n | 0) >= (((g & 32 | 0) != 0 ? 11 : 44) | 0))
                break;
              else
                f = e;
            }
            f = b >>> 1;
            if (!(g & 64))
              b = f;
            else
              b = b << 23 & 8388608 | f;
            if ((k[145] | 0) != 0 | o & h ^ 1) {
              f = e;
              e = 0;
              continue;
            }
            k[145] = 1;
            _c();
            f = e;
            e = 0;
          }
        } else {
          f = g;
          g = 0;
          while (1) {
            j = f & 1 ^ e;
            n = 0;
            while (1) {
              if ((g | 0) >= 1056)
                break a;
              h = l[253330 + ((k[297] | 0) != 0 ? (g | 0) / 3 | 0 : 499) >> 0] | 0;
              b = (h & 128 | 0) != 0;
              if (b)
                e = ia(h << 4 & 240, j) | 0;
              else
                e = 0;
              m = g + 1 | 0;
              i[a + g >> 0] = e;
              n = n + 1 | 0;
              if ((n | 0) >= (((h & 32 | 0) != 0 ? 11 : 44) | 0)) {
                g = m;
                break;
              } else
                g = m;
            }
            e = f >>> 1;
            if (!(h & 64))
              f = e;
            else
              f = f << 23 & 8388608 | e;
            if (!b) {
              e = 0;
              continue;
            }
            e = (af() | 0) % 2 | 0;
            if ((k[145] | 0) != 0 | o & b ^ 1)
              continue;
            k[145] = 1;
            _c();
          }
        }
 while (0);
      if (!(k[315] | 0))
        return ;
      vf(298600, a | 0, 1056) | 0;
      f = 0;
      do {
        if (!f)
          b = (l[298600] | 0) - (l[299656] | 0) | 0;
        else
          b = (l[298600 + f >> 0] | 0) - (l[298600 + (f + -1) >> 0] | 0) | 0;
        if (!b)
          d = +p[10];
        else {
          d = +(b | 0);
          p[10] = d;
        }
        q = d * .25;
        c = +p[11];
        c = c + (q - c / 80.0);
        p[11] = c;
        p[10] = d - q;
        if (c > 255.0 | c < -255.0) {
          p[11] = 0.0;
          c = 0.0;
        }
        i[a + f >> 0] = ~~((c + 255.0) * .5);
        f = f + 1 | 0;
      } while ((f | 0) != 1056);
      i[299656] = i[299655] | 0;
      return ;
    }
    function Wc() {
      Vc(297544);
      return ;
    }
    function Xc() {
      k[145] = 0;
      if (!(k[310] | k[305]))
        return ;
      Ya(299657) | 0;
      if (!(k[305] | 0))
        return ;
      p[10] = 0.0;
      p[11] = 0.0;
      i[299656] = 0;
      return ;
    }
    function Yc() {
      k[305] = 0;
      return ;
    }
    function Zc() {
      j[3202] = 0;
      i[251277] = 8;
      i[251283] = 0;
      i[251279] = -1;
      i[251278] = -1;
      i[251284] = 0;
      i[251287] = 0;
      i[251286] = 0;
      j[3205] = 0;
      j[3204] = 0;
      i[251274] = 0;
      i[251275] = 0;
      i[251273] = 0;
      i[251281] = 0;
      i[251280] = 0;
      i[251290] = 0;
      i[251288] = 0;
      i[251289] = 0;
      return ;
    }
    function _c() {
      var a = 0,
          b = 0,
          c = 0,
          d = 0,
          e = 0;
      k[464] = 5;
      b = i[251288] | 0;
      if (!(b << 24 >> 24 == 0 | (i[251290] | 0) != 0)) {
        i[251290] = 1;
        i[251280] = 0;
        k[146] = (k[146] | 0) + 2;
        a = i[251277] | 0;
        e = a & 255;
        c = (e + 504 | 0) >>> 1 | (l[251286] | l[251287] << 7 | l[251284] | l[251283] | 8);
        i[251276] = c;
        d = j[3202] | 0;
        a = a + 1 << 24 >> 24;
        i[251277] = a;
        i[254088 + e >> 0] = d;
        if ((a & 255) > 23) {
          i[251277] = 8;
          a = 8;
        }
        e = a + 1 << 24 >> 24;
        i[251277] = e;
        i[254088 + (a & 255) >> 0] = (d & 65535) >>> 8 & 15 | c & 240;
        if ((e & 255) > 23)
          i[251277] = 8;
        j[3202] = 3;
        j[3205] = j[3204] | 0;
        j[3204] = 0;
      }
      if ((k[291] | 0) == 0 | b << 24 >> 24 != 0)
        return ;
      i[251280] = 1;
      return ;
    }
    function $c() {
      var a = 0,
          b = 0,
          c = 0,
          d = 0,
          e = 0;
      b = i[251289] | 0;
      if (!(b << 24 >> 24 == 0 | (i[251290] | 0) != 0)) {
        i[251290] = 2;
        i[251281] = 0;
        k[146] = (k[146] | 0) + 2;
        a = i[251277] | 0;
        e = a & 255;
        c = (e + 504 | 0) >>> 1 | (l[251286] | l[251287] << 7 | l[251284] | l[251283] | 8);
        i[251276] = c;
        d = j[3202] | 0;
        a = a + 1 << 24 >> 24;
        i[251277] = a;
        i[254088 + e >> 0] = d;
        if ((a & 255) > 23) {
          i[251277] = 8;
          a = 8;
        }
        e = a + 1 << 24 >> 24;
        i[251277] = e;
        i[254088 + (a & 255) >> 0] = (d & 65535) >>> 8 & 15 | c & 240;
        if ((e & 255) > 23)
          i[251277] = 8;
        j[3202] = 7;
        j[3205] = j[3204] | 0;
        j[3204] = 0;
      }
      if ((k[291] | 0) == 0 | b << 24 >> 24 != 0)
        return ;
      i[251281] = 1;
      return ;
    }
    function ad() {
      var a = 0,
          b = 0,
          c = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0;
      p = r;
      r = r + 32 | 0;
      h = p + 24 | 0;
      o = p + 16 | 0;
      n = p + 8 | 0;
      g = p;
      if ((k[465] | 0) != 1) {
        r = p;
        return ;
      }
      e = j[3202] | 0;
      while (1) {
        k[146] = 0;
        j[3203] = e;
        b = e + 1 << 16 >> 16;
        j[3202] = b;
        a = k[462] | 0;
        a: do
          switch (l[a + (e & 4095) >> 0] | 0) {
            case 196:
              {
                j[3202] = l[a + (b & 4095) >> 0] | m[3204] | 1536;
                k[146] = 2;
                break;
              }
            case 212:
              {
                c = i[251277] | 0;
                q = c & 255;
                d = (q + 504 | 0) >>> 1 | (l[251286] | l[251287] << 7 | l[251284] | l[251283] | 8);
                i[251276] = d;
                a = (l[a + (b & 4095) >> 0] | m[3204] | 1536) & 65535;
                b = e + 2 << 16 >> 16;
                j[3202] = b;
                k[146] = 2;
                c = c + 1 << 24 >> 24;
                i[251277] = c;
                i[254088 + q >> 0] = b;
                if ((c & 255) > 23) {
                  i[251277] = 8;
                  c = 8;
                }
                q = c + 1 << 24 >> 24;
                i[251277] = q;
                i[254088 + (c & 255) >> 0] = (b & 65535) >>> 8 & 15 | d & 240;
                if ((q & 255) > 23)
                  i[251277] = 8;
                j[3202] = a;
                break;
              }
            case 243:
              {
                k[146] = 1;
                break;
              }
            case 245:
              {
                if (!(i[251290] | 0))
                  j[3204] = 2048;
                j[3205] = 2048;
                k[146] = 1;
                break;
              }
            case 251:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 3) >> 0] | 0;
                break;
              }
            case 252:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 4) >> 0] | 0;
                break;
              }
            case 253:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 5) >> 0] | 0;
                break;
              }
            case 25:
              {
                q = 254088 + ((l[251273] | 0) + 1) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + 1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 107:
              {
                k[146] = 1;
                i[251286] = 0;
                i[251287] = 0;
                b = l[251271] | 0;
                a = l[254088 + ((l[251273] | 0) + 3) >> 0] | 0;
                if (((b & 15) + (a & 15) | 0) > 15)
                  i[251286] = 64;
                a = b + a | 0;
                if ((a | 0) > 255)
                  i[251287] = 1;
                i[251271] = a;
                break;
              }
            case 138:
              {
                q = i[251279] | 0;
                j[3202] = e + 2 << 16 >> 16;
                i[251279] = i[a + (b & 4095) >> 0] | q;
                k[146] = 2;
                break;
              }
            case 139:
              {
                k[146] = 1;
                break;
              }
            case 140:
              {
                Jd(0, Id(0) | 0 | i[251271]);
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 57:
              {
                k[146] = 2;
                wd(i[251271] | 0);
                break;
              }
            case 58:
              {
                k[146] = 2;
                i[251279] = i[251271] | 0;
                break;
              }
            case 26:
              {
                q = 254088 + ((l[251273] | 0) + 2) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + 1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 84:
              {
                c = i[251277] | 0;
                q = c & 255;
                d = (q + 504 | 0) >>> 1 | (l[251286] | l[251287] << 7 | l[251284] | l[251283] | 8);
                i[251276] = d;
                a = (l[a + (b & 4095) >> 0] | m[3204] | 512) & 65535;
                b = e + 2 << 16 >> 16;
                j[3202] = b;
                k[146] = 2;
                c = c + 1 << 24 >> 24;
                i[251277] = c;
                i[254088 + q >> 0] = b;
                if ((c & 255) > 23) {
                  i[251277] = 8;
                  c = 8;
                }
                q = c + 1 << 24 >> 24;
                i[251277] = q;
                i[254088 + (c & 255) >> 0] = (b & 65535) >>> 8 & 15 | d & 240;
                if ((q & 255) > 23)
                  i[251277] = 8;
                j[3202] = a;
                break;
              }
            case 53:
              {
                i[251289] = 0;
                i[251281] = 0;
                k[146] = 1;
                break;
              }
            case 33:
              {
                k[146] = 1;
                e = i[251271] | 0;
                q = 254088 + (l[254088 + ((l[251273] | 0) + 1) >> 0] & 63) | 0;
                i[251271] = i[q >> 0] | 0;
                i[q >> 0] = e;
                break;
              }
            case 35:
              {
                k[146] = 2;
                j[3202] = e + 2 << 16 >> 16;
                i[251271] = i[a + (b & 4095) >> 0] | 0;
                break;
              }
            case 34:
              {
                k[146] = 1;
                break;
              }
            case 28:
              {
                q = 254088 + ((l[251273] | 0) + 4) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + 1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 27:
              {
                q = 254088 + ((l[251273] | 0) + 3) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + 1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 56:
              {
                k[146] = 1;
                break;
              }
            case 83:
              {
                k[146] = 2;
                q = i[251271] | 0;
                j[3202] = e + 2 << 16 >> 16;
                i[251271] = i[a + (b & 4095) >> 0] & q;
                break;
              }
            case 62:
              {
                k[146] = 2;
                Jd(2, i[251271] | 0);
                break;
              }
            case 55:
              {
                i[251271] = l[251271] ^ 255;
                k[146] = 1;
                break;
              }
            case 66:
              {
                k[146] = 1;
                i[251271] = i[251272] | 0;
                break;
              }
            case 54:
              {
                k[146] = 2;
                b = i[a + (b & 4095) >> 0] | 0;
                q = (Fd() | 0) == 0;
                a = j[3202] | 0;
                if (q) {
                  j[3202] = a + 1 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = a & 3840 | b & 255;
                  break a;
                }
              }
            case 63:
              {
                k[146] = 2;
                Jd(3, i[251271] | 0);
                break;
              }
            case 60:
              {
                k[146] = 2;
                Jd(0, i[251271] | 0);
                break;
              }
            case 61:
              {
                k[146] = 2;
                Jd(1, i[251271] | 0);
                break;
              }
            case 85:
              {
                i[251274] = 1;
                k[146] = 1;
                break;
              }
            case 59:
              {
                k[146] = 1;
                break;
              }
            case 38:
              {
                k[146] = 2;
                b = i[a + (b & 4095) >> 0] | 0;
                q = (Fd() | 0) == 0;
                a = j[3202] | 0;
                if (q) {
                  j[3202] = a & 3840 | b & 255;
                  break a;
                } else {
                  j[3202] = a + 1 << 16 >> 16;
                  break a;
                }
              }
            case 37:
              {
                i[251289] = 1;
                k[146] = 1;
                break;
              }
            case 36:
              {
                j[3202] = l[a + (b & 4095) >> 0] | m[3204] | 256;
                k[146] = 2;
                break;
              }
            case 29:
              {
                q = 254088 + ((l[251273] | 0) + 5) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + 1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 32:
              {
                k[146] = 1;
                e = i[251271] | 0;
                q = 254088 + (l[254088 + (l[251273] | 0) >> 0] & 63) | 0;
                i[251271] = i[q >> 0] | 0;
                i[q >> 0] = e;
                break;
              }
            case 86:
              {
                k[146] = 2;
                b = i[a + (b & 4095) >> 0] | 0;
                q = (vd() | 0) << 24 >> 24 == 0;
                a = j[3202] | 0;
                if (q) {
                  j[3202] = a + 1 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = a & 3840 | b & 255;
                  break a;
                }
              }
            case 87:
              {
                k[146] = 1;
                b = i[251271] | 0;
                a = b & 255;
                if (!((i[251286] | 0) == 0 & (a & 14) >>> 0 < 10)) {
                  if ((b & 255) > 249)
                    i[251287] = 1;
                  b = a + 6 & 255;
                  i[251271] = b;
                }
                a = (b & 255) >>> 4;
                if (!((b & 255) < 160 & (i[251287] | 0) == 0)) {
                  i[251287] = 1;
                  a = (a & 255) + 6 & 255;
                }
                i[251271] = b & 15 | (a & 255) << 4;
                break;
              }
            case 88:
              {
                k[146] = 1;
                i[251271] = i[254088 + (l[251273] | 0) >> 0] & i[251271];
                break;
              }
            case 89:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 1) >> 0] & i[251271];
                break;
              }
            case 94:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 6) >> 0] & i[251271];
                break;
              }
            case 103:
              {
                q = i[251287] | 0;
                a = i[251271] | 0;
                i[251287] = a & 1;
                a = (a & 255) >>> 1;
                i[251271] = a;
                if (q << 24 >> 24)
                  a = (a & 255 | 128) & 255;
                i[251271] = a;
                k[146] = 1;
                break;
              }
            case 109:
              {
                k[146] = 1;
                i[251286] = 0;
                i[251287] = 0;
                b = l[251271] | 0;
                a = l[254088 + ((l[251273] | 0) + 5) >> 0] | 0;
                if (((b & 15) + (a & 15) | 0) > 15)
                  i[251286] = 64;
                a = b + a | 0;
                if ((a | 0) > 255)
                  i[251287] = 1;
                i[251271] = a;
                break;
              }
            case 110:
              {
                k[146] = 1;
                i[251286] = 0;
                i[251287] = 0;
                b = l[251271] | 0;
                a = l[254088 + ((l[251273] | 0) + 6) >> 0] | 0;
                if (((b & 15) + (a & 15) | 0) > 15)
                  i[251286] = 64;
                a = b + a | 0;
                if ((a | 0) > 255)
                  i[251287] = 1;
                i[251271] = a;
                break;
              }
            case 111:
              {
                k[146] = 1;
                i[251286] = 0;
                i[251287] = 0;
                b = l[251271] | 0;
                a = l[254088 + ((l[251273] | 0) + 7) >> 0] | 0;
                if (((b & 15) + (a & 15) | 0) > 15)
                  i[251286] = 64;
                a = b + a | 0;
                if ((a | 0) > 255)
                  i[251287] = 1;
                i[251271] = a;
                break;
              }
            case 112:
              {
                k[146] = 1;
                i[251286] = 0;
                c = l[251271] | 0;
                b = l[254088 + (l[254088 + (l[251273] | 0) >> 0] & 63) >> 0] | 0;
                a = l[251287] | 0;
                if (((c & 15) + (b & 15) + a | 0) > 15)
                  i[251286] = 64;
                q = c + b + a | 0;
                i[251287] = (q | 0) > 255 & 1;
                i[251271] = q;
                break;
              }
            case 115:
              {
                k[146] = 1;
                break;
              }
            case 124:
              {
                k[146] = 1;
                i[251286] = 0;
                c = l[251271] | 0;
                b = l[254088 + ((l[251273] | 0) + 4) >> 0] | 0;
                a = l[251287] | 0;
                if (((c & 15) + (b & 15) + a | 0) > 15)
                  i[251286] = 64;
                q = c + b + a | 0;
                i[251287] = (q | 0) > 255 & 1;
                i[251271] = q;
                break;
              }
            case 125:
              {
                k[146] = 1;
                i[251286] = 0;
                c = l[251271] | 0;
                b = l[254088 + ((l[251273] | 0) + 5) >> 0] | 0;
                a = l[251287] | 0;
                if (((c & 15) + (b & 15) + a | 0) > 15)
                  i[251286] = 64;
                q = c + b + a | 0;
                i[251287] = (q | 0) > 255 & 1;
                i[251271] = q;
                break;
              }
            case 126:
              {
                k[146] = 1;
                i[251286] = 0;
                c = l[251271] | 0;
                b = l[254088 + ((l[251273] | 0) + 6) >> 0] | 0;
                a = l[251287] | 0;
                if (((c & 15) + (b & 15) + a | 0) > 15)
                  i[251286] = 64;
                q = c + b + a | 0;
                i[251287] = (q | 0) > 255 & 1;
                i[251271] = q;
                break;
              }
            case 131:
              {
                k[146] = 2;
                q = (i[251277] | 0) + -1 << 24 >> 24;
                q = (q & 255) < 8 ? 23 : q;
                e = l[254088 + (q & 255) >> 0] << 8 & 3840;
                q = q + -1 << 24 >> 24;
                q = (q & 255) < 8 ? 23 : q;
                i[251277] = q;
                j[3202] = e | l[254088 + (q & 255) >> 0];
                break;
              }
            case 132:
              {
                j[3202] = l[a + (b & 4095) >> 0] | m[3204] | 1024;
                k[146] = 2;
                break;
              }
            case 133:
              {
                k[146] = 1;
                i[251284] = 0;
                break;
              }
            case 134:
              {
                k[146] = 2;
                c = b & 65535;
                if ((k[464] | 0) > 0) {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                } else {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                }
              }
            case 135:
              {
                k[146] = 1;
                break;
              }
            case 136:
              {
                k[146] = 2;
                k[o >> 2] = 136;
                k[o + 4 >> 2] = b & 65535;
                kb(299686, o | 0) | 0;
                break;
              }
            case 137:
              {
                q = i[251278] | 0;
                j[3202] = e + 2 << 16 >> 16;
                wd(i[a + (b & 4095) >> 0] | q);
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 155:
              {
                k[146] = 1;
                break;
              }
            case 156:
              {
                Jd(0, (Id(0) | 0) & i[251271]);
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 157:
              {
                Jd(1, (Id(1) | 0) & i[251271]);
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 158:
              {
                Jd(2, (Id(2) | 0) & i[251271]);
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 159:
              {
                Jd(3, (Id(3) | 0) & i[251271]);
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 160:
              {
                i[254088 + (l[254088 + (l[251273] | 0) >> 0] & 63) >> 0] = i[251271] | 0;
                k[146] = 1;
                break;
              }
            case 161:
              {
                i[254088 + (l[254088 + ((l[251273] | 0) + 1) >> 0] & 63) >> 0] = i[251271] | 0;
                k[146] = 1;
                break;
              }
            case 162:
              {
                k[146] = 1;
                break;
              }
            case 163:
              {
                i[251271] = i[a + (l[251271] | b & 3840) >> 0] | 0;
                k[146] = 2;
                break;
              }
            case 170:
              {
                i[254088 + ((l[251273] | 0) + 2) >> 0] = i[251271] | 0;
                k[146] = 1;
                break;
              }
            case 171:
              {
                i[254088 + ((l[251273] | 0) + 3) >> 0] = i[251271] | 0;
                k[146] = 1;
                break;
              }
            case 172:
              {
                i[254088 + ((l[251273] | 0) + 4) >> 0] = i[251271] | 0;
                k[146] = 1;
                break;
              }
            case 173:
              {
                i[254088 + ((l[251273] | 0) + 5) >> 0] = i[251271] | 0;
                k[146] = 1;
                break;
              }
            case 181:
              {
                i[251285] = l[251285] ^ 1;
                k[146] = 1;
                break;
              }
            case 182:
              {
                k[146] = 2;
                c = b & 65535;
                if (!(i[251284] | 0)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 183:
              {
                k[146] = 1;
                break;
              }
            case 184:
              {
                j[3202] = e + 2 << 16 >> 16;
                i[254088 + (l[251273] | 0) >> 0] = i[a + (b & 4095) >> 0] | 0;
                k[146] = 2;
                break;
              }
            case 185:
              {
                j[3202] = e + 2 << 16 >> 16;
                i[254088 + ((l[251273] | 0) + 1) >> 0] = i[a + (b & 4095) >> 0] | 0;
                k[146] = 2;
                break;
              }
            case 186:
              {
                j[3202] = e + 2 << 16 >> 16;
                i[254088 + ((l[251273] | 0) + 2) >> 0] = i[a + (b & 4095) >> 0] | 0;
                k[146] = 2;
                break;
              }
            case 187:
              {
                j[3202] = e + 2 << 16 >> 16;
                i[254088 + ((l[251273] | 0) + 3) >> 0] = i[a + (b & 4095) >> 0] | 0;
                k[146] = 2;
                break;
              }
            case 188:
              {
                j[3202] = e + 2 << 16 >> 16;
                i[254088 + ((l[251273] | 0) + 4) >> 0] = i[a + (b & 4095) >> 0] | 0;
                k[146] = 2;
                break;
              }
            case 189:
              {
                j[3202] = e + 2 << 16 >> 16;
                i[254088 + ((l[251273] | 0) + 5) >> 0] = i[a + (b & 4095) >> 0] | 0;
                k[146] = 2;
                break;
              }
            case 190:
              {
                j[3202] = e + 2 << 16 >> 16;
                i[254088 + ((l[251273] | 0) + 6) >> 0] = i[a + (b & 4095) >> 0] | 0;
                k[146] = 2;
                break;
              }
            case 192:
              {
                k[146] = 1;
                break;
              }
            case 191:
              {
                j[3202] = e + 2 << 16 >> 16;
                i[254088 + ((l[251273] | 0) + 7) >> 0] = i[a + (b & 4095) >> 0] | 0;
                k[146] = 2;
                break;
              }
            case 193:
              {
                k[146] = 1;
                break;
              }
            case 194:
              {
                k[146] = 1;
                break;
              }
            case 195:
              {
                k[146] = 1;
                break;
              }
            case 199:
              {
                k[146] = 1;
                q = (((l[251277] | 0) + 504 | 0) >>> 1 | (l[251286] | l[251287] << 7 | l[251284] | l[251283] | 8)) & 255;
                i[251276] = q;
                i[251271] = q;
                break;
              }
            case 200:
              {
                q = 254088 + (l[251273] | 0) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + -1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 201:
              {
                q = 254088 + ((l[251273] | 0) + 1) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + -1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 202:
              {
                q = 254088 + ((l[251273] | 0) + 2) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + -1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 203:
              {
                q = 254088 + ((l[251273] | 0) + 3) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + -1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 204:
              {
                q = 254088 + ((l[251273] | 0) + 4) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + -1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 205:
              {
                q = 254088 + ((l[251273] | 0) + 5) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + -1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 207:
              {
                q = 254088 + ((l[251273] | 0) + 7) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + -1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 208:
              {
                i[251271] = i[254088 + (l[254088 + (l[251273] | 0) >> 0] & 63) >> 0] ^ i[251271];
                k[146] = 1;
                break;
              }
            case 213:
              {
                i[251283] = 16;
                i[251273] = 24;
                k[146] = 1;
                break;
              }
            case 214:
              {
                k[146] = 1;
                break;
              }
            case 215:
              {
                q = i[251271] | 0;
                i[251276] = q;
                k[146] = 1;
                i[251287] = (q & 255) >>> 7;
                q = q & 255;
                i[251286] = q & 64;
                i[251284] = q & 32;
                e = q & 16;
                i[251283] = e;
                i[251273] = e << 24 >> 24 == 0 ? 0 : 24;
                i[251277] = (q << 1 & 14) + 8;
                break;
              }
            case 238:
              {
                k[146] = 2;
                c = 254088 + ((l[251273] | 0) + 6) | 0;
                q = (i[c >> 0] | 0) + -1 << 24 >> 24;
                i[c >> 0] = q;
                c = b & 65535;
                if (!(q << 24 >> 24)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 239:
              {
                k[146] = 2;
                c = 254088 + ((l[251273] | 0) + 7) | 0;
                q = (i[c >> 0] | 0) + -1 << 24 >> 24;
                i[c >> 0] = q;
                c = b & 65535;
                if (!(q << 24 >> 24)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 246:
              {
                k[146] = 2;
                c = b & 65535;
                if (!(i[251287] | 0)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 247:
              {
                q = i[251287] | 0;
                e = i[251271] | 0;
                i[251287] = (e & 255) >>> 7;
                i[251271] = (e & 255) << 1 | q << 24 >> 24 != 0;
                k[146] = 1;
                break;
              }
            case 255:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 7) >> 0] | 0;
                break;
              }
            case 80:
              {
                i[251271] = i[254088 + (l[254088 + (l[251273] | 0) >> 0] & 63) >> 0] & i[251271];
                k[146] = 1;
                break;
              }
            case 81:
              {
                i[251271] = i[254088 + (l[254088 + ((l[251273] | 0) + 1) >> 0] & 63) >> 0] & i[251271];
                k[146] = 1;
                break;
              }
            case 82:
              {
                k[146] = 2;
                c = b & 65535;
                if (!(i[251271] & 4)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 24:
              {
                q = 254088 + (l[251273] | 0) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + 1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 30:
              {
                q = 254088 + ((l[251273] | 0) + 6) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + 1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 31:
              {
                q = 254088 + ((l[251273] | 0) + 7) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + 1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 65:
              {
                k[146] = 1;
                i[251271] = i[254088 + (l[254088 + ((l[251273] | 0) + 1) >> 0] & 63) >> 0] | i[251271];
                break;
              }
            case 67:
              {
                k[146] = 2;
                q = i[251271] | 0;
                j[3202] = e + 2 << 16 >> 16;
                i[251271] = i[a + (b & 4095) >> 0] | q;
                break;
              }
            case 69:
              {
                i[251275] = 1;
                k[146] = 1;
                break;
              }
            case 68:
              {
                j[3202] = l[a + (b & 4095) >> 0] | m[3204] | 512;
                k[146] = 2;
                break;
              }
            case 70:
              {
                k[146] = 2;
                b = i[a + (b & 4095) >> 0] | 0;
                q = (vd() | 0) << 24 >> 24 == 0;
                a = j[3202] | 0;
                if (q) {
                  j[3202] = a & 3840 | b & 255;
                  break a;
                } else {
                  j[3202] = a + 1 << 16 >> 16;
                  break a;
                }
              }
            case 71:
              {
                k[146] = 1;
                q = i[251271] | 0;
                i[251271] = (q & 255) << 4 | (q & 255) >>> 4 & 255;
                break;
              }
            case 72:
              {
                k[146] = 1;
                i[251271] = i[254088 + (l[251273] | 0) >> 0] | i[251271];
                break;
              }
            case 73:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 1) >> 0] | i[251271];
                break;
              }
            case 74:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 2) >> 0] | i[251271];
                break;
              }
            case 75:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 3) >> 0] | i[251271];
                break;
              }
            case 76:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 4) >> 0] | i[251271];
                break;
              }
            case 77:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 5) >> 0] | i[251271];
                break;
              }
            case 78:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 6) >> 0] | i[251271];
                break;
              }
            case 79:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 7) >> 0] | i[251271];
                break;
              }
            case 90:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 2) >> 0] & i[251271];
                break;
              }
            case 93:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 5) >> 0] & i[251271];
                break;
              }
            case 95:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 7) >> 0] & i[251271];
                break;
              }
            case 98:
              {
                k[146] = 1;
                i[251272] = i[251271] | 0;
                break;
              }
            case 99:
              {
                k[146] = 1;
                break;
              }
            case 101:
              {
                k[146] = 1;
                i[251274] = 0;
                i[251275] = 0;
                break;
              }
            case 100:
              {
                j[3202] = l[a + (b & 4095) >> 0] | m[3204] | 768;
                k[146] = 2;
                break;
              }
            case 102:
              {
                k[146] = 1;
                break;
              }
            case 104:
              {
                k[146] = 1;
                i[251286] = 0;
                i[251287] = 0;
                b = l[251271] | 0;
                a = l[254088 + (l[251273] | 0) >> 0] | 0;
                if (((b & 15) + (a & 15) | 0) > 15)
                  i[251286] = 64;
                a = b + a | 0;
                if ((a | 0) > 255)
                  i[251287] = 1;
                i[251271] = a;
                break;
              }
            case 106:
              {
                k[146] = 1;
                i[251286] = 0;
                i[251287] = 0;
                b = l[251271] | 0;
                a = l[254088 + ((l[251273] | 0) + 2) >> 0] | 0;
                if (((b & 15) + (a & 15) | 0) > 15)
                  i[251286] = 64;
                a = b + a | 0;
                if ((a | 0) > 255)
                  i[251287] = 1;
                i[251271] = a;
                break;
              }
            case 119:
              {
                k[146] = 1;
                q = i[251271] | 0;
                a = (q & 255) >>> 1;
                i[251271] = a;
                if (!(q & 1)) {
                  i[251271] = a;
                  break a;
                } else {
                  i[251271] = a & 255 | 128;
                  break a;
                }
              }
            case 120:
              {
                k[146] = 1;
                i[251286] = 0;
                b = l[251271] | 0;
                a = l[254088 + (l[251273] | 0) >> 0] | 0;
                c = l[251287] | 0;
                if (((b & 15) + (a & 15) + c | 0) > 15)
                  i[251286] = 64;
                q = b + a + c | 0;
                i[251287] = (q | 0) > 255 & 1;
                i[251271] = q;
                break;
              }
            case 121:
              {
                k[146] = 1;
                i[251286] = 0;
                c = l[251271] | 0;
                b = l[254088 + ((l[251273] | 0) + 1) >> 0] | 0;
                a = l[251287] | 0;
                if (((c & 15) + (b & 15) + a | 0) > 15)
                  i[251286] = 64;
                q = c + b + a | 0;
                i[251287] = (q | 0) > 255 & 1;
                i[251271] = q;
                break;
              }
            case 122:
              {
                k[146] = 1;
                i[251286] = 0;
                c = l[251271] | 0;
                b = l[254088 + ((l[251273] | 0) + 2) >> 0] | 0;
                a = l[251287] | 0;
                if (((c & 15) + (b & 15) + a | 0) > 15)
                  i[251286] = 64;
                q = c + b + a | 0;
                i[251287] = (q | 0) > 255 & 1;
                i[251271] = q;
                break;
              }
            case 123:
              {
                k[146] = 1;
                i[251286] = 0;
                c = l[251271] | 0;
                b = l[254088 + ((l[251273] | 0) + 3) >> 0] | 0;
                a = l[251287] | 0;
                if (((c & 15) + (b & 15) + a | 0) > 15)
                  i[251286] = 64;
                q = c + b + a | 0;
                i[251287] = (q | 0) > 255 & 1;
                i[251271] = q;
                break;
              }
            case 127:
              {
                k[146] = 1;
                i[251286] = 0;
                c = l[251271] | 0;
                b = l[254088 + ((l[251273] | 0) + 7) >> 0] | 0;
                a = l[251287] | 0;
                if (((c & 15) + (b & 15) + a | 0) > 15)
                  i[251286] = 64;
                q = c + b + a | 0;
                i[251287] = (q | 0) > 255 & 1;
                i[251271] = q;
                break;
              }
            case 128:
              {
                q = zd(l[254088 + (l[251273] | 0) >> 0] | 0) | 0;
                i[251271] = q;
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 130:
              {
                k[146] = 1;
                break;
              }
            case 129:
              {
                q = zd(l[254088 + ((l[251273] | 0) + 1) >> 0] | 0) | 0;
                i[251271] = q;
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 141:
              {
                Jd(1, Id(1) | 0 | i[251271]);
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 142:
              {
                Jd(2, Id(2) | 0 | i[251271]);
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 143:
              {
                Jd(3, Id(3) | 0 | i[251271]);
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 144:
              {
                Bd(i[251271] | 0, l[254088 + (l[251273] | 0) >> 0] | 0);
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 145:
              {
                Bd(i[251271] | 0, l[254088 + ((l[251273] | 0) + 1) >> 0] | 0);
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 146:
              {
                k[146] = 2;
                c = b & 65535;
                if (!(i[251271] & 16)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 147:
              {
                k[146] = 2;
                e = (i[251277] | 0) + -1 << 24 >> 24;
                e = (e & 255) < 8 ? 23 : e;
                d = i[254088 + (e & 255) >> 0] | 0;
                q = d & 255;
                i[251287] = (d & 255) >>> 7;
                i[251286] = q & 64;
                i[251284] = q & 32;
                d = q & 16;
                i[251283] = d;
                i[251273] = d << 24 >> 24 == 0 ? 0 : 24;
                e = e + -1 << 24 >> 24;
                e = (e & 255) < 8 ? 23 : e;
                i[251277] = e;
                j[3202] = l[254088 + (e & 255) >> 0] | q << 8 & 3840;
                i[251290] = 0;
                j[3204] = j[3205] | 0;
                break;
              }
            case 151:
              {
                i[251287] = 0;
                k[146] = 1;
                break;
              }
            case 149:
              {
                i[251284] = l[251284] ^ 32;
                k[146] = 1;
                break;
              }
            case 152:
              {
                k[146] = 2;
                k[h >> 2] = 152;
                k[h + 4 >> 2] = b & 65535;
                kb(299686, h | 0) | 0;
                break;
              }
            case 153:
              {
                q = i[251278] | 0;
                j[3202] = e + 2 << 16 >> 16;
                wd(i[a + (b & 4095) >> 0] & q);
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 154:
              {
                q = i[251279] | 0;
                j[3202] = e + 2 << 16 >> 16;
                i[251279] = i[a + (b & 4095) >> 0] & q;
                k[146] = 2;
                break;
              }
            case 165:
              {
                k[146] = 1;
                i[251285] = 0;
                break;
              }
            case 164:
              {
                j[3202] = l[a + (b & 4095) >> 0] | m[3204] | 1280;
                k[146] = 2;
                break;
              }
            case 166:
              {
                k[146] = 1;
                break;
              }
            case 167:
              {
                i[251287] = l[251287] ^ 1;
                k[146] = 1;
                break;
              }
            case 168:
              {
                i[254088 + (l[251273] | 0) >> 0] = i[251271] | 0;
                k[146] = 1;
                break;
              }
            case 169:
              {
                i[254088 + ((l[251273] | 0) + 1) >> 0] = i[251271] | 0;
                k[146] = 1;
                break;
              }
            case 175:
              {
                i[254088 + ((l[251273] | 0) + 7) >> 0] = i[251271] | 0;
                k[146] = 1;
                break;
              }
            case 176:
              {
                j[3202] = e + 2 << 16 >> 16;
                i[254088 + (l[254088 + (l[251273] | 0) >> 0] & 63) >> 0] = i[a + (b & 4095) >> 0] | 0;
                k[146] = 2;
                break;
              }
            case 177:
              {
                j[3202] = e + 2 << 16 >> 16;
                i[254088 + (l[254088 + ((l[251273] | 0) + 1) >> 0] & 63) >> 0] = i[a + (b & 4095) >> 0] | 0;
                k[146] = 2;
                break;
              }
            case 178:
              {
                k[146] = 2;
                c = b & 65535;
                if (!(i[251271] & 32)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 179:
              {
                q = b & 3840;
                j[3202] = l[a + (l[251271] | q) >> 0] | q;
                k[146] = 2;
                break;
              }
            case 180:
              {
                c = i[251277] | 0;
                q = c & 255;
                d = (q + 504 | 0) >>> 1 | (l[251286] | l[251287] << 7 | l[251284] | l[251283] | 8);
                i[251276] = d;
                a = (l[a + (b & 4095) >> 0] | m[3204] | 1280) & 65535;
                b = e + 2 << 16 >> 16;
                j[3202] = b;
                k[146] = 2;
                c = c + 1 << 24 >> 24;
                i[251277] = c;
                i[254088 + q >> 0] = b;
                if ((c & 255) > 23) {
                  i[251277] = 8;
                  c = 8;
                }
                q = c + 1 << 24 >> 24;
                i[251277] = q;
                i[254088 + (c & 255) >> 0] = (b & 65535) >>> 8 & 15 | d & 240;
                if ((q & 255) > 23)
                  i[251277] = 8;
                j[3202] = a;
                break;
              }
            case 209:
              {
                i[251271] = i[254088 + (l[254088 + ((l[251273] | 0) + 1) >> 0] & 63) >> 0] ^ i[251271];
                k[146] = 1;
                break;
              }
            case 210:
              {
                k[146] = 2;
                c = b & 65535;
                if (!(i[251271] & 64)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 219:
              {
                i[251271] = i[254088 + ((l[251273] | 0) + 3) >> 0] ^ i[251271];
                k[146] = 1;
                break;
              }
            case 220:
              {
                i[251271] = i[254088 + ((l[251273] | 0) + 4) >> 0] ^ i[251271];
                k[146] = 1;
                break;
              }
            case 222:
              {
                i[251271] = i[254088 + ((l[251273] | 0) + 6) >> 0] ^ i[251271];
                k[146] = 1;
                break;
              }
            case 221:
              {
                i[251271] = i[254088 + ((l[251273] | 0) + 5) >> 0] ^ i[251271];
                k[146] = 1;
                break;
              }
            case 223:
              {
                i[251271] = i[254088 + ((l[251273] | 0) + 7) >> 0] ^ i[251271];
                k[146] = 1;
                break;
              }
            case 224:
              {
                k[146] = 1;
                break;
              }
            case 225:
              {
                k[146] = 1;
                break;
              }
            case 226:
              {
                k[146] = 1;
                break;
              }
            case 227:
              {
                i[251271] = i[a + (l[251271] | 768) >> 0] | 0;
                k[146] = 2;
                break;
              }
            case 229:
              {
                j[3204] = 0;
                j[3205] = 0;
                k[146] = 1;
                break;
              }
            case 228:
              {
                j[3202] = l[a + (b & 4095) >> 0] | m[3204] | 1792;
                k[146] = 2;
                break;
              }
            case 230:
              {
                k[146] = 2;
                c = b & 65535;
                if (!(i[251287] | 0)) {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                } else {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                }
              }
            case 231:
              {
                k[146] = 1;
                q = l[251271] | 0;
                a = q << 1;
                b = a & 255;
                i[251271] = b;
                if (!(q & 128)) {
                  i[251271] = b;
                  break a;
                } else {
                  i[251271] = a | 1;
                  break a;
                }
              }
            case 237:
              {
                k[146] = 2;
                c = 254088 + ((l[251273] | 0) + 5) | 0;
                q = (i[c >> 0] | 0) + -1 << 24 >> 24;
                i[c >> 0] = q;
                c = b & 65535;
                if (!(q << 24 >> 24)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 240:
              {
                k[146] = 1;
                i[251271] = i[254088 + (l[254088 + (l[251273] | 0) >> 0] & 63) >> 0] | 0;
                break;
              }
            case 241:
              {
                k[146] = 1;
                i[251271] = i[254088 + (l[254088 + ((l[251273] | 0) + 1) >> 0] & 63) >> 0] | 0;
                break;
              }
            case 242:
              {
                k[146] = 2;
                c = b & 65535;
                if ((i[251271] | 0) < 0) {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                } else {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                }
              }
            case 248:
              {
                k[146] = 1;
                i[251271] = i[254088 + (l[251273] | 0) >> 0] | 0;
                break;
              }
            case 249:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 1) >> 0] | 0;
                break;
              }
            case 250:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 2) >> 0] | 0;
                break;
              }
            case 254:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 6) >> 0] | 0;
                break;
              }
            case 0:
              {
                k[146] = 1;
                break;
              }
            case 1:
              {
                k[146] = 1;
                break;
              }
            case 2:
              {
                k[146] = 2;
                k[g >> 2] = 2;
                k[g + 4 >> 2] = b & 65535;
                kb(299686, g | 0) | 0;
                break;
              }
            case 3:
              {
                k[146] = 2;
                i[251286] = 0;
                i[251287] = 0;
                j[3202] = e + 2 << 16 >> 16;
                c = l[251271] | 0;
                a = l[a + (b & 4095) >> 0] | 0;
                if (((c & 15) + (a & 15) | 0) > 15)
                  i[251286] = 64;
                a = c + a | 0;
                if ((a | 0) > 255)
                  i[251287] = 1;
                i[251271] = a;
                break;
              }
            case 6:
              {
                k[146] = 1;
                break;
              }
            case 4:
              {
                j[3202] = m[3204] | l[a + (b & 4095) >> 0];
                k[146] = 2;
                break;
              }
            case 5:
              {
                i[251288] = 1;
                k[146] = 1;
                break;
              }
            case 7:
              {
                i[251271] = (i[251271] | 0) + -1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 8:
              {
                k[146] = 2;
                q = Ad() | 0;
                i[251271] = q;
                break;
              }
            case 9:
              {
                i[251271] = i[251278] | 0;
                k[146] = 2;
                break;
              }
            case 10:
              {
                q = yd() | 0;
                i[251271] = q;
                k[146] = (k[146] | 0) + 2;
                break;
              }
            case 11:
              {
                k[146] = 1;
                break;
              }
            case 12:
              {
                k[146] = 2;
                q = Id(0) | 0;
                i[251271] = q;
                break;
              }
            case 13:
              {
                k[146] = 2;
                q = Id(1) | 0;
                i[251271] = q;
                break;
              }
            case 14:
              {
                k[146] = 2;
                q = Id(2) | 0;
                i[251271] = q;
                break;
              }
            case 15:
              {
                k[146] = 2;
                q = Id(3) | 0;
                i[251271] = q;
                break;
              }
            case 16:
              {
                q = 254088 + (l[254088 + (l[251273] | 0) >> 0] & 63) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + 1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 17:
              {
                q = 254088 + (l[254088 + ((l[251273] | 0) + 1) >> 0] & 63) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + 1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 18:
              {
                k[146] = 2;
                c = b & 65535;
                if (!(i[251271] & 1)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 19:
              {
                k[146] = 2;
                j[3202] = e + 2 << 16 >> 16;
                b = i[a + (b & 4095) >> 0] | 0;
                i[251286] = 0;
                c = l[251271] | 0;
                b = b & 255;
                a = l[251287] | 0;
                if (((c & 15) + (b & 15) + a | 0) > 15)
                  i[251286] = 64;
                q = c + b + a | 0;
                i[251287] = (q | 0) > 255 & 1;
                i[251271] = q;
                break;
              }
            case 20:
              {
                c = i[251277] | 0;
                q = c & 255;
                d = (q + 504 | 0) >>> 1 | (l[251286] | l[251287] << 7 | l[251284] | l[251283] | 8);
                i[251276] = d;
                a = (m[3204] | l[a + (b & 4095) >> 0]) & 65535;
                b = e + 2 << 16 >> 16;
                j[3202] = b;
                k[146] = 2;
                c = c + 1 << 24 >> 24;
                i[251277] = c;
                i[254088 + q >> 0] = b;
                if ((c & 255) > 23) {
                  i[251277] = 8;
                  c = 8;
                }
                q = c + 1 << 24 >> 24;
                i[251277] = q;
                i[254088 + (c & 255) >> 0] = (b & 65535) >>> 8 & 15 | d & 240;
                if ((q & 255) > 23)
                  i[251277] = 8;
                j[3202] = a;
                break;
              }
            case 21:
              {
                i[251288] = 0;
                k[146] = 1;
                break;
              }
            case 22:
              {
                k[146] = 2;
                c = b & 65535;
                if (!(i[251282] | 0))
                  a = e + 2 << 16 >> 16;
                else
                  a = (l[a + (c & 4095) >> 0] | c & 3840) & 65535;
                j[3202] = a;
                i[251282] = 0;
                break;
              }
            case 23:
              {
                i[251271] = (i[251271] | 0) + 1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 39:
              {
                k[146] = 1;
                i[251271] = 0;
                break;
              }
            case 40:
              {
                e = i[251271] | 0;
                q = 254088 + (l[251273] | 0) | 0;
                i[251271] = i[q >> 0] | 0;
                i[q >> 0] = e;
                k[146] = 1;
                break;
              }
            case 41:
              {
                e = i[251271] | 0;
                q = 254088 + ((l[251273] | 0) + 1) | 0;
                i[251271] = i[q >> 0] | 0;
                i[q >> 0] = e;
                k[146] = 1;
                break;
              }
            case 42:
              {
                e = i[251271] | 0;
                q = 254088 + ((l[251273] | 0) + 2) | 0;
                i[251271] = i[q >> 0] | 0;
                i[q >> 0] = e;
                k[146] = 1;
                break;
              }
            case 43:
              {
                e = i[251271] | 0;
                q = 254088 + ((l[251273] | 0) + 3) | 0;
                i[251271] = i[q >> 0] | 0;
                i[q >> 0] = e;
                k[146] = 1;
                break;
              }
            case 44:
              {
                e = i[251271] | 0;
                q = 254088 + ((l[251273] | 0) + 4) | 0;
                i[251271] = i[q >> 0] | 0;
                i[q >> 0] = e;
                k[146] = 1;
                break;
              }
            case 45:
              {
                e = i[251271] | 0;
                q = 254088 + ((l[251273] | 0) + 5) | 0;
                i[251271] = i[q >> 0] | 0;
                i[q >> 0] = e;
                k[146] = 1;
                break;
              }
            case 46:
              {
                e = i[251271] | 0;
                q = 254088 + ((l[251273] | 0) + 6) | 0;
                i[251271] = i[q >> 0] | 0;
                i[q >> 0] = e;
                k[146] = 1;
                break;
              }
            case 47:
              {
                e = i[251271] | 0;
                q = 254088 + ((l[251273] | 0) + 7) | 0;
                i[251271] = i[q >> 0] | 0;
                i[q >> 0] = e;
                k[146] = 1;
                break;
              }
            case 48:
              {
                k[146] = 1;
                e = l[251271] | 0;
                q = 254088 + (l[254088 + (l[251273] | 0) >> 0] & 63) | 0;
                d = l[q >> 0] | 0;
                i[251271] = d & 15 | e & 240;
                i[q >> 0] = d & 240 | e & 15;
                break;
              }
            case 49:
              {
                k[146] = 1;
                e = l[251271] | 0;
                q = 254088 + (l[254088 + ((l[251273] | 0) + 1) >> 0] & 63) | 0;
                d = l[q >> 0] | 0;
                i[251271] = d & 15 | e & 240;
                i[q >> 0] = d & 240 | e & 15;
                break;
              }
            case 50:
              {
                k[146] = 2;
                c = b & 65535;
                if (!(i[251271] & 2)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 51:
              {
                k[146] = 1;
                break;
              }
            case 52:
              {
                c = i[251277] | 0;
                q = c & 255;
                d = (q + 504 | 0) >>> 1 | (l[251286] | l[251287] << 7 | l[251284] | l[251283] | 8);
                i[251276] = d;
                a = (l[a + (b & 4095) >> 0] | m[3204] | 256) & 65535;
                b = e + 2 << 16 >> 16;
                j[3202] = b;
                k[146] = 2;
                c = c + 1 << 24 >> 24;
                i[251277] = c;
                i[254088 + q >> 0] = b;
                if ((c & 255) > 23) {
                  i[251277] = 8;
                  c = 8;
                }
                q = c + 1 << 24 >> 24;
                i[251277] = q;
                i[254088 + (c & 255) >> 0] = (b & 65535) >>> 8 & 15 | d & 240;
                if ((q & 255) > 23)
                  i[251277] = 8;
                j[3202] = a;
                break;
              }
            case 64:
              {
                k[146] = 1;
                i[251271] = i[254088 + (l[254088 + (l[251273] | 0) >> 0] & 63) >> 0] | i[251271];
                break;
              }
            case 91:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 3) >> 0] & i[251271];
                break;
              }
            case 92:
              {
                k[146] = 1;
                i[251271] = i[254088 + ((l[251273] | 0) + 4) >> 0] & i[251271];
                break;
              }
            case 96:
              {
                k[146] = 1;
                i[251286] = 0;
                i[251287] = 0;
                b = l[251271] | 0;
                a = l[254088 + (l[254088 + (l[251273] | 0) >> 0] & 63) >> 0] | 0;
                if (((b & 15) + (a & 15) | 0) > 15)
                  i[251286] = 64;
                a = b + a | 0;
                if ((a | 0) > 255)
                  i[251287] = 1;
                i[251271] = a;
                break;
              }
            case 97:
              {
                k[146] = 1;
                i[251286] = 0;
                i[251287] = 0;
                b = l[251271] | 0;
                a = l[254088 + (l[254088 + ((l[251273] | 0) + 1) >> 0] & 63) >> 0] | 0;
                if (((b & 15) + (a & 15) | 0) > 15)
                  i[251286] = 64;
                a = b + a | 0;
                if ((a | 0) > 255)
                  i[251287] = 1;
                i[251271] = a;
                break;
              }
            case 105:
              {
                k[146] = 1;
                i[251286] = 0;
                i[251287] = 0;
                b = l[251271] | 0;
                a = l[254088 + ((l[251273] | 0) + 1) >> 0] | 0;
                if (((b & 15) + (a & 15) | 0) > 15)
                  i[251286] = 64;
                a = b + a | 0;
                if ((a | 0) > 255)
                  i[251287] = 1;
                i[251271] = a;
                break;
              }
            case 108:
              {
                k[146] = 1;
                i[251286] = 0;
                i[251287] = 0;
                b = l[251271] | 0;
                a = l[254088 + ((l[251273] | 0) + 4) >> 0] | 0;
                if (((b & 15) + (a & 15) | 0) > 15)
                  i[251286] = 64;
                a = b + a | 0;
                if ((a | 0) > 255)
                  i[251287] = 1;
                i[251271] = a;
                break;
              }
            case 113:
              {
                k[146] = 1;
                i[251286] = 0;
                c = l[251271] | 0;
                b = l[254088 + (l[254088 + ((l[251273] | 0) + 1) >> 0] & 63) >> 0] | 0;
                a = l[251287] | 0;
                if (((c & 15) + (b & 15) + a | 0) > 15)
                  i[251286] = 64;
                q = c + b + a | 0;
                i[251287] = (q | 0) > 255 & 1;
                i[251271] = q;
                break;
              }
            case 114:
              {
                k[146] = 2;
                c = b & 65535;
                if (!(i[251271] & 8)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 116:
              {
                c = i[251277] | 0;
                q = c & 255;
                d = (q + 504 | 0) >>> 1 | (l[251286] | l[251287] << 7 | l[251284] | l[251283] | 8);
                i[251276] = d;
                a = (l[a + (b & 4095) >> 0] | m[3204] | 768) & 65535;
                b = e + 2 << 16 >> 16;
                j[3202] = b;
                k[146] = 2;
                c = c + 1 << 24 >> 24;
                i[251277] = c;
                i[254088 + q >> 0] = b;
                if ((c & 255) > 23) {
                  i[251277] = 8;
                  c = 8;
                }
                q = c + 1 << 24 >> 24;
                i[251277] = q;
                i[254088 + (c & 255) >> 0] = (b & 65535) >>> 8 & 15 | d & 240;
                if ((q & 255) > 23)
                  i[251277] = 8;
                j[3202] = a;
                break;
              }
            case 117:
              {
                k[146] = 1;
                k[n >> 2] = 117;
                k[n + 4 >> 2] = b & 65535;
                kb(299686, n | 0) | 0;
                break;
              }
            case 118:
              {
                k[146] = 2;
                c = b & 65535;
                if (!(i[251285] | 0)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 148:
              {
                c = i[251277] | 0;
                q = c & 255;
                d = (q + 504 | 0) >>> 1 | (l[251286] | l[251287] << 7 | l[251284] | l[251283] | 8);
                i[251276] = d;
                a = (l[a + (b & 4095) >> 0] | m[3204] | 1024) & 65535;
                b = e + 2 << 16 >> 16;
                j[3202] = b;
                k[146] = 2;
                c = c + 1 << 24 >> 24;
                i[251277] = c;
                i[254088 + q >> 0] = b;
                if ((c & 255) > 23) {
                  i[251277] = 8;
                  c = 8;
                }
                q = c + 1 << 24 >> 24;
                i[251277] = q;
                i[254088 + (c & 255) >> 0] = (b & 65535) >>> 8 & 15 | d & 240;
                if ((q & 255) > 23)
                  i[251277] = 8;
                j[3202] = a;
                break;
              }
            case 174:
              {
                i[254088 + ((l[251273] | 0) + 6) >> 0] = i[251271] | 0;
                k[146] = 1;
                break;
              }
            case 197:
              {
                i[251273] = 0;
                i[251283] = 0;
                k[146] = 1;
                break;
              }
            case 198:
              {
                k[146] = 2;
                c = b & 65535;
                if (!(i[251271] | 0)) {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                } else {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                }
              }
            case 206:
              {
                q = 254088 + ((l[251273] | 0) + 6) | 0;
                i[q >> 0] = (i[q >> 0] | 0) + -1 << 24 >> 24;
                k[146] = 1;
                break;
              }
            case 211:
              {
                k[146] = 2;
                q = i[251271] | 0;
                j[3202] = e + 2 << 16 >> 16;
                i[251271] = i[a + (b & 4095) >> 0] ^ q;
                break;
              }
            case 216:
              {
                i[251271] = i[254088 + (l[251273] | 0) >> 0] ^ i[251271];
                k[146] = 1;
                break;
              }
            case 217:
              {
                i[251271] = i[254088 + ((l[251273] | 0) + 1) >> 0] ^ i[251271];
                k[146] = 1;
                break;
              }
            case 218:
              {
                i[251271] = i[254088 + ((l[251273] | 0) + 2) >> 0] ^ i[251271];
                k[146] = 1;
                break;
              }
            case 232:
              {
                k[146] = 2;
                c = 254088 + (l[251273] | 0) | 0;
                q = (i[c >> 0] | 0) + -1 << 24 >> 24;
                i[c >> 0] = q;
                c = b & 65535;
                if (!(q << 24 >> 24)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 233:
              {
                k[146] = 2;
                c = 254088 + ((l[251273] | 0) + 1) | 0;
                q = (i[c >> 0] | 0) + -1 << 24 >> 24;
                i[c >> 0] = q;
                c = b & 65535;
                if (!(q << 24 >> 24)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 234:
              {
                k[146] = 2;
                c = 254088 + ((l[251273] | 0) + 2) | 0;
                q = (i[c >> 0] | 0) + -1 << 24 >> 24;
                i[c >> 0] = q;
                c = b & 65535;
                if (!(q << 24 >> 24)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 235:
              {
                k[146] = 2;
                c = 254088 + ((l[251273] | 0) + 3) | 0;
                q = (i[c >> 0] | 0) + -1 << 24 >> 24;
                i[c >> 0] = q;
                c = b & 65535;
                if (!(q << 24 >> 24)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 236:
              {
                k[146] = 2;
                c = 254088 + ((l[251273] | 0) + 4) | 0;
                q = (i[c >> 0] | 0) + -1 << 24 >> 24;
                i[c >> 0] = q;
                c = b & 65535;
                if (!(q << 24 >> 24)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            case 244:
              {
                k[146] = 2;
                c = i[251277] | 0;
                q = c & 255;
                d = (q + 504 | 0) >>> 1 | (l[251286] | l[251287] << 7 | l[251284] | l[251283] | 8);
                i[251276] = d;
                a = (l[a + (b & 4095) >> 0] | m[3204] | 1792) & 65535;
                b = e + 2 << 16 >> 16;
                j[3202] = b;
                c = c + 1 << 24 >> 24;
                i[251277] = c;
                i[254088 + q >> 0] = b;
                if ((c & 255) > 23) {
                  i[251277] = 8;
                  c = 8;
                }
                q = c + 1 << 24 >> 24;
                i[251277] = q;
                i[254088 + (c & 255) >> 0] = (b & 65535) >>> 8 & 15 | d & 240;
                if ((q & 255) > 23)
                  i[251277] = 8;
                j[3202] = a;
                break;
              }
            case 150:
              {
                k[146] = 2;
                c = b & 65535;
                if (!(i[251271] | 0)) {
                  j[3202] = e + 2 << 16 >> 16;
                  break a;
                } else {
                  j[3202] = l[a + (c & 4095) >> 0] | c & 3840;
                  break a;
                }
              }
            default:
              {}
          }
 while (0);
        q = k[146] | 0;
        k[331] = (k[331] | 0) + q;
        k[460] = (k[460] | 0) + q;
        k[461] = (k[461] | 0) + q;
        e = k[464] | 0;
        k[464] = (e | 0) > (q | 0) ? e - q | 0 : 0;
        if (i[251280] | 0)
          _c();
        if (i[251281] | 0)
          $c();
        a = k[460] | 0;
        if ((a | 0) > 20) {
          k[460] = a + -21;
          if ((k[292] | 0) != 0 ? (i[252734] & 1) != 0 : 0)
            _c();
          if ((i[251275] | 0) != 0 & (k[329] | 0) == 0 ? (q = (i[251272] | 0) + 1 << 24 >> 24, i[251272] = q, q << 24 >> 24 == 0) : 0) {
            i[251282] = 1;
            $c();
            id();
          }
        }
        if (((i[251274] | 0) != 0 ? (f = (k[147] | 0) + (k[146] | 0) | 0, k[147] = f, (f | 0) > 31) : 0) ? (k[147] = f + -31, q = (i[251272] | 0) + 1 << 24 >> 24, i[251272] = q, q << 24 >> 24 == 0) : 0) {
          i[251282] = 1;
          $c();
        }
        a = k[329] | 0;
        if ((a | 0) == 0 & (k[331] | 0) > 5493) {
          qd();
          a = k[329] | 0;
        }
        if ((a | 0) == 1 ? (k[331] | 0) > (k[288] | 0) : 0) {
          a = 448;
          break;
        }
        if (k[299] | 0) {
          a = 452;
          break;
        }
        e = j[3202] | 0;
        if (!((e & 65535 | 0) != (k[327] | 0) & (k[465] | 0) == 1)) {
          a = 452;
          break;
        }
      }
      if ((a | 0) == 448) {
        rd();
        if ((k[321] | 0) != -1489744609) {
          r = p;
          return ;
        }
        sd();
        r = p;
        return ;
      } else if ((a | 0) == 452) {
        r = p;
        return ;
      }
    }
    function bd(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0;
      if (!b) {
        c = 0;
        return c | 0;
      } else {
        c = b;
        b = 0;
      }
      while (1) {
        c = c + -1 | 0;
        b = k[1920 + (((l[a >> 0] | 0) ^ b & 255) << 2) >> 2] ^ b >>> 8;
        if (!c)
          break;
        else
          a = a + 1 | 0;
      }
      c = ~b;
      return c | 0;
    }
    function cd(a) {
      a = a | 0;
      var b = 0,
          c = 0;
      c = lb(a | 0, 628617) | 0;
      if (!c) {
        c = 0;
        c = ~c;
        return c | 0;
      }
      a = kc(c | 0) | 0;
      if ((a | 0) == -1)
        a = 0;
      else {
        b = 0;
        do {
          b = k[1920 + (((a ^ b) & 255) << 2) >> 2] ^ b >>> 8;
          a = kc(c | 0) | 0;
        } while ((a | 0) != -1);
        a = b;
      }
      Gb(c | 0) | 0;
      c = a;
      c = ~c;
      return c | 0;
    }
    function dd(a, b) {
      a = a | 0;
      b = b | 0;
      return ;
    }
    function ed() {
      k[149] = 293;
      k[150] = 282;
      k[151] = 285;
      k[152] = 286;
      k[153] = 289;
      k[154] = 283;
      k[155] = 284;
      k[156] = 287;
      return ;
    }
    function fd(a) {
      a = a | 0;
      var b = 0;
      if (a >>> 0 >= 2) {
        a = -1;
        return a | 0;
      }
      b = (k[1864 + (a * 20 | 0) >> 2] | 0) == 0 ? -1 : -2;
      if (k[1864 + (a * 20 | 0) + 4 >> 2] | 0)
        b = b & 251;
      if (k[1864 + (a * 20 | 0) + 8 >> 2] | 0)
        b = b & 247;
      if (k[1864 + (a * 20 | 0) + 12 >> 2] | 0)
        b = b & 253;
      if (!(k[1864 + (a * 20 | 0) + 16 >> 2] | 0)) {
        a = b;
        return a | 0;
      }
      a = b & 239;
      return a | 0;
    }
    function gd() {
      i[251804] = 0;
      i[251805] = 0;
      pf(251806, 0, 512) | 0;
      i[251803] = 1;
      k[148] = 1;
      return ;
    }
    function hd(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0.0,
          e = 0,
          f = 0,
          g = 0,
          h = 0.0,
          j = 0,
          k = 0,
          m = 0;
      if (!((a | 0) != 0 & (c | 0) > 0))
        return ;
      f = (a | 0) % 10 | 0;
      e = (((a | 0) / 10 | 0 | 0) % 10 | 0 | 0) == 1;
      h = +(3 - (((a | 0) / 100 | 0 | 0) % 10 | 0) | 0) * .5;
      if (e)
        d = +(f | 0) * h + -1.0;
      else
        d = 0.0;
      m = ~~(+(b | 0) + d);
      k = (a + -1e3 | 0) >>> 0 < 1e3 ? 253832 : 254088;
      a = f + -1 | 0;
      if ((f | 0) <= 0)
        return ;
      d = e ? -1.0 : 1.0;
      if (h == .5)
        g = a;
      else {
        g = a;
        while (1) {
          switch (f | 0) {
            case 1:
              {
                b = 1;
                j = 20;
                break;
              }
            case 2:
              {
                b = 10;
                break;
              }
            default:
              if ((g | 0) < 2) {
                b = 10;
                j = 20;
              } else {
                a = 2;
                b = 10;
                while (1) {
                  b = b * 10 | 0;
                  if ((a | 0) < (g | 0))
                    a = a + 1 | 0;
                  else {
                    j = 20;
                    break;
                  }
                }
              }
          }
          if ((j | 0) == 20)
            j = 0;
          a = (c | 0) / (b | 0) | 0;
          i[k + (~~(d * (h * +(g | 0))) + m) >> 0] = a;
          switch (f | 0) {
            case 2:
              {
                b = 10;
                break;
              }
            case 1:
              {
                b = 1;
                break;
              }
            default:
              if ((g | 0) < 2)
                b = 10;
              else {
                e = 2;
                b = 10;
                while (1) {
                  b = b * 10 | 0;
                  if ((e | 0) < (g | 0))
                    e = e + 1 | 0;
                  else
                    break;
                }
              }
          }
          c = c - (ia(b, a) | 0) | 0;
          b = g + -1 | 0;
          if ((b | 0) <= -1)
            break;
          else {
            f = g;
            g = b;
          }
        }
        return ;
      }
      while (1) {
        switch (f | 0) {
          case 2:
            {
              e = (c | 0) / 10 | 0;
              a = e;
              break;
            }
          case 1:
            {
              b = 1;
              j = 10;
              break;
            }
          default:
            if ((g | 0) < 2) {
              b = 10;
              j = 10;
            } else {
              a = 2;
              b = 10;
              while (1) {
                b = b * 10 | 0;
                if ((a | 0) < (g | 0))
                  a = a + 1 | 0;
                else {
                  j = 10;
                  break;
                }
              }
            }
        }
        if ((j | 0) == 10) {
          j = 0;
          b = (c | 0) / (b | 0) | 0;
          if (!(g & 1)) {
            a = ((l[k + (~~(d * (+(g | 0) * .5)) + m) >> 0] | 0) << 4) + b | 0;
            e = b;
          } else {
            a = b;
            e = b;
          }
        }
        i[k + (~~(d * (+(g | 0) * .5)) + m) >> 0] = a;
        switch (f | 0) {
          case 2:
            {
              b = 10;
              break;
            }
          case 1:
            {
              b = 1;
              break;
            }
          default:
            if ((g | 0) < 2)
              b = 10;
            else {
              a = 2;
              b = 10;
              while (1) {
                b = b * 10 | 0;
                if ((a | 0) < (g | 0))
                  a = a + 1 | 0;
                else
                  break;
              }
            }
        }
        c = c - (ia(b, e) | 0) | 0;
        b = g + -1 | 0;
        if ((b | 0) <= -1)
          break;
        else {
          f = g;
          g = b;
        }
      }
      return ;
    }
    function id() {
      var a = 0,
          b = 0,
          c = 0;
      a = k[294] | 0;
      b = k[331] | 0;
      a = xd((a | 0) == 65535 ? ((b | 0) / 20 | 0) + -5 | 0 : ((b | 0) / 22 | 0) + a | 0, i[252734] | 0, 0) | 0;
      b = k[321] | 0;
      if ((b | 0) == -1489744609) {
        a = (xd(((k[331] | 0) / 22 | 0) + 6 + (k[294] | 0) | 0, i[252734] | 0, 0) | 0) + 6 | 0;
        b = k[321] | 0;
      }
      if ((b | 0) == -792965402) {
        a = (xd(((k[331] | 0) / 24 | 0) + -6 + (k[294] | 0) | 0, i[252734] | 0, 0) | 0) + 7 | 0;
        b = k[321] | 0;
      }
      if ((b | 0) == 642874999) {
        a = (xd((k[294] | 0) + ((k[331] | 0) / 22 | 0) | 0, i[252734] | 0, 0) | 0) + -5 | 0;
        b = k[321] | 0;
      }
      if ((b | 0) == -1518463196)
        a = (xd(((k[331] | 0) / 20 | 0) + -5 | 0, i[252734] | 0, 0) | 0) + -3 | 0;
      c = (a | 0) < 0 ? 0 : a;
      b = (k[330] | 0) * 340 | 0;
      k[285] = b;
      a = c * 340 | 0;
      a = (a | 0) > 85e3 ? 85e3 : a;
      k[286] = a;
      if ((b | 0) < 0) {
        k[285] = 0;
        b = 0;
      }
      if ((b | 0) >= (a | 0)) {
        k[330] = c;
        return ;
      }
      jd();
      k[330] = c;
      return ;
    }
    function jd() {
      var a = 0,
          b = 0,
          c = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          j = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          s = 0,
          t = 0,
          u = 0,
          v = 0,
          w = 0,
          x = 0,
          y = 0,
          z = 0,
          A = 0,
          B = 0,
          C = 0,
          D = 0,
          E = 0,
          F = 0,
          G = 0,
          H = 0,
          I = 0,
          J = 0,
          K = 0,
          L = 0,
          M = 0,
          N = 0,
          O = 0,
          P = 0,
          Q = 0,
          R = 0,
          S = 0;
      S = r;
      r = r + 32 | 0;
      P = S;
      Q = S + 16 | 0;
      a = (k[285] | 0) / 340 | 0;
      if ((a | 0) < ((k[286] | 0) / 340 | 0 | 0)) {
        b = k[736] | 0;
        do {
          C = l[252830 + a >> 0] | 0;
          pf(b + (a * 340 | 0) | 0, ((C >>> 4 & 8 | C >>> 3 & 7) ^ 8) & 255 | 0, 340) | 0;
          a = a + 1 | 0;
        } while ((a | 0) < ((k[286] | 0) / 340 | 0 | 0));
      }
      b = i[252734] | 0;
      if (b & 8) {
        d = k[736] | 0;
        c = k[737] | 0;
        if (!(b & 64)) {
          v = 0;
          b = 1;
        } else {
          f = 0;
          do {
            h = f * 24 | 0;
            m = h + 24 | 0;
            n = m * 340 | 0;
            m = 252830 + m | 0;
            j = 252830 + (h + 25) | 0;
            h = 252830 + (h + 26) | 0;
            g = 0;
            do {
              o = (g << 5) + n | 20;
              q = l[m >> 0] | 0;
              p = k[285] | 0;
              t = k[286] | 0;
              if (p >>> 0 < o >>> 0 & t >>> 0 > o >>> 0) {
                C = q >>> 3 & 8 | q & 7 | q >>> 4 & 8 ^ 8;
                k[d + o >> 2] = C << 8 | C | C << 16 | C << 24;
                C = c + o | 0;
                t = k[C >> 2] | 0;
                p = t | 538976288;
                k[C >> 2] = p;
                i[252350] = t >>> 8 | t | t >>> 16 | p >>> 24 | l[252350];
                p = k[285] | 0;
                t = k[286] | 0;
              }
              s = o + 340 | 0;
              q = l[j >> 0] | 0;
              if (t >>> 0 > s >>> 0 & p >>> 0 < s >>> 0) {
                C = q >>> 3 & 8 | q & 7 | q >>> 4 & 8 ^ 8;
                k[d + s >> 2] = C << 8 | C | C << 16 | C << 24;
                C = c + s | 0;
                t = k[C >> 2] | 0;
                u = t | 538976288;
                k[C >> 2] = u;
                i[252350] = t >>> 8 | t | t >>> 16 | u >>> 24 | l[252350];
                u = k[285] | 0;
                t = k[286] | 0;
              } else
                u = p;
              q = o + 680 | 0;
              p = l[h >> 0] | 0;
              if (t >>> 0 > q >>> 0 & u >>> 0 < q >>> 0) {
                A = p >>> 3 & 8 | p & 7 | p >>> 4 & 8 ^ 8;
                k[d + q >> 2] = A << 8 | A | A << 16 | A << 24;
                A = c + q | 0;
                B = k[A >> 2] | 0;
                C = B | 538976288;
                k[A >> 2] = C;
                i[252350] = B >>> 8 | B | B >>> 16 | C >>> 24 | l[252350];
              }
              g = g + 1 | 0;
            } while ((g | 0) != 9);
            f = f + 1 | 0;
          } while ((f | 0) != 9);
          v = 0;
          b = 1;
        }
        while (1) {
          w = v * 24 | 0;
          y = w + 24 | 0;
          z = y * 340 | 0;
          C = (v | 0) == 8;
          A = C ? 208 : 192;
          y = 252830 + y | 0;
          x = 252830 + (w + 25) | 0;
          w = 252830 + (w + 26) | 0;
          if (C) {
            B = 0;
            do {
              C = (B << 5) + z | 20;
              u = k[285] | 0;
              s = k[286] | 0;
              if (!(C >>> 0 > s >>> 0 | (C + 1020 | 0) >>> 0 < u >>> 0))
                if (i[252574 + (B + A) >> 0] & 1) {
                  t = l[y >> 0] | 0;
                  if (u >>> 0 < C >>> 0 & s >>> 0 > C >>> 0) {
                    t = t >>> 3 & 8 | t & 7 | t >>> 4 & 8 ^ 8;
                    t = t << 8 | t | t << 16 | t << 24;
                    u = C;
                    s = 538976288;
                    q = 0;
                    while (1) {
                      k[d + u >> 2] = t;
                      p = c + u | 0;
                      s = k[p >> 2] | s;
                      k[p >> 2] = s;
                      i[252350] = s >>> 8 | s | s >>> 16 | s >>> 24 | l[252350];
                      q = q + 1 | 0;
                      if ((q | 0) == 9)
                        break;
                      else
                        u = u + 4 | 0;
                    }
                    q = k[285] | 0;
                    s = k[286] | 0;
                  } else
                    q = u;
                  u = C + 340 | 0;
                  t = l[x >> 0] | 0;
                  if (s >>> 0 > u >>> 0 & q >>> 0 < u >>> 0) {
                    q = t >>> 3 & 8 | t & 7 | t >>> 4 & 8 ^ 8;
                    q = q << 8 | q | q << 16 | q << 24;
                    t = 538976288;
                    s = 0;
                    while (1) {
                      k[d + u >> 2] = q;
                      p = c + u | 0;
                      t = k[p >> 2] | t;
                      k[p >> 2] = t;
                      i[252350] = t >>> 8 | t | t >>> 16 | t >>> 24 | l[252350];
                      s = s + 1 | 0;
                      if ((s | 0) == 9)
                        break;
                      else
                        u = u + 4 | 0;
                    }
                    q = k[285] | 0;
                    u = k[286] | 0;
                  } else
                    u = s;
                  t = C + 680 | 0;
                  s = l[w >> 0] | 0;
                  if (u >>> 0 > t >>> 0 & q >>> 0 < t >>> 0) {
                    q = s >>> 3 & 8 | s & 7 | s >>> 4 & 8 ^ 8;
                    q = q << 8 | q | q << 16 | q << 24;
                    u = 538976288;
                    s = 0;
                    while (1) {
                      k[d + t >> 2] = q;
                      C = c + t | 0;
                      u = k[C >> 2] | u;
                      k[C >> 2] = u;
                      i[252350] = u >>> 8 | u | u >>> 16 | u >>> 24 | l[252350];
                      s = s + 1 | 0;
                      if ((s | 0) == 9) {
                        b = 1;
                        break;
                      } else
                        t = t + 4 | 0;
                    }
                  } else
                    b = 1;
                } else
                  b = 1;
              B = B + 1 | 0;
            } while ((B | 0) != 9);
          } else {
            B = 0;
            do {
              C = (B << 5) + z | 20;
              u = k[285] | 0;
              s = k[286] | 0;
              if (!(C >>> 0 > s >>> 0 | (C + 1020 | 0) >>> 0 < u >>> 0) ? (i[252574 + (B + A) >> 0] & b) << 24 >> 24 != 0 : 0) {
                t = l[y >> 0] | 0;
                if (u >>> 0 < C >>> 0 & s >>> 0 > C >>> 0) {
                  t = t >>> 3 & 8 | t & 7 | t >>> 4 & 8 ^ 8;
                  t = t << 8 | t | t << 16 | t << 24;
                  u = C;
                  s = 538976288;
                  q = 0;
                  while (1) {
                    k[d + u >> 2] = t;
                    p = c + u | 0;
                    s = k[p >> 2] | s;
                    k[p >> 2] = s;
                    i[252350] = s >>> 8 | s | s >>> 16 | s >>> 24 | l[252350];
                    q = q + 1 | 0;
                    if ((q | 0) == 9)
                      break;
                    else
                      u = u + 4 | 0;
                  }
                  u = k[285] | 0;
                  s = k[286] | 0;
                }
                q = C + 340 | 0;
                t = l[x >> 0] | 0;
                if (s >>> 0 > q >>> 0 & u >>> 0 < q >>> 0) {
                  p = t >>> 3 & 8 | t & 7 | t >>> 4 & 8 ^ 8;
                  p = p << 8 | p | p << 16 | p << 24;
                  u = q;
                  t = 538976288;
                  s = 0;
                  while (1) {
                    k[d + u >> 2] = p;
                    q = c + u | 0;
                    t = k[q >> 2] | t;
                    k[q >> 2] = t;
                    i[252350] = t >>> 8 | t | t >>> 16 | t >>> 24 | l[252350];
                    s = s + 1 | 0;
                    if ((s | 0) == 9)
                      break;
                    else
                      u = u + 4 | 0;
                  }
                  q = k[285] | 0;
                  s = k[286] | 0;
                } else
                  q = u;
                u = C + 680 | 0;
                t = l[w >> 0] | 0;
                if (s >>> 0 > u >>> 0 & q >>> 0 < u >>> 0) {
                  q = t >>> 3 & 8 | t & 7 | t >>> 4 & 8 ^ 8;
                  q = q << 8 | q | q << 16 | q << 24;
                  t = 538976288;
                  s = 0;
                  while (1) {
                    k[d + u >> 2] = q;
                    C = c + u | 0;
                    t = k[C >> 2] | t;
                    k[C >> 2] = t;
                    i[252350] = t >>> 8 | t | t >>> 16 | t >>> 24 | l[252350];
                    s = s + 1 | 0;
                    if ((s | 0) == 9)
                      break;
                    else
                      u = u + 4 | 0;
                  }
                }
              }
              B = B + 1 | 0;
            } while ((B | 0) != 9);
          }
          v = v + 1 | 0;
          if ((v | 0) == 9)
            break;
          else
            b = (b & 255) << 1 & 255;
        }
        p = (i[252734] | 0) < 0 ? 8 : 1;
        h = 0;
        do {
          o = h << 5;
          n = l[252574 + (h + 224) >> 0] | 0;
          g = 1;
          e = 0;
          while (1) {
            m = (e * 24 | 0) + 24 | 0;
            if (g & n) {
              j = 0;
              f = (m * 340 | 0) + o | 20;
              while (1) {
                t = k[285] | 0;
                s = k[286] | 0;
                if (!(f >>> 0 < t >>> 0 | f >>> 0 > s >>> 0) ? (D = l[252830 + (j + m) >> 0] | 0, t >>> 0 < f >>> 0 & s >>> 0 > f >>> 0) : 0) {
                  t = D >>> 3 & 8 | D & 7 | D >>> 4 & 8 ^ 8;
                  t = t << 8 | t | t << 16 | t << 24;
                  u = f;
                  s = 269488144;
                  q = 0;
                  while (1) {
                    k[d + u >> 2] = t;
                    C = c + u | 0;
                    s = k[C >> 2] | s;
                    k[C >> 2] = s;
                    i[252334] = s >>> 8 | s | s >>> 16 | s >>> 24 | l[252334];
                    q = q + 1 | 0;
                    if ((q | 0) == (p | 0))
                      break;
                    else
                      u = u + 4 | 0;
                  }
                }
                j = j + 1 | 0;
                if ((j | 0) == 24)
                  break;
                else
                  f = f + 340 | 0;
              }
            }
            e = e + 1 | 0;
            if ((e | 0) == 8)
              break;
            else
              g = g << 1 & 510;
          }
          h = h + 1 | 0;
        } while ((h | 0) != 10);
      }
      if ((k[293] | 0) != 0 ? (i[252734] & 32) == 0 : 0) {
        r = S;
        return ;
      } else
        e = 16;
      do {
        a = i[252574 + e >> 0] | 0;
        c = i[252574 + (e | 1) >> 0] | 0;
        b = i[252574 + (e | 2) >> 0] | 0;
        g = a & 254;
        f = (c & 255) + -8 | 0;
        d = (g * 340 | 0) + 20 + (f << 1) | 0;
        a = (a & 255) >>> 1;
        h = 8 - (a & 7) - (b & 7) | 0;
        h = (h | 0) < 3 ? h + 7 | 0 : h;
        if (!(d >>> 0 > (k[286] | 0) >>> 0 ? 1 : ((h * 680 | 0) + d | 0) >>> 0 < (k[285] | 0) >>> 0) ? (F = (b & 255) + (a & 255) | 0, D = l[252574 + (e | 3) >> 0] | 0, F = (D & 1 | 0) == 0 ? F : F + 256 | 0, F = F >>> 0 > 511 ? F + -512 | 0 : F, E = D >>> 1, E = (D >>> 3 & 1 | E & 2 | E << 2 & 4 | 8) & 255, (c & 255) < 157 & (g + -1 | 0) >>> 0 < 231 & (h | 0) > 0) : 0) {
          j = 0;
          while (1) {
            t = (j + g | 0) < 240;
            s = 0;
            n = i[251291 + (j + F) >> 0] | 0;
            m = d;
            while (1) {
              u = n & 255;
              if (t & ((s + f | 0) < 160 & (u & 128 | 0) != 0)) {
                o = k[285] | 0;
                q = k[286] | 0;
                if (o >>> 0 < m >>> 0 & q >>> 0 > m >>> 0) {
                  i[(k[736] | 0) + m >> 0] = E;
                  o = (k[737] | 0) + m | 0;
                  i[o >> 0] = i[o >> 0] | -128;
                  o = m | 1;
                  i[252446] = i[252446] | i[(k[737] | 0) + m >> 0];
                  i[(k[736] | 0) + o >> 0] = E;
                  q = (k[737] | 0) + o | 0;
                  i[q >> 0] = i[q >> 0] | -128;
                  i[252446] = i[252446] | i[(k[737] | 0) + o >> 0];
                  o = k[285] | 0;
                  q = k[286] | 0;
                }
                p = m + 340 | 0;
                if (q >>> 0 > p >>> 0 & o >>> 0 < p >>> 0) {
                  i[(k[736] | 0) + p >> 0] = E;
                  D = (k[737] | 0) + p | 0;
                  i[D >> 0] = i[D >> 0] | -128;
                  D = m + 341 | 0;
                  i[252446] = i[252446] | i[(k[737] | 0) + p >> 0];
                  i[(k[736] | 0) + D >> 0] = E;
                  C = (k[737] | 0) + D | 0;
                  i[C >> 0] = i[C >> 0] | -128;
                  i[252446] = i[252446] | i[(k[737] | 0) + D >> 0];
                }
              }
              s = s + 1 | 0;
              if ((s | 0) == 8)
                break;
              else {
                n = u << 1 & 255;
                m = m + 2 | 0;
              }
            }
            j = j + 1 | 0;
            if ((j | 0) == (h | 0))
              break;
            else
              d = d + 680 | 0;
          }
        }
        e = e + 4 | 0;
      } while ((e | 0) < 64);
      d = P + 4 | 0;
      b = P + 8 | 0;
      a = P + 12 | 0;
      z = Q + 1 | 0;
      A = Q + 2 | 0;
      B = Q + 3 | 0;
      C = 64;
      do {
        c = l[252574 + C >> 0] | 0;
        o = (l[252574 + (C | 1) >> 0] << 1) + 4 + ((c & 254) * 340 | 0) | 0;
        if ((o >>> 0 <= (k[286] | 0) >>> 0 ? (G = l[252574 + (C | 3) >> 0] | 0, H = l[252574 + (C | 7) >> 0] | 0, L = H << 8 | l[252574 + (C | 6) >> 0], I = l[252574 + (C | 11) >> 0] | 0, M = I << 8 | l[252574 + (C | 10) >> 0], J = l[252574 + (C | 15) >> 0] | 0, N = J << 8 & 256 | l[252574 + (C | 14) >> 0], O = c >>> 1, K = (G << 8 | l[252574 + (C | 2) >> 0]) + O & 511, k[P >> 2] = K, L = L + O & 511, k[d >> 2] = L, M = M + O & 511, k[b >> 2] = M, O = N + O | 0, N = O & 511, k[a >> 2] = N, O = 8 - (O + 1 & 7) | 0, ((O * 680 | 0) + o | 0) >>> 0 >= (k[285] | 0) >>> 0) : 0) ? (y = G >>> 1, D = H >>> 1, E = I >>> 1, F = J >>> 1, i[Q >> 0] = y & 2 | G >>> 3 & 1 | y << 2 & 4 | 8, i[z >> 0] = D & 2 | H >>> 3 & 1 | D << 2 & 4 | 8, i[A >> 0] = E & 2 | I >>> 3 & 1 | E << 2 & 4 | 8, i[B >> 0] = F & 2 | J >>> 3 & 1 | F << 2 & 4 | 8, (O | 0) != 0) : 0) {
          j = O;
          h = K;
          g = L;
          f = M;
          e = N;
          while (1) {
            u = h;
            t = 0;
            m = 0;
            while (1) {
              y = 251291 + u | 0;
              x = Q + t | 0;
              p = 0;
              n = m;
              while (1) {
                if (n >>> 0 < 340 ? (l[y >> 0] & 1 << 7 - p | 0) != 0 : 0) {
                  w = n + o | 0;
                  v = i[x >> 0] | 0;
                  u = k[285] | 0;
                  s = k[286] | 0;
                  if (u >>> 0 < w >>> 0 & s >>> 0 > w >>> 0) {
                    i[(k[736] | 0) + w >> 0] = v;
                    u = (k[737] | 0) + w | 0;
                    i[u >> 0] = i[u >> 0] | -128;
                    u = w | 1;
                    i[252446] = i[252446] | i[(k[737] | 0) + w >> 0];
                    i[(k[736] | 0) + u >> 0] = v;
                    s = (k[737] | 0) + u | 0;
                    i[s >> 0] = i[s >> 0] | -128;
                    i[252446] = i[252446] | i[(k[737] | 0) + u >> 0];
                    u = k[285] | 0;
                    s = k[286] | 0;
                  }
                  q = w + 340 | 0;
                  if (s >>> 0 > q >>> 0 & u >>> 0 < q >>> 0) {
                    i[(k[736] | 0) + q >> 0] = v;
                    F = (k[737] | 0) + q | 0;
                    i[F >> 0] = i[F >> 0] | -128;
                    F = w + 341 | 0;
                    i[252446] = i[252446] | i[(k[737] | 0) + q >> 0];
                    i[(k[736] | 0) + F >> 0] = v;
                    E = (k[737] | 0) + F | 0;
                    i[E >> 0] = i[E >> 0] | -128;
                    i[252446] = i[252446] | i[(k[737] | 0) + F >> 0];
                  }
                }
                p = p + 1 | 0;
                if ((p | 0) == 8)
                  break;
                else
                  n = n + 2 | 0;
              }
              t = t + 1 | 0;
              if ((t | 0) == 4)
                break;
              u = k[P + (t << 2) >> 2] | 0;
              m = m + 32 | 0;
            }
            h = h + 1 & 511;
            k[P >> 2] = h;
            g = g + 1 & 511;
            k[d >> 2] = g;
            f = f + 1 & 511;
            k[b >> 2] = f;
            e = e + 1 & 511;
            k[a >> 2] = e;
            j = j + -1 | 0;
            if ((j | 0) <= 0)
              break;
            else
              o = o + 680 | 0;
          }
        }
        C = C + 16 | 0;
      } while ((C | 0) < 128);
      B = 8;
      A = 12;
      while (1) {
        d = (A << 1) + 128 | 0;
        C = (l[252574 + (A | 1) >> 0] | 0) + -8 | 0;
        b = l[252574 + (A | 2) >> 0] | 0;
        a = b >>> 3;
        a = a & 2 | b >>> 5 & 1 | a << 2 & 4 | 8;
        u = a & 255;
        a: do
          if ((C | 0) < 164 ? (Q = i[252574 + A >> 0] | 0, R = Q & 255, (Q + -1 & 255) < 231) : 0) {
            c = (C << 1) + 20 + (R * 340 | 0) + (k[296] | 0) | 0;
            if (!(b & 4)) {
              if ((c + 5440 | 0) >>> 0 < (k[285] | 0) >>> 0 | c >>> 0 > (k[286] | 0) >>> 0)
                break;
              s = 252318 + (B & 255) | 0;
              t = ((b >>> 1 ^ b) & 1 | 0) != 0;
              p = (b & 1 | 0) != 0;
              q = 0;
              o = c;
              while (1) {
                switch ((q | 0) % 2 | 0 | 0) {
                  case 0:
                    {
                      a = t;
                      break;
                    }
                  case 1:
                    {
                      a = p;
                      break;
                    }
                  default:
                    a = 0;
                }
                e = a & 1;
                f = e + C | 0;
                g = (q + R | 0) < 249;
                j = i[252574 + d >> 0] | 0;
                m = 0;
                n = o;
                while (1) {
                  if ((j & 1) != 0 ? g & (f + m | 0) < 160 : 0) {
                    h = n + e | 0;
                    b = k[285] | 0;
                    c = k[286] | 0;
                    if (b >>> 0 < h >>> 0 & c >>> 0 > h >>> 0) {
                      i[(k[736] | 0) + h >> 0] = u;
                      b = (k[737] | 0) + h | 0;
                      i[b >> 0] = i[b >> 0] | B;
                      b = h + 1 | 0;
                      i[s >> 0] = i[s >> 0] | i[(k[737] | 0) + h >> 0];
                      i[(k[736] | 0) + b >> 0] = u;
                      c = (k[737] | 0) + b | 0;
                      i[c >> 0] = i[c >> 0] | B;
                      i[s >> 0] = i[s >> 0] | i[(k[737] | 0) + b >> 0];
                      b = k[285] | 0;
                      c = k[286] | 0;
                    }
                    a = h + 340 | 0;
                    if (b >>> 0 < a >>> 0 & c >>> 0 > a >>> 0) {
                      i[(k[736] | 0) + a >> 0] = u;
                      Q = (k[737] | 0) + a | 0;
                      i[Q >> 0] = i[Q >> 0] | B;
                      Q = h + 341 | 0;
                      i[s >> 0] = i[s >> 0] | i[(k[737] | 0) + a >> 0];
                      i[(k[736] | 0) + Q >> 0] = u;
                      P = (k[737] | 0) + Q | 0;
                      i[P >> 0] = i[P >> 0] | B;
                      i[s >> 0] = i[s >> 0] | i[(k[737] | 0) + Q >> 0];
                    }
                  }
                  m = m + 1 | 0;
                  if ((m | 0) == 8)
                    break;
                  else {
                    j = (j & 255) >>> 1;
                    n = n + 2 | 0;
                  }
                }
                q = q + 1 | 0;
                if ((q | 0) == 8)
                  break a;
                else {
                  o = o + 680 | 0;
                  d = d + 1 | 0;
                }
              }
            }
            if (!((c + 10880 | 0) >>> 0 < (k[285] | 0) >>> 0 | c >>> 0 > (k[286] | 0) >>> 0)) {
              f = a << 8 | a | a << 16 | a << 24;
              x = B & 255;
              e = x << 8 | x | x << 16 | x << 24;
              v = k[736] | 0;
              w = k[737] | 0;
              x = 252318 + x | 0;
              y = ((b >>> 1 ^ b) & 1 | 0) != 0;
              h = (b & 1 | 0) != 0;
              g = 0;
              while (1) {
                switch ((g | 0) % 2 | 0 | 0) {
                  case 0:
                    {
                      a = y;
                      break;
                    }
                  case 1:
                    {
                      a = h;
                      break;
                    }
                  default:
                    a = 0;
                }
                t = a & 1;
                s = t + C | 0;
                q = (g + R | 0) < 247;
                p = i[252574 + d >> 0] | 0;
                o = 0;
                j = c;
                while (1) {
                  if ((p & 1) != 0 ? q & (s + o | 0) < 159 : 0) {
                    u = j + t | 0;
                    b = k[285] | 0;
                    n = k[286] | 0;
                    if (b >>> 0 < u >>> 0 & n >>> 0 > u >>> 0) {
                      k[v + u >> 2] = f;
                      n = w + u | 0;
                      b = k[n >> 2] | e;
                      k[n >> 2] = b;
                      i[x >> 0] = b >>> 8 | b | b >>> 16 | b >>> 24 | l[x >> 0];
                      b = k[285] | 0;
                      n = k[286] | 0;
                    }
                    m = u + 340 | 0;
                    if (b >>> 0 < m >>> 0 & n >>> 0 > m >>> 0) {
                      k[v + m >> 2] = f;
                      n = w + m | 0;
                      b = k[n >> 2] | e;
                      k[n >> 2] = b;
                      i[x >> 0] = b >>> 8 | b | b >>> 16 | b >>> 24 | l[x >> 0];
                      b = k[285] | 0;
                      n = k[286] | 0;
                    }
                    m = u + 680 | 0;
                    if (b >>> 0 < m >>> 0 & n >>> 0 > m >>> 0) {
                      k[v + m >> 2] = f;
                      n = w + m | 0;
                      b = k[n >> 2] | e;
                      k[n >> 2] = b;
                      i[x >> 0] = b >>> 8 | b | b >>> 16 | b >>> 24 | l[x >> 0];
                      b = k[285] | 0;
                      n = k[286] | 0;
                    }
                    a = u + 1020 | 0;
                    if (b >>> 0 < a >>> 0 & n >>> 0 > a >>> 0) {
                      k[v + a >> 2] = f;
                      P = w + a | 0;
                      Q = k[P >> 2] | e;
                      k[P >> 2] = Q;
                      i[x >> 0] = Q >>> 8 | Q | Q >>> 16 | Q >>> 24 | l[x >> 0];
                    }
                  }
                  o = o + 1 | 0;
                  if ((o | 0) == 8)
                    break;
                  else {
                    p = (p & 255) >>> 1;
                    j = j + 4 | 0;
                  }
                }
                g = g + 1 | 0;
                if ((g | 0) == 8)
                  break a;
                else {
                  c = c + 1360 | 0;
                  d = d + 1 | 0;
                }
              }
            }
          }
 while (0);
        A = A + -4 | 0;
        if ((A | 0) <= -1)
          break;
        else
          B = (B & 255) >>> 1;
      }
      r = S;
      return ;
    }
    function kd() {
      return ;
    }
    function ld() {
      oe(k[738] | 0) | 0;
      oe(k[739] | 0) | 0;
      return ;
    }
    function md() {
      var a = 0,
          b = 0,
          c = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          m = 0;
      a = k[738] | 0;
      Md(k[736] | 0, 9, 5, 331, 245, k[a + 4 >> 2] | 0, k[a + 8 >> 2] | 0);
      a = k[738] | 0;
      b = k[a + 8 >> 2] | 0;
      if ((b | 0) > 0) {
        f = 0;
        do {
          c = k[739] | 0;
          b = c + 4 | 0;
          m = ia(k[b >> 2] | 0, f) | 0;
          c = k[c >> 2] | 0;
          d = a + 4 | 0;
          g = k[d >> 2] | 0;
          h = ia(g, f) | 0;
          e = k[a >> 2] | 0;
          g = (hf(c + m | 0, e + h | 0, g) | 0) == 0;
          k[2964 + (f << 2) >> 2] = g & 1;
          if (!g) {
            m = c + (ia(k[b >> 2] | 0, f) | 0) | 0;
            a = k[d >> 2] | 0;
            vf(m | 0, e + (ia(a, f) | 0) | 0, a | 0) | 0;
            a = k[738] | 0;
          }
          f = f + 1 | 0;
          b = k[a + 8 >> 2] | 0;
        } while ((f | 0) < (b | 0));
      }
      h = k[740] | 0;
      m = a + 8 | 0;
      k[2964 + (((h | 0) % (b | 0) | 0) << 2) >> 2] = 0;
      k[2964 + (((h + 1 | 0) % (k[m >> 2] | 0) | 0) << 2) >> 2] = 0;
      k[2964 + (((h + 2 | 0) % (k[m >> 2] | 0) | 0) << 2) >> 2] = 0;
      k[2964 + (((h + 3 | 0) % (k[m >> 2] | 0) | 0) << 2) >> 2] = 0;
      k[2964 + (((h + 4 | 0) % (k[m >> 2] | 0) | 0) << 2) >> 2] = 0;
      k[2964 + (((h + 5 | 0) % (k[m >> 2] | 0) | 0) << 2) >> 2] = 0;
      k[2964 + (((h + 6 | 0) % (k[m >> 2] | 0) | 0) << 2) >> 2] = 0;
      k[2964 + (((h + 7 | 0) % (k[m >> 2] | 0) | 0) << 2) >> 2] = 0;
      k[2964 + (((h + 8 | 0) % (k[m >> 2] | 0) | 0) << 2) >> 2] = 0;
      k[2964 + (((h + 9 | 0) % (k[m >> 2] | 0) | 0) << 2) >> 2] = 0;
      k[740] = (h + 10 | 0) % (k[m >> 2] | 0) | 0;
      if ((k[287] | 0) > 1 & (k[309] | 0) != 0) {
        c = 0;
        do {
          d = c + 2 | 0;
          if (!(k[2964 + (d << 2) >> 2] | 0)) {
            a = k[738] | 0;
            e = k[a + 4 >> 2] | 0;
            b = ia(e, d) | 0;
            if ((e | 0) > 0) {
              f = 0;
              do {
                a = (k[a >> 2] | 0) + (b + f) | 0;
                i[a >> 0] = (l[a >> 0] | 0) + 16;
                f = f + 1 | 0;
                a = k[738] | 0;
                e = k[a + 4 >> 2] | 0;
                b = ia(e, d) | 0;
              } while ((f | 0) < (e | 0));
            }
            h = k[739] | 0;
            m = ia(k[h + 4 >> 2] | 0, d) | 0;
            vf((k[a >> 2] | 0) + b | 0, (k[h >> 2] | 0) + m | 0, e | 0) | 0;
          }
          c = c + 1 | 0;
        } while ((c | 0) != 240);
        a = k[738] | 0;
      }
      b = k[a >> 2] | 0;
      e = 0;
      c = 6412;
      while (1) {
        a = e * 340 | 0;
        d = 0;
        f = c;
        while (1) {
          m = l[b + (d + a) >> 0] | 0;
          j[f >> 1] = (l[299725 + (m * 3 | 0) + 1 >> 0] | 0) >>> 1 << 6 | (l[299725 + (m * 3 | 0) >> 0] | 0) >>> 1 << 11 | (l[299725 + (m * 3 | 0) + 2 >> 0] | 0) >>> 1;
          d = d + 1 | 0;
          if ((d | 0) == 340)
            break;
          else
            f = f + 2 | 0;
        }
        e = e + 1 | 0;
        if ((e | 0) == 250)
          break;
        else
          c = c + 800 | 0;
      }
      return ;
    }
    function nd() {
      Nd(k[737] | 0);
      i[252320] = 0;
      i[252319] = 0;
      i[252326] = 0;
      i[252322] = 0;
      i[252350] = 0;
      i[252334] = 0;
      i[252446] = 0;
      i[252382] = 0;
      return ;
    }
    function od() {
      mf(k[737] | 0);
      return ;
    }
    function pd() {
      var a = 0,
          b = 0,
          c = 0,
          d = 0,
          e = 0;
      a = (k[319] | 0) != 0 & 1;
      b = 0;
      do {
        d = k[4964 + (a << 6) + (b << 2) >> 2] | 0;
        e = d >>> 18 & 63;
        i[299725 + (b * 3 | 0) >> 0] = e;
        c = b + 32 | 0;
        i[299725 + (c * 3 | 0) >> 0] = e;
        e = d >>> 10 & 63;
        i[299725 + (b * 3 | 0) + 1 >> 0] = e;
        i[299725 + (c * 3 | 0) + 1 >> 0] = e;
        d = d >>> 2 & 63;
        i[299725 + (b * 3 | 0) + 2 >> 0] = d;
        i[299725 + (c * 3 | 0) + 2 >> 0] = d;
        b = b + 1 | 0;
      } while ((b | 0) != 16);
      a = 16;
      do {
        d = a + -16 | 0;
        c = (l[299725 + (d * 3 | 0) >> 0] | 0) >>> 1;
        i[299725 + (a * 3 | 0) >> 0] = c;
        e = a + 32 | 0;
        i[299725 + (e * 3 | 0) >> 0] = c;
        c = (l[299725 + (d * 3 | 0) + 1 >> 0] | 0) >>> 1;
        i[299725 + (a * 3 | 0) + 1 >> 0] = c;
        i[299725 + (e * 3 | 0) + 1 >> 0] = c;
        d = (l[299725 + (d * 3 | 0) + 2 >> 0] | 0) >>> 1;
        i[299725 + (a * 3 | 0) + 2 >> 0] = d;
        i[299725 + (e * 3 | 0) + 2 >> 0] = d;
        a = a + 1 | 0;
      } while ((a | 0) != 32);
      a = 64;
      do {
        i[299725 + (a * 3 | 0) + 2 >> 0] = 0;
        i[299725 + (a * 3 | 0) + 1 >> 0] = 0;
        i[299725 + (a * 3 | 0) >> 0] = 0;
        a = a + 1 | 0;
      } while ((a | 0) != 256);
      e = ne(340, 250) | 0;
      k[738] = e;
      e = ne(340, 250) | 0;
      k[739] = e;
      a = k[738] | 0;
      if (!((e | 0) != 0 & (a | 0) != 0)) {
        pb(300493, 45, 1, k[w >> 2] | 0) | 0;
        tb(1);
      }
      k[736] = k[a >> 2];
      a = lf(85e3) | 0;
      k[737] = a;
      if (!a) {
        pb(300539, 48, 1, k[w >> 2] | 0) | 0;
        mf(k[736] | 0);
        tb(1);
      }
      pf(a | 0, 0, 85e3) | 0;
      if (k[299] | 0)
        return ;
      k[287] = 1;
      gd();
      return ;
    }
    function qd() {
      if (!(k[299] | 0))
        Wc();
      id();
      _c();
      k[329] = 1;
      return ;
    }
    function rd() {
      var a = 0,
          b = 0;
      b = ((k[306] | 0) * 15 | 0) / 100 | 0;
      k[1273] = ((k[1273] | 0) + 1 | 0) % (((b | 0) < 5 ? 5 : b) | 0) | 0;
      k[330] = 0;
      k[331] = (k[331] | 0) - (k[288] | 0);
      k[289] = (k[289] | 0) + 1;
      if (!(k[299] | 0))
        md();
      a = ((l[251278] | 0) & 128 | (l[252737] | 0) & 127) & 255;
      b = i[252744] | 0;
      if ((k[321] | 0) == -1489744609) {
        pf(252830, a | 0, 140) | 0;
        pf(253330, b | 0, 140) | 0;
      } else {
        pf(252830, a | 0, 500) | 0;
        pf(253330, b | 0, 500) | 0;
      }
      b = k[290] | 0;
      k[290] = b + 1;
      if ((b | 0) > 10) {
        k[290] = 0;
        pf(1328, 0, 512) | 0;
        i[253830] = 0;
        i[253831] = 0;
      }
      if (!(k[304] | 0)) {
        k[329] = 0;
        return ;
      }
      k[465] = 0;
      k[329] = 0;
      return ;
    }
    function sd() {
      var a = 0;
      a = ((k[306] | 0) * 15 | 0) / 100 | 0;
      k[1274] = ((k[1274] | 0) + 1 | 0) % (((a | 0) < 5 ? 5 : a) | 0) | 0;
      a = i[252744] | 0;
      pf(252980, ((l[251278] | 0) & 128 | (l[252737] | 0) & 127) & 255 | 0, 350) | 0;
      pf(253480, a | 0, 350) | 0;
      a = k[290] | 0;
      k[290] = a + 1;
      if ((a | 0) > 10) {
        k[290] = 0;
        pf(1328, 0, 512) | 0;
        i[253830] = 0;
        i[253831] = 0;
      }
      if (!(k[304] | 0)) {
        k[329] = 0;
        return ;
      }
      k[465] = 0;
      k[329] = 0;
      return ;
    }
    function td() {
      var a = 0,
          b = 0,
          c = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0;
      k[330] = 0;
      i[253831] = 0;
      i[253830] = 0;
      k[329] = 0;
      k[331] = 0;
      k[460] = 0;
      i[251272] = 0;
      k[461] = 0;
      k[462] = 254152;
      k[1275] = 0;
      pf(252574, 0, 256) | 0;
      pf(253832, 0, 256) | 0;
      a = 254088;
      b = a + 64 | 0;
      do {
        i[a >> 0] = 0;
        a = a + 1 | 0;
      } while ((a | 0) < (b | 0));
      pf(252830, 0, 500) | 0;
      pf(253330, 0, 500) | 0;
      pf(300588, 0, 307200) | 0;
      pf(251806, 0, 512) | 0;
      pf(1328, 0, 512) | 0;
      k[290] = 0;
      k[288] = (k[316] | 0) == 0 ? 5964 : 7259;
      g = k[321] | 0;
      a = (g | 0) == -1489744609;
      if (a) {
        k[291] = 1;
        k[294] = 0;
        k[288] = 7259;
        Od();
        nd();
        return ;
      }
      a: do
        if ((g | 0) < 109451932) {
          if ((g | 0) < -1152723640) {
            if ((g | 0) < -1639782554) {
              if ((g | 0) < -2011370780) {
                switch (g | 0) {
                  case -2108066135:
                    break;
                  default:
                    {
                      b = 0;
                      h = 22;
                      break a;
                    }
                }
                k[294] = 0;
                h = 66;
                break;
              }
              if ((g | 0) < -1688300714) {
                switch (g | 0) {
                  case -2011370780:
                    break;
                  default:
                    {
                      b = 0;
                      h = 22;
                      break a;
                    }
                }
                k[291] = 1;
                k[295] = 3;
                b = 0;
                d = 0;
                c = 1;
                a = 0;
                h = 35;
                break;
              } else {
                switch (g | 0) {
                  case -1688300714:
                    break;
                  default:
                    {
                      b = 0;
                      h = 22;
                      break a;
                    }
                }
                k[294] = 1;
                k[295] = 6;
                k[288] = 7259;
                d = 0;
                c = 0;
                a = 0;
                b = 0;
                h = 51;
                break;
              }
            }
            if ((g | 0) < -1383359776)
              if ((g | 0) < -1518500621) {
                switch (g | 0) {
                  case -1639782554:
                    break;
                  default:
                    {
                      b = 0;
                      h = 22;
                      break a;
                    }
                }
                k[293] = 1;
                k[295] = 0;
                b = 0;
                d = 0;
                c = 0;
                a = 0;
                h = 35;
                break;
              } else {
                switch (g | 0) {
                  case -1518500621:
                    break;
                  default:
                    {
                      b = 0;
                      h = 22;
                      break a;
                    }
                }
                k[294] = 8;
                k[295] = 3;
                k[297] = 1;
                a = 0;
                b = 0;
                break;
              }
            if ((g | 0) < -1187594888) {
              switch (g | 0) {
                case -1383359776:
                  break;
                default:
                  {
                    b = 0;
                    h = 22;
                    break a;
                  }
              }
              k[294] = 2;
              Od();
              nd();
              return ;
            } else {
              switch (g | 0) {
                case -1187594888:
                  break;
                default:
                  {
                    b = 0;
                    h = 22;
                    break a;
                  }
              }
              k[294] = 12;
              Od();
              nd();
              return ;
            }
          }
          if ((g | 0) < -600789699) {
            if ((g | 0) < -792965402) {
              switch (g | 0) {
                case -1152723640:
                  break;
                default:
                  {
                    b = 0;
                    h = 22;
                    break a;
                  }
              }
              k[294] = 11;
              Od();
              nd();
              return ;
            }
            if ((g | 0) < -746499082) {
              switch (g | 0) {
                case -792965402:
                  break;
                default:
                  {
                    b = 0;
                    h = 22;
                    break a;
                  }
              }
              k[294] = 12;
              k[295] = 3;
              k[288] = 7642;
              e = 0;
              d = 0;
              b = 0;
              c = 0;
              a = 1;
              h = 78;
              break;
            } else {
              switch (g | 0) {
                case -746499082:
                  break;
                default:
                  {
                    b = 0;
                    h = 22;
                    break a;
                  }
              }
              k[291] = 1;
              k[292] = 0;
              k[294] = 1;
              k[295] = 3;
              b = 1;
              h = 22;
              break;
            }
          }
          if ((g | 0) < -208617492) {
            if ((g | 0) < -407737770) {
              switch (g | 0) {
                case -600789699:
                  break;
                default:
                  {
                    b = 0;
                    h = 22;
                    break a;
                  }
              }
              k[294] = 10;
              b = 0;
              h = 22;
              break;
            }
            switch (g | 0) {
              case -407737770:
                break;
              default:
                {
                  b = 0;
                  h = 22;
                  break a;
                }
            }
            k[294] = 12;
            Od();
            nd();
            return ;
          } else {
            if ((g | 0) < -75294946) {
              switch (g | 0) {
                case -208617492:
                  break;
                default:
                  {
                    b = 0;
                    h = 22;
                    break a;
                  }
              }
              k[294] = 0;
              h = 66;
              break;
            }
            switch (g | 0) {
              case -75294946:
                break;
              default:
                {
                  b = 0;
                  h = 22;
                  break a;
                }
            }
            k[291] = 1;
            k[292] = 0;
            k[294] = 1;
            k[295] = 3;
            k[288] = 5964;
            Od();
            nd();
            return ;
          }
        } else {
          if ((g | 0) < 1154590885) {
            if ((g | 0) < 539961161) {
              if ((g | 0) < 204359697) {
                switch (g | 0) {
                  case 109451932:
                    break;
                  default:
                    {
                      b = 0;
                      h = 22;
                      break a;
                    }
                }
                k[293] = 1;
                k[288] = 7259;
                Od();
                nd();
                return ;
              }
              if ((g | 0) >= 477430601) {
                switch (g | 0) {
                  case 477430601:
                    break;
                  default:
                    {
                      b = 0;
                      h = 22;
                      break a;
                    }
                }
                k[293] = 1;
                k[295] = 0;
                b = 0;
                d = 0;
                c = 0;
                a = 0;
                h = 35;
                break;
              }
              switch (g | 0) {
                case 204359697:
                  break;
                default:
                  {
                    b = 0;
                    h = 22;
                    break a;
                  }
              }
              k[294] = 11;
              Od();
              nd();
              return ;
            }
            if ((g | 0) < 621116433) {
              if ((g | 0) >= 596755195) {
                switch (g | 0) {
                  case 596755195:
                    break;
                  default:
                    {
                      b = 0;
                      h = 22;
                      break a;
                    }
                }
                k[294] = 11;
                c = 0;
                b = 0;
                d = 0;
                a = 0;
                h = 67;
                break;
              }
              switch (g | 0) {
                case 539961161:
                  break;
                default:
                  {
                    b = 0;
                    h = 22;
                    break a;
                  }
              }
              k[293] = 1;
              k[294] = 0;
              Od();
              nd();
              return ;
            } else {
              if ((g | 0) >= 1006564715) {
                switch (g | 0) {
                  case 1006564715:
                    break;
                  default:
                    {
                      b = 0;
                      h = 22;
                      break a;
                    }
                }
                k[294] = 1;
                k[295] = 6;
                k[288] = 7259;
                d = 0;
                c = 0;
                a = 0;
                b = 0;
                h = 51;
                break;
              }
              switch (g | 0) {
                case 621116433:
                  break;
                default:
                  {
                    b = 0;
                    h = 22;
                    break a;
                  }
              }
              k[294] = 11;
              Od();
              nd();
              return ;
            }
          }
          if ((g | 0) >= 1728485668) {
            if ((g | 0) >= 2014362325)
              if ((g | 0) < 2088006213) {
                switch (g | 0) {
                  case 2014362325:
                    break;
                  default:
                    {
                      b = 0;
                      h = 22;
                      break a;
                    }
                }
                k[294] = 8;
                b = 0;
                h = 22;
                break;
              } else {
                switch (g | 0) {
                  case 2088006213:
                    break;
                  default:
                    {
                      b = 0;
                      h = 22;
                      break a;
                    }
                }
                k[294] = 1;
                k[295] = 6;
                k[288] = 7259;
                d = 0;
                c = 0;
                a = 0;
                b = 0;
                h = 51;
                break;
              }
            if ((g | 0) < 1827384180) {
              switch (g | 0) {
                case 1728485668:
                  break;
                default:
                  {
                    b = 0;
                    h = 22;
                    break a;
                  }
              }
              k[294] = 11;
              b = 0;
              d = 0;
              c = 0;
              a = 0;
              h = 35;
              break;
            }
            switch (g | 0) {
              case 1827384180:
                break;
              default:
                {
                  b = 0;
                  h = 22;
                  break a;
                }
            }
            k[294] = 12;
            Od();
            nd();
            return ;
          }
          if ((g | 0) < 1543683814) {
            if ((g | 0) < 1377203994) {
              switch (g | 0) {
                case 1154590885:
                  break;
                default:
                  {
                    b = 0;
                    h = 22;
                    break a;
                  }
              }
              k[294] = 11;
              b = 0;
              d = 0;
              c = 0;
              a = 0;
              h = 35;
              break;
            }
            switch (g | 0) {
              case 1377203994:
                break;
              default:
                {
                  b = 0;
                  h = 22;
                  break a;
                }
            }
            k[294] = 1;
            k[297] = 1;
            Od();
            nd();
            return ;
          } else {
            if ((g | 0) >= 1638093030) {
              switch (g | 0) {
                case 1638093030:
                  break;
                default:
                  {
                    b = 0;
                    h = 22;
                    break a;
                  }
              }
              k[294] = 0;
              h = 66;
              break;
            }
            switch (g | 0) {
              case 1543683814:
                break;
              default:
                {
                  b = 0;
                  h = 22;
                  break a;
                }
            }
            k[294] = 2;
            Od();
            nd();
            return ;
          }
        }
 while (0);
      if ((h | 0) == 22) {
        b: do
          if ((g | 0) < -1518463196)
            if ((g | 0) < -1667375623) {
              switch (g | 0) {
                case -1785500921:
                  break;
                default:
                  {
                    e = 0;
                    d = 0;
                    break b;
                  }
              }
              k[295] = 3;
              e = 0;
              d = 0;
              break;
            } else {
              switch (g | 0) {
                case -1667375623:
                  break;
                default:
                  {
                    e = 0;
                    d = 0;
                    break b;
                  }
              }
              k[295] = 3;
              e = 0;
              d = 0;
              break;
            }
          else {
            if ((g | 0) < -1102056306) {
              switch (g | 0) {
                case -1518463196:
                  break;
                default:
                  {
                    e = 0;
                    d = 0;
                    break b;
                  }
              }
              k[295] = 12;
              e = 1;
              d = 0;
              break;
            }
            if ((g | 0) < -48783507) {
              switch (g | 0) {
                case -1102056306:
                  break;
                default:
                  {
                    e = 0;
                    d = 0;
                    break b;
                  }
              }
              k[295] = 12;
              e = 0;
              d = 1;
              break;
            } else {
              switch (g | 0) {
                case -48783507:
                  break;
                default:
                  {
                    e = 0;
                    d = 0;
                    break b;
                  }
              }
              k[295] = 3;
              e = 0;
              d = 0;
              break;
            }
          }
 while (0);
        if (a) {
          k[288] = 7259;
          f = b;
          c = 0;
          a = e;
          b = 0;
          e = 0;
          h = 59;
        } else {
          c = 0;
          a = e;
          h = 35;
        }
      } else if ((h | 0) == 66) {
        k[288] = 7642;
        d = 0;
        b = 0;
        c = 0;
        a = 0;
        h = 84;
      }
      c: do
        if ((h | 0) == 35) {
          if ((g | 0) < 649133915) {
            if ((g | 0) < -1355778727)
              if ((g | 0) < -1786391279) {
                switch (g | 0) {
                  case -1831856261:
                    break;
                  default:
                    {
                      h = 51;
                      break c;
                    }
                }
                k[288] = 7259;
                f = b;
                b = 0;
                e = 0;
                h = 59;
                break;
              } else {
                switch (g | 0) {
                  case -1786391279:
                    break;
                  default:
                    {
                      h = 51;
                      break c;
                    }
                }
                k[288] = 7259;
                f = b;
                b = 0;
                e = 0;
                h = 59;
                break;
              }
            if ((g | 0) < -782700870) {
              switch (g | 0) {
                case -1355778727:
                  break;
                default:
                  {
                    h = 51;
                    break c;
                  }
              }
              k[288] = 7259;
              f = b;
              b = 0;
              e = 0;
              h = 59;
              break;
            }
            if ((g | 0) < -550082497) {
              switch (g | 0) {
                case -782700870:
                  break;
                default:
                  {
                    h = 51;
                    break c;
                  }
              }
              k[288] = 7259;
              f = b;
              b = 0;
              e = 0;
              h = 59;
              break;
            } else {
              switch (g | 0) {
                case -550082497:
                  break;
                default:
                  {
                    h = 51;
                    break c;
                  }
              }
              k[288] = 7259;
              f = b;
              b = 0;
              e = 0;
              h = 59;
              break;
            }
          }
          if ((g | 0) < 971185136) {
            if ((g | 0) < 861011674) {
              switch (g | 0) {
                case 649133915:
                  break;
                default:
                  {
                    h = 51;
                    break c;
                  }
              }
              k[288] = 7259;
              f = b;
              b = 0;
              e = 0;
              h = 59;
              break;
            }
            if ((g | 0) < 966300772) {
              switch (g | 0) {
                case 861011674:
                  break;
                default:
                  {
                    h = 51;
                    break c;
                  }
              }
              k[288] = 7259;
              f = b;
              b = 0;
              e = 0;
              h = 59;
              break;
            } else {
              switch (g | 0) {
                case 966300772:
                  break;
                default:
                  {
                    h = 51;
                    break c;
                  }
              }
              k[288] = 7259;
              f = b;
              b = 0;
              e = 0;
              h = 59;
              break;
            }
          } else {
            if ((g | 0) < 1085146669) {
              switch (g | 0) {
                case 971185136:
                  break;
                default:
                  {
                    h = 51;
                    break c;
                  }
              }
              k[288] = 7259;
              f = b;
              b = 0;
              e = 0;
              h = 59;
              break;
            }
            if ((g | 0) < 1492805478) {
              switch (g | 0) {
                case 1085146669:
                  break;
                default:
                  {
                    h = 51;
                    break c;
                  }
              }
              k[288] = 7259;
              f = b;
              b = 0;
              e = 0;
              h = 59;
              break;
            } else {
              switch (g | 0) {
                case 1492805478:
                  break;
                default:
                  {
                    h = 51;
                    break c;
                  }
              }
              k[288] = 7259;
              f = b;
              b = 0;
              e = 0;
              h = 59;
              break;
            }
          }
        }
 while (0);
      d: do
        if ((h | 0) == 51) {
          e: do
            if ((g | 0) < 187558753) {
              if ((g | 0) >= -1005367816) {
                if ((g | 0) >= 34589205)
                  switch (g | 0) {
                    case 34589205:
                      {
                        h = 53;
                        break e;
                      }
                    default:
                      {
                        f = b;
                        b = 0;
                        e = 0;
                        h = 59;
                        break d;
                      }
                  }
                switch (g | 0) {
                  case -1005367816:
                    break;
                  default:
                    {
                      f = b;
                      b = 0;
                      e = 0;
                      h = 59;
                      break d;
                    }
                }
                k[288] = 7259;
                f = b;
                b = 1;
                e = 0;
                h = 59;
                break d;
              }
              if ((g | 0) < -1292832588) {
                switch (g | 0) {
                  case -1653418775:
                    break;
                  default:
                    {
                      f = b;
                      b = 0;
                      e = 0;
                      h = 59;
                      break d;
                    }
                }
                k[288] = 7259;
                f = b;
                b = 0;
                e = 0;
                h = 59;
                break d;
              } else {
                switch (g | 0) {
                  case -1292832588:
                    break;
                  default:
                    {
                      f = b;
                      b = 0;
                      e = 0;
                      h = 59;
                      break d;
                    }
                }
                k[288] = 7259;
                f = b;
                b = 0;
                e = 0;
                h = 59;
                break d;
              }
            } else if ((g | 0) < 825575403)
              if ((g | 0) < 221082141)
                switch (g | 0) {
                  case 187558753:
                    {
                      h = 57;
                      break e;
                    }
                  default:
                    {
                      f = b;
                      b = 0;
                      e = 0;
                      h = 59;
                      break d;
                    }
                }
              else
                switch (g | 0) {
                  case 221082141:
                    {
                      h = 54;
                      break e;
                    }
                  default:
                    {
                      f = b;
                      b = 0;
                      e = 0;
                      h = 59;
                      break d;
                    }
                }
            else if ((g | 0) < 1750470087)
              switch (g | 0) {
                case 825575403:
                  {
                    h = 58;
                    break e;
                  }
                default:
                  {
                    f = b;
                    b = 0;
                    e = 0;
                    h = 59;
                    break d;
                  }
              }
            else
              switch (g | 0) {
                case 1750470087:
                  {
                    h = 53;
                    break e;
                  }
                default:
                  {
                    f = b;
                    b = 0;
                    e = 0;
                    h = 59;
                    break d;
                  }
              }
 while (0);
          f: do
            if ((h | 0) == 53) {
              k[288] = 7259;
              if ((g | 0) < 221082141)
                switch (g | 0) {
                  case 187558753:
                    {
                      h = 57;
                      break f;
                    }
                  default:
                    {
                      f = b;
                      b = 0;
                      e = 0;
                      h = 59;
                      break d;
                    }
                }
              if ((g | 0) < 825575403)
                switch (g | 0) {
                  case 221082141:
                    {
                      h = 54;
                      break f;
                    }
                  default:
                    {
                      f = b;
                      b = 0;
                      e = 0;
                      h = 59;
                      break d;
                    }
                }
              else
                switch (g | 0) {
                  case 825575403:
                    {
                      h = 58;
                      break f;
                    }
                  default:
                    {
                      f = b;
                      b = 0;
                      e = 0;
                      h = 59;
                      break d;
                    }
                }
            }
 while (0);
          if ((h | 0) == 54) {
            k[288] = 7259;
            f = b;
            b = 0;
            e = 1;
            h = 59;
            break;
          } else if ((h | 0) == 57) {
            k[288] = 7259;
            f = b;
            b = 0;
            e = 0;
            h = 59;
            break;
          } else if ((h | 0) == 58) {
            k[288] = 7259;
            f = b;
            b = 0;
            e = 0;
            h = 59;
            break;
          }
        }
 while (0);
      if ((h | 0) == 59) {
        if (a) {
          k[288] = 5964;
          if (d) {
            a = 1;
            h = 62;
          } else
            a = 1;
        } else if (d) {
          a = 0;
          h = 62;
        } else
          a = 0;
        if ((h | 0) == 62)
          k[288] = 5964;
        if (f) {
          k[288] = 5964;
          d = e;
          h = 67;
        } else {
          d = e;
          h = 67;
        }
      }
      g: do
        if ((h | 0) == 67) {
          h: do
            if ((g | 0) < -1291865261) {
              if ((g | 0) < -2042798547) {
                if ((g | 0) >= -2108066135)
                  switch (g | 0) {
                    case -2108066135:
                      {
                        h = 76;
                        break h;
                      }
                    default:
                      {
                        e = a;
                        a = 0;
                        h = 78;
                        break g;
                      }
                  }
                switch (g | 0) {
                  case -2117992042:
                    break;
                  default:
                    {
                      e = a;
                      a = 0;
                      h = 78;
                      break g;
                    }
                }
                k[288] = 12e3;
                break;
              }
              if ((g | 0) < -1736118474) {
                switch (g | 0) {
                  case -2042798547:
                    break;
                  default:
                    {
                      e = a;
                      a = 0;
                      h = 78;
                      break g;
                    }
                }
                k[288] = 5964;
                break;
              }
              if ((g | 0) < -1677967871) {
                switch (g | 0) {
                  case -1736118474:
                    break;
                  default:
                    {
                      e = a;
                      a = 0;
                      h = 78;
                      break g;
                    }
                }
                k[288] = 5964;
                break;
              } else {
                switch (g | 0) {
                  case -1677967871:
                    break;
                  default:
                    {
                      e = a;
                      a = 0;
                      h = 78;
                      break g;
                    }
                }
                k[288] = 5964;
                break;
              }
            } else if ((g | 0) < 1247251966) {
              if ((g | 0) < -702016349) {
                switch (g | 0) {
                  case -1291865261:
                    break;
                  default:
                    {
                      e = a;
                      a = 0;
                      h = 78;
                      break g;
                    }
                }
                k[288] = 12e3;
                break;
              }
              if ((g | 0) >= -208617492)
                switch (g | 0) {
                  case -208617492:
                    {
                      h = 76;
                      break h;
                    }
                  default:
                    {
                      e = a;
                      a = 0;
                      h = 78;
                      break g;
                    }
                }
              switch (g | 0) {
                case -702016349:
                  break;
                default:
                  {
                    e = a;
                    a = 0;
                    h = 78;
                    break g;
                  }
              }
              k[288] = 12e3;
              break;
            } else {
              if ((g | 0) < 1353686341) {
                switch (g | 0) {
                  case 1247251966:
                    break;
                  default:
                    {
                      e = a;
                      a = 0;
                      h = 78;
                      break g;
                    }
                }
                k[288] = 5964;
                break;
              }
              if ((g | 0) >= 1638093030)
                switch (g | 0) {
                  case 1638093030:
                    {
                      h = 76;
                      break h;
                    }
                  default:
                    {
                      e = a;
                      a = 0;
                      h = 78;
                      break g;
                    }
                }
              switch (g | 0) {
                case 1353686341:
                  break;
                default:
                  {
                    e = a;
                    a = 0;
                    h = 78;
                    break g;
                  }
              }
              k[288] = 5964;
              break;
            }
 while (0);
          if ((h | 0) == 76)
            k[288] = 7642;
          if (a) {
            a = 0;
            h = 82;
          } else {
            a = 0;
            h = 84;
          }
        }
 while (0);
      do
        if ((h | 0) == 78) {
          if ((g | 0) != 642874999)
            if (e) {
              h = 82;
              break;
            } else {
              h = 84;
              break;
            }
          k[288] = 6100;
          k[294] = 12;
          if (!e)
            if (c)
              h = 87;
            else
              h = 88;
          else
            h = 82;
        }
 while (0);
      do
        if ((h | 0) == 82) {
          k[294] = 5;
          k[296] = 1;
          if (c)
            h = 87;
          else
            h = 88;
        } else if ((h | 0) == 84) {
          if ((g | 0) < 768309232)
            switch (g | 0) {
              case -158849228:
                {
                  h = 85;
                  break;
                }
              default:
                h = 86;
            }
          else
            switch (g | 0) {
              case 768309232:
                {
                  h = 85;
                  break;
                }
              default:
                h = 86;
            }
          if ((h | 0) == 85) {
            k[288] = 8e3;
            if (c) {
              h = 87;
              break;
            } else {
              h = 88;
              break;
            }
          } else if ((h | 0) == 86)
            if (c) {
              h = 87;
              break;
            } else {
              h = 88;
              break;
            }
        }
 while (0);
      if ((h | 0) == 87) {
        k[288] = 6100;
        if (a) {
          a = d;
          h = 89;
        } else
          a = d;
      } else if ((h | 0) == 88)
        if (a) {
          a = d;
          h = 89;
        } else
          a = d;
      if ((h | 0) == 89)
        k[297] = 1;
      if ((g | 0) == -1347272823) {
        k[297] = 1;
        if (b)
          h = 93;
        else
          h = 94;
      } else if (b)
        h = 93;
      else
        h = 94;
      if ((h | 0) == 93) {
        k[297] = 1;
        if (a)
          h = 95;
      } else if ((h | 0) == 94 ? a : 0)
        h = 95;
      if ((h | 0) == 95)
        k[297] = 1;
      if ((g | 0) < 1428043938) {
        switch (g | 0) {
          case -743399444:
            break;
          default:
            {
              Od();
              nd();
              return ;
            }
        }
        k[296] = 1;
        Od();
        nd();
        return ;
      } else {
        switch (g | 0) {
          case 1428043938:
            break;
          default:
            {
              Od();
              nd();
              return ;
            }
        }
        k[296] = 1;
        Od();
        nd();
        return ;
      }
    }
    function ud() {
      k[462] = 254152;
      k[1275] = 0;
      return ;
    }
    function vd() {
      return ((k[460] | 0) > 16 | (k[331] | 0) > 5493) & 1 | 0;
    }
    function wd(a) {
      a = a | 0;
      var b = 0,
          c = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0;
      g = a & 255;
      h = g & 128;
      if ((h | 0) != (l[251278] & 128 | 0) ? (b = ~~(+(k[331] | 0) / 22.0 + .1), (b | 0) < 600) : 0) {
        d = k[295] | 0;
        e = l[252737] | 0;
        f = b + 50 | 0;
        a: do
          if ((d | 0) > 0) {
            c = 0;
            while (1) {
              if (i[300588 + (f - c << 9) + (e << 1) + 1 >> 0] | 0) {
                d = 5;
                break;
              }
              if (i[300588 + (c + f << 9) + (e << 1) + 1 >> 0] | 0) {
                d = 7;
                break;
              }
              c = c + 1 | 0;
              if ((c | 0) >= (d | 0)) {
                d = 9;
                break a;
              }
            }
            if ((d | 0) == 5) {
              b = b - c | 0;
              break;
            } else if ((d | 0) == 7) {
              b = c + b | 0;
              break;
            }
          } else
            d = 9;
 while (0);
        if ((d | 0) == 9)
          i[300588 + (f << 9) + (e << 1) + 1 >> 0] = 1;
        if ((b | 0) < 500)
          pf(252830 + b | 0, (l[252737] & 127 | h) & 255 | 0, 500 - b | 0) | 0;
      }
      i[251278] = a;
      switch (k[298] | 0) {
        case 2:
          {
            k[462] = 254152 + ((g & 1 ^ 1) << 12);
            return ;
          }
        case 3:
          {
            k[462] = 254152 + ((g & 3 ^ 3) << 12);
            return ;
          }
        case 4:
          {
            k[462] = 254152 + (((g & 1 | 0) != 0 ? 0 : k[1275] | 0) << 12);
            return ;
          }
        default:
          return ;
      }
    }
    function xd(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
          e = 0,
          f = 0;
      if ((a | 0) >= 600)
        return a | 0;
      d = k[295] | 0;
      e = b & 255;
      f = a + 50 | 0;
      a: do
        if ((d | 0) > 0) {
          b = 0;
          while (1) {
            if (i[300588 + (f - b << 9) + (e << 1) + c >> 0] | 0) {
              d = 4;
              break;
            }
            if (i[300588 + (b + f << 9) + (e << 1) + c >> 0] | 0) {
              d = 6;
              break;
            }
            b = b + 1 | 0;
            if ((b | 0) >= (d | 0))
              break a;
          }
          if ((d | 0) == 4) {
            a = a - b | 0;
            return a | 0;
          } else if ((d | 0) == 6) {
            a = b + a | 0;
            return a | 0;
          }
        }
 while (0);
      i[300588 + (f << 9) + (e << 1) + c >> 0] = 1;
      return a | 0;
    }
    function yd() {
      var a = 0,
          b = 0,
          c = 0,
          d = 0;
      d = l[251279] | 0;
      if (i[251278] & 4) {
        d = (d | 240) & 255;
        i[251279] = d;
        return d | 0;
      }
      c = d & 7;
      do
        if (c >>> 0 < 6) {
          a = k[5104 + (c << 5) >> 2] | 0;
          if (!(i[251806 + a >> 0] | 0))
            a = 255;
          else
            a = (k[628 + (a << 2) >> 2] | 0) == 0 ? 7 : 255;
          b = k[5104 + (c << 5) + 4 >> 2] | 0;
          if (i[251806 + b >> 0] | 0)
            a = (k[628 + (b << 2) >> 2] | 0) == 0 ? 6 : a;
          b = k[5104 + (c << 5) + 8 >> 2] | 0;
          if (i[251806 + b >> 0] | 0)
            a = (k[628 + (b << 2) >> 2] | 0) == 0 ? 5 : a;
          b = k[5104 + (c << 5) + 12 >> 2] | 0;
          if (i[251806 + b >> 0] | 0)
            a = (k[628 + (b << 2) >> 2] | 0) == 0 ? 4 : a;
          b = k[5104 + (c << 5) + 16 >> 2] | 0;
          if (i[251806 + b >> 0] | 0)
            a = (k[628 + (b << 2) >> 2] | 0) == 0 ? 3 : a;
          b = k[5104 + (c << 5) + 20 >> 2] | 0;
          if (i[251806 + b >> 0] | 0)
            a = (k[628 + (b << 2) >> 2] | 0) == 0 ? 2 : a;
          b = k[5104 + (c << 5) + 24 >> 2] | 0;
          if (i[251806 + b >> 0] | 0)
            a = (k[628 + (b << 2) >> 2] | 0) == 0 ? 1 : a;
          c = k[5104 + (c << 5) + 28 >> 2] | 0;
          if ((i[251806 + c >> 0] | 0) != 0 ? (k[628 + (c << 2) >> 2] | 0) == 0 : 0)
            a = 0;
          else if ((a | 0) == 255)
            break;
          d = (d & 15 | a << 5) & 255;
          i[251279] = d;
          return d | 0;
        }
 while (0);
      d = (d | 240) & 255;
      i[251279] = d;
      return d | 0;
    }
    function zd(a) {
      a = a | 0;
      var b = 0,
          c = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          j = 0,
          m = 0,
          n = 0,
          o = 0;
      b = l[251278] | 0;
      if (b & 72) {
        if (!(b & 16)) {
          b = a & 65535;
          if (!((a & 65535) > 127 & (k[318] | 0) != 0)) {
            o = i[253832 + (b & 255) >> 0] | 0;
            return o | 0;
          }
          b = b & 131;
          if ((b | 0) == 131) {
            o = -1;
            return o | 0;
          }
          o = i[253832 + b >> 0] | 0;
          return o | 0;
        }
        if (!(b & 32)) {
          o = Kd(a) | 0;
          return o | 0;
        }
        if (!((b & 2 | 0) == 0 | (k[313] | 0) == 0)) {
          o = i[286920 + ((l[251279] | 0) << 8 | a & 255) >> 0] | 0;
          return o | 0;
        }
        if (!((b & 66 | 0) == 0 & (k[318] | 0) != 0)) {
          o = 0;
          return o | 0;
        }
        o = i[(k[463] | 0) + ((l[253961] | 0) << 12 | a & 255 | (l[251279] | 0) << 8 & 3840) >> 0] | 0;
        return o | 0;
      }
      b = a & 65535;
      switch (b | 0) {
        case 164:
          if (!(i[252734] & 2)) {
            o = i[607789] | 0;
            return o | 0;
          } else {
            o = (k[331] | 0) / 22 | 0;
            o = (o & 254) >>> 0 > 241 ? -1 : o & 255;
            i[607789] = o;
            return o | 0;
          }
        case 165:
          if (!(i[252734] & 2)) {
            o = i[607788] | 0;
            return o | 0;
          } else {
            o = (k[460] | 0) * 12 & 255;
            i[607788] = o;
            return o | 0;
          }
        case 162:
          {
            c = l[252736] | 0;
            d = l[252319] | 0;
            e = l[252320] | 0;
            f = l[252322] | 0;
            g = l[252326] | 0;
            h = l[252334] | 0;
            j = l[252350] | 0;
            m = l[252446] | 0;
            b = 0;
            o = 0;
            a = 1;
            while (1) {
              n = a & 255;
              if (a & c) {
                if (d & n)
                  b = (d & (a ^ 255) | b & 255) & 255;
                if (e & n)
                  b = (e & (a ^ 255) | b & 255) & 255;
                if (f & n)
                  b = (f & (a ^ 255) | b & 255) & 255;
                if (g & n)
                  b = (g & (a ^ 255) | b & 255) & 255;
                if (h & n)
                  b = (h & (a ^ 255) | b & 255) & 255;
                if (j & n)
                  b = (j & (a ^ 255) | b & 255) & 255;
                if (m & n)
                  b = (m & (a ^ 255) | b & 255) & 255;
              }
              o = o + 1 | 0;
              if ((o | 0) == 8)
                break;
              else
                a = n << 1;
            }
            nd();
            o = b;
            return o | 0;
          }
        case 161:
          {
            o = (l[252734] | 0) & 2;
            o = ((k[331] | 0) > 5493 ? o | 8 : o) | (k[460] | 0) < 14;
            o = ((k[145] | 0) == 0 ? o : o | 4) & 255;
            k[145] = 0;
            return o | 0;
          }
        default:
          {
            o = i[252574 + b >> 0] | 0;
            return o | 0;
          }
      }
      return 0;
    }
    function Ad() {
      var a = 0,
          b = 0;
      a = l[251278] | 0;
      if ((a & 24 | 0) != 24) {
        b = 0;
        return b | 0;
      }
      if (!(a & 4))
        b = (i[251279] & 7) == 1;
      else
        b = 0;
      a = b & 1 ^ 1;
      switch (k[(b ? 1200 : 1204) >> 2] & 255 | 0) {
        case 2:
          {
            a = fd(a & 255) | 0;
            break;
          }
        case 1:
          {
            a = fd(a & 255) | 0;
            break;
          }
        default:
          a = -1;
      }
      if (!b) {
        b = i[253830] | 0;
        return (b << 24 >> 24 == 0 ? a : b) | 0;
      }
      b = i[253831] | 0;
      b = b << 24 >> 24 == 0 ? a : b;
      return b | 0;
    }
    function Bd(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0;
      d = i[251278] | 0;
      g = d & 255;
      if (g & 8) {
        if (g & 80) {
          if (d & 32)
            return ;
          Ld(a, b);
          return ;
        }
        b = b & 65535;
        c = b & 255;
        if (c >>> 0 < 128) {
          i[253832 + c >> 0] = a;
          return ;
        }
        if ((k[298] | 0) == 4) {
          g = a & 7 ^ 7;
          k[1275] = g;
          k[462] = 254152 + (((d & 1) != 0 ? 0 : g) << 12);
        }
        if (!(a & 32))
          return ;
        if ((c | 0) == 228)
          return ;
        if ((b & 248 | 0) == 232)
          return ;
        if ((b & 240 | 0) == 224)
          return ;
        return ;
      }
      c = b & 65535;
      switch (b << 16 >> 16) {
        case 170:
          {
            c = k[331] | 0;
            if ((c | 0) < 11e3) {
              b = (c | 0) / 22 | 0;
              g = b + 1 | 0;
              pf(253330 + b | 0, a | 0, ((g | 0) > 500 ? g : 500) - b | 0) | 0;
              b = 170;
            } else
              b = 170;
            break;
          }
        case 160:
          {
            b = i[252734] | 0;
            c = k[331] | 0;
            if ((a & 2) == 0 & (b & 2) != 0 ? (g = (c | 0) / 22 | 0, i[607789] = g, i[607788] = (k[460] | 0) * 12, (g & 254) >>> 0 > 241) : 0)
              i[607789] = -1;
            if ((c | 0) > 5493 ? 1 : b << 24 >> 24 == a << 24 >> 24)
              b = 160;
            else {
              id();
              b = 160;
            }
            break;
          }
        case 163:
          {
            b = ~~(+(k[331] | 0) / 22.0 + .5);
            if ((b | 0) < 600) {
              d = k[295] | 0;
              e = a & 255;
              f = b + 50 | 0;
              a: do
                if ((d | 0) > 0) {
                  c = 0;
                  while (1) {
                    if (i[300588 + (f - c << 9) + (e << 1) + 1 >> 0] | 0) {
                      d = 11;
                      break;
                    }
                    if (i[300588 + (c + f << 9) + (e << 1) + 1 >> 0] | 0) {
                      d = 13;
                      break;
                    }
                    c = c + 1 | 0;
                    if ((c | 0) >= (d | 0)) {
                      d = 15;
                      break a;
                    }
                  }
                  if ((d | 0) == 11) {
                    b = b - c | 0;
                    break;
                  } else if ((d | 0) == 13) {
                    b = c + b | 0;
                    break;
                  }
                } else
                  d = 15;
 while (0);
              if ((d | 0) == 15)
                i[300588 + (f << 9) + (e << 1) + 1 >> 0] = 1;
              if ((b | 0) < 500) {
                pf(252830 + b | 0, (g & 128 | a & 127) & 255 | 0, 500 - b | 0) | 0;
                b = 163;
              } else
                b = 163;
            } else
              b = 163;
            break;
          }
        default:
          if ((b & -64) << 16 >> 16 == 64 & (c & 2 | 0) == 0) {
            b = c & 113;
            if (!(c & 1))
              a = a & 254;
            i[252574 + (b | 12) >> 0] = a;
            i[252574 + (b | 8) >> 0] = a;
            i[252574 + (b | 4) >> 0] = a;
            i[252574 + b >> 0] = a;
            b = b & 65535;
          }
      }
      i[252574 + (b & 65535) >> 0] = a;
      return ;
    }
    function Cd() {
      return ;
    }
    function Dd(a) {
      a = a | 0;
      return ;
    }
    function Ed(a) {
      a = a | 0;
      return ;
    }
    function Fd() {
      return 0;
    }
    function Gd() {
      return ;
    }
    function Hd() {
      return ;
    }
    function Id(a) {
      a = a | 0;
      switch (a & 3 | 0) {
        case 3:
          {
            a = (l[607791] | 0) & 15;
            break;
          }
        case 1:
          {
            a = (l[607790] | 0) & 15;
            break;
          }
        case 2:
          {
            a = (l[607791] | 0) >>> 4;
            break;
          }
        case 0:
          {
            a = (l[607790] | 0) >>> 4;
            break;
          }
        default:
          a = 0;
      }
      return a | 0;
    }
    function Jd(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0;
      b = b & 255;
      c = b & 15;
      switch (a & 3 | 0) {
        case 3:
          {
            i[607791] = (l[607791] | 0) & 240 | c;
            break;
          }
        case 2:
          {
            i[607791] = (l[607791] | 0) & 15 | b << 4;
            break;
          }
        case 1:
          {
            i[607790] = (l[607790] | 0) & 240 | c;
            break;
          }
        case 0:
          {
            i[607790] = (l[607790] | 0) & 15 | b << 4;
            break;
          }
        default:
          {}
      }
      k[1324] = 1;
      return ;
    }
    function Kd(a) {
      a = a | 0;
      var b = 0,
          c = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0;
      e = r;
      r = r + 16 | 0;
      d = e;
      switch (a & 65535 | 0) {
        case 5:
          {
            c = i[607793] | 0;
            b = k[1326] | 0;
            a = k[1327] | 0;
            if (k[1325] | 0) {
              f = i[287944 + (a << 7) + (b << 2) >> 0] | 0;
              a = (l[287944 + (a << 7) + (b << 2) + 1 >> 0] | 0) >>> 7;
              b = f & 255;
              if ((f & 255) < 160) {
                i[607792] = 0;
                f = k[w >> 2] | 0;
                g = k[1328] | 0;
                k[d >> 2] = b;
                k[d + 4 >> 2] = a & 255;
                k[d + 8 >> 2] = g;
                rb(f | 0, 607794, d | 0) | 0;
                a = k[1328] | 0;
              } else {
                g = k[1328] | 0;
                a = l[(b * 10 | 0) + -1600 + g + (293064 + ((a & 255) * 960 | 0)) >> 0] | 0;
                i[607792] = a << 7 | a >>> 7 | a >>> 5 & 2 | a >>> 3 & 4 | a >>> 1 & 8 | a << 1 & 16 | a << 3 & 32 | a << 5 & 64;
                a = g;
              }
              i[607793] = -1;
              k[1328] = (a + 1 | 0) % 10 | 0;
              g = c;
              r = e;
              return g | 0;
            }
            i[607792] = i[287944 + (a << 7) + (b << 2) + 1 >> 0] | 0;
            i[607793] = i[287944 + (a << 7) + (b << 2) >> 0] | 0;
            if (!(k[1329] | 0)) {
              g = c;
              r = e;
              return g | 0;
            }
            g = a + 1 | 0;
            k[1327] = g;
            if ((g | 0) <= 39) {
              g = c;
              r = e;
              return g | 0;
            }
            k[1327] = 0;
            g = b + 1 | 0;
            k[1326] = (g | 0) > 23 ? 0 : g;
            g = c;
            r = e;
            return g | 0;
          }
        case 4:
          {
            g = i[607792] | 0;
            r = e;
            return g | 0;
          }
        default:
          {
            g = 0;
            r = e;
            return g | 0;
          }
      }
      return 0;
    }
    function Ld(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
          d = 0,
          e = 0;
      a: do
        switch (b & 65535 | 0) {
          case 0:
            if (!(k[1325] | 0)) {
              i[287944 + (k[1327] << 7) + (k[1326] << 2) + 1 >> 0] = a;
              break a;
            } else {
              i[607830] = a;
              break a;
            }
          case 1:
            {
              d = k[1326] | 0;
              e = k[1327] | 0;
              b = 287944 + (e << 7) + (d << 2) | 0;
              if (k[1325] | 0) {
                b = i[b >> 0] | 0;
                if ((b & 255) > 159) {
                  c = l[607830] | 0;
                  a = k[1328] | 0;
                  i[((b & 255) * 10 | 0) + -1600 + a + (293064 + (((l[287944 + (e << 7) + (d << 2) + 1 >> 0] | 0) >>> 7 & 255) * 960 | 0)) >> 0] = c << 7 | c >>> 7 | c >>> 5 & 2 | c >>> 3 & 4 | c >>> 1 & 8 | c << 1 & 16 | c << 3 & 32 | c << 5 & 64;
                  b = a;
                } else
                  b = k[1328] | 0;
                k[1328] = (b + 1 | 0) % 10 | 0;
                break a;
              }
              i[b >> 0] = a;
              if (a << 24 >> 24 < 0 & (a & 255) < 160 ? (c = i[287944 + (e << 7) + (d << 2) + 1 >> 0] | 0, c << 24 >> 24 >= 0) : 0) {
                i[287944 + (e << 7) + (d << 2) + 2 >> 0] = a;
                i[287944 + (e << 7) + (d << 2) + 3 >> 0] = c;
              } else {
                i[287944 + (e << 7) + (d << 2) + 3 >> 0] = 0;
                i[287944 + (e << 7) + (d << 2) + 2 >> 0] = 0;
              }
              if ((k[1329] | 0) != 0 ? (a = e + 1 | 0, k[1327] = a, (a | 0) > 39) : 0) {
                k[1327] = 0;
                a = d + 1 | 0;
                k[1326] = (a | 0) > 23 ? 0 : a;
              }
              break;
            }
          case 3:
            switch (a & 224 | 0) {
              case 192:
                {
                  b = i[607831] | 0;
                  if (b & 32) {
                    pb(607833, 33, 1, k[w >> 2] | 0) | 0;
                    b = i[607831] | 0;
                  }
                  k[1330] = ((b & 31) >>> 0) % 24 | 0;
                  break a;
                }
              case 160:
                {
                  i[607832] = i[607831] | 0;
                  break a;
                }
              case 32:
                {
                  k[1326] = (l[607831] | 0) & 31;
                  break a;
                }
              case 128:
                {
                  k[1325] = 0;
                  a = l[607831] | 0;
                  k[1328] = ((a & 31) >>> 0) % 10 | 0;
                  switch (a & 224 | 0) {
                    case 128:
                      {
                        k[1325] = 1;
                        break a;
                      }
                    case 160:
                      {
                        k[1325] = 1;
                        break a;
                      }
                    case 0:
                      {
                        k[1329] = 1;
                        break a;
                      }
                    case 96:
                      {
                        k[1329] = 0;
                        break a;
                      }
                    case 64:
                      {
                        k[1329] = 0;
                        break a;
                      }
                    case 32:
                      {
                        k[1329] = 1;
                        break a;
                      }
                    default:
                      break a;
                  }
                }
              case 64:
                {
                  k[1327] = (((l[607831] | 0) & 63) >>> 0) % 40 | 0;
                  break a;
                }
              case 0:
                {
                  k[1326] = (l[607831] | 0) & 31;
                  k[1327] = 0;
                  break a;
                }
              case 96:
                {
                  a = (k[1327] | 0) + 1 | 0;
                  k[1327] = a;
                  if ((a | 0) <= 39)
                    break a;
                  k[1327] = 0;
                  a = (k[1326] | 0) + 1 | 0;
                  k[1326] = (a | 0) > 23 ? 0 : a;
                  break a;
                }
              default:
                break a;
            }
          case 2:
            {
              i[607831] = a;
              break;
            }
          default:
            {}
        }
 while (0);
      k[1324] = 1;
      return ;
    }
    function Md(a, b, c, d, e, f, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      g = g | 0;
      var h = 0,
          j = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          s = 0,
          t = 0,
          u = 0,
          v = 0,
          w = 0,
          x = 0,
          y = 0,
          z = 0,
          A = 0,
          B = 0,
          C = 0,
          D = 0,
          E = 0,
          F = 0,
          G = 0,
          H = 0,
          I = 0,
          J = 0,
          K = 0,
          L = 0,
          M = 0,
          N = 0,
          O = 0,
          P = 0,
          Q = 0;
      Q = r;
      r = r + 96 | 0;
      N = Q + 64 | 0;
      P = Q;
      if (k[1331] | 0) {
        pf(k[1332] | 0, 0, 85e3) | 0;
        k[1331] = 0;
      }
      h = i[607791] | 0;
      if (h << 24 >> 24 == -1) {
        r = Q;
        return ;
      }
      k[1331] = 1;
      L = (k[1333] | 0) + -1 | 0;
      k[1333] = L;
      if ((L | 0) >= 1) {
        if (k[1324] | 0)
          O = 7;
      } else {
        k[1333] = 100;
        k[1334] = 1 - (k[1334] | 0);
        k[1324] = 1;
        O = 7;
      }
      if ((O | 0) == 7) {
        n = l[607790] | 0;
        k[N >> 2] = n << 3 & 8 ^ 8;
        k[N + 4 >> 2] = n >>> 1 & 8 ^ 8;
        k[N + 8 >> 2] = n << 1 & 8 ^ 8;
        k[N + 12 >> 2] = n >>> 3 & 8 ^ 8;
        k[N + 16 >> 2] = n << 2 & 8 ^ 8;
        k[N + 20 >> 2] = n >>> 2 & 8 ^ 8;
        k[N + 24 >> 2] = n & 8 ^ 8;
        k[N + 28 >> 2] = n >>> 4 & 8 ^ 8;
        n = 0;
        j = 0;
        h = 0;
        do {
          j = (n | 0) == 0 ? 0 : 1 - j | 0;
          I = (h | 0) == 0;
          if (I)
            K = 31;
          else
            K = (h + -1 + (k[1330] | 0) | 0) % 24 | 0;
          J = (j | 0) != 0 ? 2 : 1;
          o = 0;
          t = 0;
          v = 0;
          L = 0;
          x = 0;
          q = 0;
          H = 0;
          while (1) {
            L = (x | 0) == 0 ? 0 : 1 - L | 0;
            G = i[287944 + (H << 7) + (K << 2) >> 0] | 0;
            D = l[287944 + (H << 7) + (K << 2) + 1 >> 0] | 0;
            u = D << 2 & 4 | D & 2 | D >>> 2 & 1;
            F = D >>> 7;
            E = i[287944 + (H << 7) + (K << 2) + 2 >> 0] | 0;
            s = E & 255;
            if (!(E << 24 >> 24))
              E = o;
            else {
              v = l[287944 + (H << 7) + (K << 2) + 3 >> 0] | 0;
              t = v >>> 4;
              E = s & 2;
              t = v >>> 6 & 1 | t & 2 | t << 2 & 4;
              v = s & 1;
              q = s & 4;
            }
            if (!(D & 128)) {
              C = (D & 32 | 0) == 0;
              z = (D & 16 | 0) == 0;
              A = z ? 0 : J;
              B = C ? 0 : (L | 0) != 0 ? 2 : 1;
              C = C ? x : 1;
              n = z ? n : 1;
            } else {
              t = D >>> 4;
              t = D >>> 6 & 1 | t & 2 | t << 2 & 4;
              A = 0;
              B = 0;
              C = x;
            }
            s = (H | 0) == (k[1327] | 0);
            o = (K | 0) == (k[1326] | 0);
            x = i[607832] | 0;
            w = x & 255;
            if ((w & 16 | 0) == 0 | s & o ^ 1)
              z = 0;
            else
              z = (w & 128 | 0) != 0 & (k[1334] | 0) != 0 & 1 ^ 1;
            y = (D & 192 | 0) == 64 & 1;
            if ((w & 128 | 0) != 0 ? (k[1334] | D & 8 | 0) == 0 : 0)
              u = o & (s & (w & 16 | 0) != 0) ? u : t;
            if (I) {
              if (x & 8)
                O = 24;
            } else if (x & 1)
              O = 24;
            do
              if ((O | 0) == 24 ? (O = 0, (v | 0) == 0 | (x & 4) == 0) : 0) {
                if (!((E | 0) != 0 | (x & 2) == 0)) {
                  pe(H, h, -1, (k[317] | 0) != 0 ? 16 : 0, 0, 0, 0, 0, 0);
                  break;
                }
                s = k[N + (t << 2) >> 2] | 0;
                o = k[N + (u << 2) >> 2] | 0;
                if ((z | 0) == (y | 0)) {
                  pe(H, h, G, (s | t) & 255, (o | u) & 255, F & 255, B & 255, A & 255, q & 255);
                  break;
                } else {
                  pe(H, h, G, (o | u) & 255, (s | t) & 255, F & 255, B & 255, A & 255, q & 255);
                  break;
                }
              }
 while (0);
            H = H + 1 | 0;
            if ((H | 0) == 40)
              break;
            else {
              o = E;
              x = C;
            }
          }
          h = h + 1 | 0;
        } while ((h | 0) != 25);
        if ((i[607832] & 32) != 0 ? (M = k[1335] | 0, m = k[M + 8 >> 2] | 0, p = m + -1 | 0, (p | 0) > 9) : 0) {
          h = M;
          while (1) {
            j = k[h + 4 >> 2] | 0;
            if ((j | 0) > 0) {
              n = ((m + -11 | 0) / 2 | 0) + 10 | 0;
              m = 0;
              do {
                O = m + (ia(j, n) | 0) | 0;
                N = k[h >> 2] | 0;
                h = N + (m + (ia(j, p) | 0)) | 0;
                i[h >> 0] = i[N + O >> 0] | 0;
                m = m + 1 | 0;
                h = k[1335] | 0;
                j = k[h + 4 >> 2] | 0;
              } while ((m | 0) < (j | 0));
            }
            j = p + -1 | 0;
            if ((j | 0) > 9) {
              m = p;
              p = j;
            } else
              break;
          }
        }
        k[1324] = 0;
        h = i[607791] | 0;
      }
      s = h & 255;
      q = s & 1 ^ 1;
      k[P + 32 >> 2] = q;
      k[P >> 2] = q;
      q = s >>> 4 & 1 ^ 1;
      k[P + 36 >> 2] = q;
      k[P + 4 >> 2] = q;
      q = s >>> 2 & 1 ^ 1;
      k[P + 40 >> 2] = q;
      k[P + 8 >> 2] = q;
      q = s >>> 6 & 1 ^ 1;
      k[P + 44 >> 2] = q;
      k[P + 12 >> 2] = q;
      q = s >>> 1 & 1 ^ 1;
      k[P + 48 >> 2] = q;
      k[P + 16 >> 2] = q;
      q = s >>> 5 & 1 ^ 1;
      k[P + 52 >> 2] = q;
      k[P + 20 >> 2] = q;
      q = s >>> 3 & 1 ^ 1;
      k[P + 56 >> 2] = q;
      k[P + 24 >> 2] = q;
      s = s >>> 7 ^ 1;
      k[P + 60 >> 2] = s;
      k[P + 28 >> 2] = s;
      s = f - b | 0;
      d = (s | 0) < (d | 0) ? s : d;
      s = g - c | 0;
      s = (s | 0) < (e | 0) ? s : e;
      q = k[1335] | 0;
      p = k[q + 4 >> 2] | 0;
      d = (d | 0) > (p | 0) ? p : d;
      q = k[q + 8 >> 2] | 0;
      s = (s | 0) > (q | 0) ? q : s;
      p = (f | 0) > 0;
      if (p) {
        m = ia(f, c) | 0;
        h = 0;
        n = 0;
        do {
          h = (k[P + (((l[a + (n + m) >> 0] | 0) & 7) << 2) >> 2] | 0) == 0 ? h : 1;
          n = n + 1 | 0;
          j = (h | 0) != 0;
        } while ((n | 0) < (f | 0) & (j ^ 1));
        h = j;
      } else
        h = 0;
      o = (g | 0) > 0;
      if (o) {
        n = 0;
        m = 0;
        do {
          j = a + ((ia(m, f) | 0) + b) | 0;
          n = (k[P + (((l[j >> 0] | 0) & 7) << 2) >> 2] | 0) == 0 ? n : 1;
          m = m + 1 | 0;
          j = (n | 0) != 0;
        } while ((m | 0) < (g | 0) & (j ^ 1));
      } else
        j = 0;
      if (h & (c | 0) > 0) {
        m = 0;
        do {
          if (p)
            pf(a + (ia(m, f) | 0) | 0, 0, f | 0) | 0;
          m = m + 1 | 0;
        } while ((m | 0) != (c | 0));
      }
      if (j & o & (b | 0) > 0) {
        h = 0;
        do {
          pf(a + (ia(h, f) | 0) | 0, 0, b | 0) | 0;
          h = h + 1 | 0;
        } while ((h | 0) != (g | 0));
      }
      if ((s | 0) <= 0) {
        r = Q;
        return ;
      }
      J = d + -4 | 0;
      I = a;
      M = c + -1 - g | 0;
      L = ~q;
      L = (M | 0) > (L | 0) ? M : L;
      M = ~e;
      M = ~((L | 0) > (M | 0) ? L : M);
      L = (d | 0) > 0;
      K = 0;
      do {
        j = k[1335] | 0;
        a: do
          if (L) {
            m = a + ((ia(K + c | 0, f) | 0) + b) | 0;
            N = (k[j >> 2] | 0) + (ia(k[j + 4 >> 2] | 0, K) | 0) | 0;
            n = 0;
            while (1) {
              t = (k[317] | 0) == 0;
              j = m;
              o = n;
              b: while (1) {
                m = j + 1 | 0;
                p = i[j >> 0] | 0;
                h = p & 255;
                n = o + 1 | 0;
                if (!(n + b & 3)) {
                  q = h << 8 | h | h << 16 | h << 24;
                  c: do
                    if ((n | 0) < (J | 0)) {
                      s = j + 5 | 0;
                      while (1) {
                        if ((k[m >> 2] | 0) != (q | 0))
                          break c;
                        n = n + 4 | 0;
                        if ((n | 0) < (J | 0)) {
                          m = s;
                          s = s + 4 | 0;
                        } else
                          break;
                      }
                    }
 while (0);
                  m = j + (n - o) | 0;
                }
                do
                  if ((p & 255) < 16) {
                    o = n - o | 0;
                    if (!(k[P + (h << 2) >> 2] | 0))
                      if ((o | 0) > 0) {
                        O = 65;
                        break b;
                      } else
                        break;
                    if (t) {
                      O = 70;
                      break b;
                    }
                    if ((o | 0) > 0) {
                      O = 68;
                      break b;
                    }
                  }
 while (0);
                if ((n | 0) < (d | 0)) {
                  j = m;
                  o = n;
                } else
                  break a;
              }
              if ((O | 0) == 65) {
                q = 0;
                s = N;
                do {
                  p = l[s >> 0] | 0;
                  s = s + 1 | 0;
                  if (!((k[317] | 0) != 0 & (p & 16 | 0) != 0)) {
                    h = j + 1 | 0;
                    if (!(p & 8))
                      j = h;
                    else {
                      i[(k[1332] | 0) + (j - I) >> 0] = 64;
                      j = h;
                    }
                  } else {
                    i[j >> 0] = p & 15;
                    j = j + 1 | 0;
                  }
                  q = q + 1 | 0;
                } while ((q | 0) != (o | 0));
              } else if ((O | 0) == 68) {
                h = 0;
                p = N;
                while (1) {
                  i[j >> 0] = (l[p >> 0] | 0) & 15;
                  h = h + 1 | 0;
                  if ((h | 0) == (o | 0))
                    break;
                  else {
                    p = p + 1 | 0;
                    j = j + 1 | 0;
                  }
                }
              } else if ((O | 0) == 70)
                vf(j | 0, N | 0, o | 0) | 0;
              if ((n | 0) < (d | 0))
                N = N + o | 0;
              else
                break;
            }
          }
 while (0);
        K = K + 1 | 0;
      } while ((K | 0) != (M | 0));
      r = Q;
      return ;
    }
    function Nd(a) {
      a = a | 0;
      if (!(k[1331] | 0)) {
        pf(a | 0, 0, 85e3) | 0;
        return ;
      } else {
        vf(a | 0, k[1332] | 0, 85e3) | 0;
        return ;
      }
    }
    function Od() {
      var a = 0,
          b = 0;
      a = k[1335] | 0;
      if (!a) {
        a = ne(320, 250) | 0;
        k[1335] = a;
      }
      b = k[1332] | 0;
      if (!b) {
        b = lf(85e3) | 0;
        k[1332] = b;
      }
      if ((a | 0) != 0 & (b | 0) != 0) {
        pf(b | 0, 0, 85e3) | 0;
        i[607791] = -1;
        i[607790] = -1;
        k[1327] = 0;
        k[1326] = 0;
        k[1330] = 0;
        i[607832] = 0;
        k[1329] = 1;
        i[607831] = 0;
        k[1333] = 0;
        k[1334] = 0;
        k[1328] = 0;
        k[1325] = 0;
        k[1324] = 1;
        k[1331] = 1;
        pf(293064, 0, 1920) | 0;
        pf(287944, 0, 5120) | 0;
        return ;
      } else {
        pb(607867, 55, 1, k[w >> 2] | 0) | 0;
        tb(1);
      }
    }
    function Pd(a) {
      a = a | 0;
      k[1336] = a;
      return ;
    }
    function Qd(a) {
      a = a | 0;
      k[1337] = a;
      return ;
    }
    function Rd(a) {
      a = a | 0;
      k[1338] = a;
      return ;
    }
    function Sd(a) {
      a = a | 0;
      k[1339] = a;
      return ;
    }
    function Td(a) {
      a = a | 0;
      k[1340] = a;
      return ;
    }
    function Ud(a) {
      a = a | 0;
      k[1341] = a;
      return ;
    }
    function Vd() {
      return ;
    }
    function Wd(a) {
      a = a | 0;
      k[a >> 2] = 0;
      k[a + 4 >> 2] = 0;
      k[a + 8 >> 2] = 0;
      k[a + 12 >> 2] = 0;
      k[a >> 2] = 607923;
      k[a + 4 >> 2] = 607928;
      i[a + 12 >> 0] = 1;
      k[a + 8 >> 2] = 607933;
      return ;
    }
    function Xd(a) {
      a = a | 0;
      k[a >> 2] = 0;
      k[a + 4 >> 2] = 0;
      k[a + 8 >> 2] = 0;
      k[a + 12 >> 2] = 0;
      k[a + 16 >> 2] = 0;
      k[a + 20 >> 2] = 0;
      k[a + 24 >> 2] = 0;
      k[a + 28 >> 2] = 0;
      p[a + 24 >> 3] = (k[288] | 0) == 5964 ? 60.0 : 50.0;
      p[a + 32 >> 3] = 44100.0;
      k[a >> 2] = 340;
      k[a + 4 >> 2] = 250;
      k[a + 8 >> 2] = 340;
      k[a + 12 >> 2] = 250;
      o[a + 16 >> 2] = 1.3333333730697632;
      return ;
    }
    function Yd(a, b) {
      a = a | 0;
      b = b | 0;
      return ;
    }
    function Zd() {
      return 0;
    }
    function _d(a, b) {
      a = a | 0;
      b = b | 0;
      return 0;
    }
    function $d(a, b) {
      a = a | 0;
      b = b | 0;
      return 0;
    }
    function ae() {
      return ;
    }
    function be(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ;
    }
    function ce(a) {
      a = a | 0;
      var b = 0,
          c = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          j = 0,
          l = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          s = 0,
          t = 0,
          u = 0,
          v = 0,
          x = 0,
          y = 0,
          z = 0,
          A = 0,
          B = 0,
          C = 0,
          D = 0,
          E = 0,
          F = 0,
          G = 0,
          H = 0,
          I = 0,
          J = 0;
      I = r;
      r = r + 736 | 0;
      H = I + 248 | 0;
      F = I + 224 | 0;
      E = I;
      B = I + 128 | 0;
      A = I + 176 | 0;
      z = I + 16 | 0;
      D = I + 24 | 0;
      C = I + 160 | 0;
      y = I + 200 | 0;
      x = I + 216 | 0;
      v = I + 232 | 0;
      u = I + 240 | 0;
      t = I + 136 | 0;
      s = I + 144 | 0;
      q = I + 152 | 0;
      p = I + 168 | 0;
      o = I + 184 | 0;
      n = I + 32 | 0;
      m = I + 192 | 0;
      h = I + 8 | 0;
      f = I + 40 | 0;
      g = I + 208 | 0;
      e = I + 120 | 0;
      j = I + 480 | 0;
      c = I + 476 | 0;
      J = I + 472 | 0;
      d = I + 252 | 0;
      k[J >> 2] = 2;
      if (!(Dc[k[5344 >> 2] & 63](10, J) | 0)) {
        b = k[1342] | 0;
        if (!b) {
          J = 0;
          r = I;
          return J | 0;
        }
        zc[b & 63](1, 607937, e);
        J = 0;
        r = I;
        return J | 0;
      }
      vf(d | 0, 5372, 220) | 0;
      Dc[k[5344 >> 2] & 63](11, d) | 0;
      e = k[a >> 2] | 0;
      k[c >> 2] = 0;
      Dc[k[5344 >> 2] & 63](9, c) | 0;
      d = k[c >> 2] | 0;
      do
        if (!d) {
          b = k[1342] | 0;
          if (!b)
            b = 0;
          else {
            zc[b & 63](2, 607971, g);
            b = 0;
          }
        } else {
          k[f >> 2] = d;
          k[f + 4 >> 2] = 47;
          k[f + 8 >> 2] = 608045;
          df(j, 256, 608038, f) | 0;
          if (nb(j | 0, f | 0) | 0) {
            b = k[1342] | 0;
            if (!b) {
              b = 0;
              break;
            }
            zc[b & 63](2, 608055, h);
            b = 0;
            break;
          }
          k[299] = 0;
          k[301] = 1;
          k[300] = 1;
          k[303] = 0;
          k[302] = 0;
          ed();
          k[298] = 0;
          k[304] = 1;
          k[305] = 1;
          k[306] = 100;
          k[307] = 2;
          k[308] = 0;
          k[309] = 0;
          k[310] = 1;
          k[322] = 608102;
          k[311] = 100;
          k[312] = 100;
          k[315] = 0;
          k[313] = 0;
          k[314] = 0;
          k[321] = 0;
          k[323] = 608113;
          k[328] = 612209;
          k[316] = 0;
          k[317] = 0;
          k[319] = 0;
          k[320] = 0;
          k[324] = 0;
          k[325] = 0;
          k[326] = 0;
          k[327] = 65535;
          k[318] = 0;
          d = 616305;
          a = 620401;
          c = d + 14 | 0;
          do {
            i[d >> 0] = i[a >> 0] | 0;
            d = d + 1 | 0;
            a = a + 1 | 0;
          } while ((d | 0) < (c | 0));
          Xc();
          J = cd(e) | 0;
          k[321] = J;
          k[477] = 1;
          k[476] = J;
          J = j + ((qf(j | 0) | 0) + -1) | 0;
          switch (i[J >> 0] | 0) {
            case 58:
            case 92:
            case 47:
              {
                wf(620415, j | 0) | 0;
                rf(620415, 624521) | 0;
                d = lb(620415, 628617) | 0;
                if (!d) {
                  wf(620415, j | 0) | 0;
                  rf(620415, 624521) | 0;
                  d = lb(620415, 628617) | 0;
                  G = 14;
                } else
                  l = d;
                break;
              }
            default:
              {
                wf(620415, j | 0) | 0;
                d = lb(j | 0, 628617) | 0;
                G = 14;
              }
          }
          if ((G | 0) == 14)
            if (!d) {
              J = k[w >> 2] | 0;
              k[m >> 2] = 620415;
              rb(J | 0, 628620, m | 0) | 0;
              tb(1);
            } else
              l = d;
          if ((Na(254152, 1024, 1, l | 0) | 0) != 1) {
            J = k[w >> 2] | 0;
            k[n >> 2] = 624521;
            rb(J | 0, 628649, n | 0) | 0;
            tb(1);
          }
          wf(620415, j | 0) | 0;
          a = lb(j | 0, 628617) | 0;
          if (!a) {
            J = k[w >> 2] | 0;
            k[o >> 2] = 620415;
            rb(J | 0, 628620, o | 0) | 0;
            tb(1);
          }
          if ((Na(254152, 1024, 1, a | 0) | 0) != 1) {
            J = k[w >> 2] | 0;
            k[p >> 2] = 624521;
            rb(J | 0, 628649, p | 0) | 0;
            tb(1);
          }
          Gb(a | 0) | 0;
          vf(258248, 254152, 1024) | 0;
          vf(262344, 254152, 1024) | 0;
          vf(266440, 254152, 1024) | 0;
          vf(270536, 254152, 1024) | 0;
          vf(274632, 254152, 1024) | 0;
          vf(278728, 254152, 1024) | 0;
          vf(282824, 254152, 1024) | 0;
          a = bd(254152, 1024) | 0;
          a: do
            if ((a | 0) < -502620351) {
              if ((a | 0) < -1558648618) {
                switch (a | 0) {
                  case -2146000107:
                    break;
                  default:
                    {
                      G = 33;
                      break a;
                    }
                }
                Ya(628676) | 0;
                k[319] = 0;
                k[320] = 1;
                break;
              }
              switch (a | 0) {
                case -1558648618:
                  break;
                default:
                  {
                    G = 33;
                    break a;
                  }
              }
              if ((k[477] | 0) == 0 & (k[479] | 0) != 0)
                Ya(628753) | 0;
              else
                Ya(628733) | 0;
              k[319] = 0;
              k[320] = 3;
            } else {
              if ((a | 0) < 291798181) {
                switch (a | 0) {
                  case -502620351:
                    break;
                  default:
                    {
                      G = 33;
                      break a;
                    }
                }
                Ya(628701) | 0;
                k[319] = 1;
                k[320] = 2;
                break;
              }
              switch (a | 0) {
                case 291798181:
                  break;
                default:
                  {
                    G = 33;
                    break a;
                  }
              }
              if (!(k[478] | 0))
                Ya(628778) | 0;
              else
                Ya(628756) | 0;
              k[319] = 1;
              k[320] = 4;
            }
 while (0);
          if ((G | 0) == 33) {
            Ya(628782) | 0;
            k[319] = 0;
            k[320] = 99;
          }
          a = cd(e) | 0;
          k[321] = a;
          b: do
            if ((a | 0) >= -1347272823)
              if ((a | 0) < 1006564715) {
                switch (a | 0) {
                  case -1347272823:
                    break;
                  default:
                    break b;
                }
                k[313] = 1;
                break;
              } else {
                switch (a | 0) {
                  case 1006564715:
                    break;
                  default:
                    break b;
                }
                k[313] = 1;
                break;
              }
            else {
              switch (a | 0) {
                case -1688300714:
                  break;
                default:
                  break b;
              }
              k[313] = 1;
            }
 while (0);
          if (!((a | 0) != -498685934 & (a | 0) != -1755662118 | (k[299] | 0) != 0)) {
            J = k[w >> 2] | 0;
            k[q >> 2] = 628858;
            rb(J | 0, 628816, q | 0) | 0;
            tb(1);
          }
          d = lb(e | 0, 628617) | 0;
          if (!d) {
            J = k[w >> 2] | 0;
            k[s >> 2] = 628858;
            rb(J | 0, 632954, s | 0) | 0;
            tb(1);
          }
          k[t >> 2] = 628858;
          kb(632972, t | 0) | 0;
          J = $a(d | 0) | 0;
          Db(d | 0, 0, 2) | 0;
          a = $a(d | 0) | 0;
          Db(d | 0, J | 0, 0) | 0;
          if (a & 1023) {
            J = k[w >> 2] | 0;
            k[u >> 2] = 628858;
            rb(J | 0, 632994, u | 0) | 0;
            tb(1);
          }
          c: do
            if ((a | 0) < 262144) {
              if ((a | 0) < 65536)
                switch (a | 0) {
                  case 32768:
                    {
                      G = 45;
                      break c;
                    }
                  default:
                    {
                      G = 60;
                      break c;
                    }
                }
              if ((a | 0) < 131072)
                switch (a | 0) {
                  case 65536:
                    {
                      G = 45;
                      break c;
                    }
                  default:
                    {
                      G = 60;
                      break c;
                    }
                }
              else
                switch (a | 0) {
                  case 131072:
                    {
                      G = 45;
                      break c;
                    }
                  default:
                    {
                      G = 60;
                      break c;
                    }
                }
            } else {
              if ((a | 0) < 524288)
                switch (a | 0) {
                  case 262144:
                    {
                      G = 45;
                      break c;
                    }
                  default:
                    {
                      G = 60;
                      break c;
                    }
                }
              if ((a | 0) < 1048576)
                switch (a | 0) {
                  case 524288:
                    {
                      G = 45;
                      break c;
                    }
                  default:
                    {
                      G = 60;
                      break c;
                    }
                }
              else
                switch (a | 0) {
                  case 1048576:
                    {
                      G = 45;
                      break c;
                    }
                  default:
                    {
                      G = 60;
                      break c;
                    }
                }
            }
 while (0);
          d: do
            if ((G | 0) == 45) {
              k[318] = 1;
              k[298] = 1;
              c = lf(1048576) | 0;
              k[463] = c;
              if (!c) {
                J = k[w >> 2] | 0;
                k[v >> 2] = e;
                rb(J | 0, 633033, v | 0) | 0;
                tb(1);
              }
              if ((Na(c | 0, a | 0, 1, d | 0) | 0) != 1) {
                J = k[w >> 2] | 0;
                k[x >> 2] = e;
                rb(J | 0, 632954, x | 0) | 0;
                tb(1);
              }
              do
                if ((a | 0) >= 65536)
                  if ((a | 0) >= 131072)
                    if ((a | 0) >= 262144) {
                      if ((a | 0) < 524288) {
                        G = 56;
                        break;
                      }
                      if ((a | 0) < 1048576)
                        G = 58;
                    } else
                      G = 54;
                  else
                    G = 52;
                else {
                  G = k[463] | 0;
                  vf(G + 32768 | 0, G | 0, 32768) | 0;
                  G = 52;
                }
 while (0);
              if ((G | 0) == 52) {
                J = k[463] | 0;
                vf(J + 65536 | 0, J | 0, 65536) | 0;
                G = 54;
              }
              if ((G | 0) == 54) {
                J = k[463] | 0;
                vf(J + 131072 | 0, J | 0, 131072) | 0;
                G = 56;
              }
              if ((G | 0) == 56) {
                J = k[463] | 0;
                vf(J + 262144 | 0, J | 0, 262144) | 0;
                G = 58;
              }
              if ((G | 0) == 58) {
                J = k[463] | 0;
                vf(J + 524288 | 0, J | 0, 524288) | 0;
              }
              vf(255176, (k[463] | 0) + 1045504 | 0, 3072) | 0;
              k[y >> 2] = (a | 0) / 1024 | 0;
              kb(633059, y | 0) | 0;
              Gb(d | 0) | 0;
              k[462] = 254152;
              G = 79;
            } else if ((G | 0) == 60) {
              do
                if (!((a | 0) % 3072 | 0)) {
                  k[314] = 1;
                  a = (a | 0) / 3072 | 0;
                  c = a;
                  while (1) {
                    if ((c | 0) <= 0) {
                      G = 65;
                      break;
                    }
                    c = c + -1 | 0;
                    if ((Na(254152 + (c << 12) + 1024 | 0, 3072, 1, d | 0) | 0) != 1) {
                      G = 64;
                      break;
                    }
                  }
                  if ((G | 0) == 64) {
                    J = k[w >> 2] | 0;
                    k[C >> 2] = e;
                    rb(J | 0, 632954, C | 0) | 0;
                    tb(1);
                  } else if ((G | 0) == 65) {
                    k[D >> 2] = a * 3;
                    kb(633073, D | 0) | 0;
                    b = a;
                    break;
                  }
                } else {
                  b = (a | 0) / 2048 | 0;
                  if ((a & -2048 | 0) == 4096 & (k[313] | 0) != 0) {
                    if ((Na(286920, 1024, 1, d | 0) | 0) != 1) {
                      J = k[w >> 2] | 0;
                      k[z >> 2] = e;
                      rb(J | 0, 632954, z | 0) | 0;
                      tb(1);
                    }
                    if ((Na(255176, 3072, 1, d | 0) | 0) == 1) {
                      kb(633077, B | 0) | 0;
                      break;
                    } else {
                      J = k[w >> 2] | 0;
                      k[A >> 2] = e;
                      rb(J | 0, 632954, A | 0) | 0;
                      tb(1);
                    }
                  }
                  e: do
                    if ((a | 0) > 2047) {
                      c = b + -1 | 0;
                      while (1) {
                        if ((Na(254152 + (c << 12) + 1024 | 0, 2048, 1, d | 0) | 0) != 1)
                          break;
                        vf(254152 + (c << 12) + 3072 | 0, 254152 + (c << 12) + 2048 | 0, 1024) | 0;
                        c = c + -1 | 0;
                        if ((c | 0) <= -1)
                          break e;
                      }
                      J = k[w >> 2] | 0;
                      k[E >> 2] = e;
                      rb(J | 0, 632954, E | 0) | 0;
                      tb(1);
                    }
 while (0);
                  k[F >> 2] = b << 1;
                  kb(633073, F | 0) | 0;
                }
 while (0);
              Gb(d | 0) | 0;
              k[462] = 254152;
              switch (b | 0) {
                case 1:
                  {
                    G = 79;
                    break d;
                  }
                case 2:
                  {
                    k[298] = (k[313] | 0) != 0 ? 1 : 2;
                    b = 2;
                    break d;
                  }
                case 4:
                  {
                    k[298] = 3;
                    b = 4;
                    break d;
                  }
                default:
                  {
                    k[298] = 4;
                    break d;
                  }
              }
            }
 while (0);
          if ((G | 0) == 79) {
            k[298] = 1;
            b = 1;
          }
          J = b + -1 | 0;
          if ((((i[254152 + (J << 12) + 1036 >> 0] | 0) == 79 ? (i[254152 + (J << 12) + 1037 >> 0] | 0) == 80 : 0) ? (i[254152 + (J << 12) + 1038 >> 0] | 0) == 78 : 0) ? (i[254152 + (J << 12) + 1039 >> 0] | 0) == 66 : 0)
            k[317] = 1;
          k[H >> 2] = k[321];
          kb(633086, H | 0) | 0;
          pd();
          Zc();
          td();
          hd(k[324] | 0, k[325] | 0, k[326] | 0);
          b = 1;
        }
 while (0);
      J = b;
      r = I;
      return J | 0;
    }
    function de(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return 0;
    }
    function ee() {
      return ;
    }
    function fe() {
      return (k[288] | 0) != 5964 | 0;
    }
    function ge() {
      return 1;
    }
    function he(a) {
      a = a | 0;
      return 0;
    }
    function ie(a) {
      a = a | 0;
      return 0;
    }
    function je() {
      var a = 0,
          b = 0,
          c = 0,
          d = 0;
      a = r;
      r = r + 16 | 0;
      c = a + 4 | 0;
      b = a;
      k[b >> 2] = 5;
      d = Dc[k[5344 >> 2] & 63](27, c) | 0;
      k[1342] = d ? k[c >> 2] | 0 : 0;
      Dc[k[5344 >> 2] & 63](8, b) | 0;
      pf(6412, 0, 24e4) | 0;
      k[465] = 1;
      r = a;
      return ;
    }
    function ke() {
      Yc();
      od();
      ld();
      return ;
    }
    function le() {
      Zc();
      ud();
      Od();
      return ;
    }
    function me() {
      var a = 0,
          b = 0,
          c = 0;
      a = k[1340] | 0;
      if (a) {
        Ac[a & 63]();
        b = (Bc[k[5364 >> 2] & 63](0, 1, 0, 4) | 0) << 16 >> 16;
        k[466] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 1, 0, 5) | 0) << 16 >> 16;
        k[467] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 1, 0, 6) | 0) << 16 >> 16;
        k[468] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 1, 0, 7) | 0) << 16 >> 16;
        k[469] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 1, 0, 8) | 0) << 16 >> 16;
        k[470] = b;
        b = (Bc[k[5364 >> 2] & 63](1, 1, 0, 4) | 0) << 16 >> 16;
        k[471] = b;
        b = (Bc[k[5364 >> 2] & 63](1, 1, 0, 5) | 0) << 16 >> 16;
        k[472] = b;
        b = (Bc[k[5364 >> 2] & 63](1, 1, 0, 6) | 0) << 16 >> 16;
        k[473] = b;
        b = (Bc[k[5364 >> 2] & 63](1, 1, 0, 7) | 0) << 16 >> 16;
        k[474] = b;
        b = (Bc[k[5364 >> 2] & 63](1, 1, 0, 8) | 0) << 16 >> 16;
        k[475] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 48) | 0) & 255;
        i[251854] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 49) | 0) & 255;
        i[251855] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 50) | 0) & 255;
        i[251856] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 51) | 0) & 255;
        i[251857] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 52) | 0) & 255;
        i[251858] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 53) | 0) & 255;
        i[251859] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 54) | 0) & 255;
        i[251860] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 55) | 0) & 255;
        i[251861] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 56) | 0) & 255;
        i[251862] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 57) | 0) & 255;
        i[251863] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 97) | 0) & 255;
        i[251903] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 98) | 0) & 255;
        i[251904] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 99) | 0) & 255;
        i[251905] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 100) | 0) & 255;
        i[251906] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 101) | 0) & 255;
        i[251907] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 102) | 0) & 255;
        i[251908] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 103) | 0) & 255;
        i[251909] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 104) | 0) & 255;
        i[251910] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 105) | 0) & 255;
        i[251911] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 106) | 0) & 255;
        i[251912] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 107) | 0) & 255;
        i[251913] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 108) | 0) & 255;
        i[251914] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 109) | 0) & 255;
        i[251915] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 110) | 0) & 255;
        i[251916] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 111) | 0) & 255;
        i[251917] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 112) | 0) & 255;
        i[251918] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 113) | 0) & 255;
        i[251919] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 114) | 0) & 255;
        i[251920] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 115) | 0) & 255;
        i[251921] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 116) | 0) & 255;
        i[251922] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 117) | 0) & 255;
        i[251923] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 118) | 0) & 255;
        i[251924] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 119) | 0) & 255;
        i[251925] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 120) | 0) & 255;
        i[251926] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 121) | 0) & 255;
        i[251927] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 122) | 0) & 255;
        i[251928] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 32) | 0) & 255;
        i[251838] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 63) | 0) & 255;
        i[251869] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 46) | 0) & 255;
        i[251852] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 279) | 0) & 255;
        i[252085] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 13) | 0) & 255;
        i[251819] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 45) | 0) & 255;
        i[251851] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 42) | 0) & 255;
        i[251848] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 47) | 0) & 255;
        i[251853] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 61) | 0) & 255;
        i[251867] = b;
        b = (Bc[k[5364 >> 2] & 63](0, 3, 0, 43) | 0) & 255;
        i[251849] = b;
      }
      ad();
      k[465] = 1;
      Ec[k[5348 >> 2] & 63](6412, 340, 250, 800);
      a = (k[288] | 0) == 5964 ? 735 : 882;
      b = 0;
      do {
        c = (l[297544 + b >> 0] | 0) << 8 & 65535;
        xc[k[5352 >> 2] & 63](c, c);
        b = b + 1 | 0;
      } while ((b | 0) < (a | 0));
      return ;
    }
    function ne(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
          d = 0;
      c = lf(20) | 0;
      if (!c) {
        a = 0;
        return a | 0;
      }
      d = lf(ia(b, a) | 0) | 0;
      k[c >> 2] = d;
      k[c + 4 >> 2] = a;
      k[c + 8 >> 2] = b;
      k[c + 12 >> 2] = a;
      k[c + 16 >> 2] = 1;
      a = c;
      return a | 0;
    }
    function oe(a) {
      a = a | 0;
      var b = 0;
      b = k[a >> 2] | 0;
      if (b)
        mf(b);
      mf(a);
      return 0;
    }
    function pe(a, b, c, d, e, f, g, h, j) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      g = g | 0;
      h = h | 0;
      j = j | 0;
      var m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          r = 0,
          s = 0,
          t = 0,
          u = 0,
          v = 0,
          w = 0,
          x = 0,
          y = 0,
          z = 0,
          A = 0,
          B = 0,
          C = 0,
          D = 0,
          E = 0,
          F = 0,
          G = 0,
          H = 0;
      if ((a | 0) > 39 | (b | 0) > 24)
        return ;
      G = f & 255;
      if ((f & 255) > 1)
        return ;
      f = h << 24 >> 24 == 2 ? 5 : 0;
      F = g << 24 >> 24 == 2 ? 8 : 128;
      E = b * 10 | 0;
      D = a << 3;
      B = g << 24 >> 24 == 0 & 1;
      C = h << 24 >> 24 == 0 & 1;
      a = (c & 255) > 159;
      n = (c & 255) * 10 | 0;
      b = n + -1600 | 0;
      m = c << 24 >> 24 < 0;
      v = F >>> B;
      o = D | 1;
      w = v >> 1;
      p = D | 2;
      x = w >> B;
      q = D | 3;
      y = x >> 1;
      r = D | 4;
      z = y >> B;
      s = D | 5;
      A = z >> 1;
      t = D | 6;
      B = A >> B;
      u = D | 7;
      if (!(j << 24 >> 24)) {
        if (a) {
          g = f;
          h = 0;
          while (1) {
            m = l[b + g + (293064 + (G * 960 | 0)) >> 0] | 0;
            c = h + E | 0;
            j = k[1335] | 0;
            n = D + (ia(k[j + 4 >> 2] | 0, c) | 0) | 0;
            i[(k[j >> 2] | 0) + n >> 0] = (F & m | 0) != 0 ? e : d;
            n = k[1335] | 0;
            j = o + (ia(k[n + 4 >> 2] | 0, c) | 0) | 0;
            i[(k[n >> 2] | 0) + j >> 0] = (v & m | 0) != 0 ? e : d;
            j = k[1335] | 0;
            n = p + (ia(k[j + 4 >> 2] | 0, c) | 0) | 0;
            i[(k[j >> 2] | 0) + n >> 0] = (w & m | 0) != 0 ? e : d;
            n = k[1335] | 0;
            j = q + (ia(k[n + 4 >> 2] | 0, c) | 0) | 0;
            i[(k[n >> 2] | 0) + j >> 0] = (x & m | 0) != 0 ? e : d;
            j = k[1335] | 0;
            n = r + (ia(k[j + 4 >> 2] | 0, c) | 0) | 0;
            i[(k[j >> 2] | 0) + n >> 0] = (y & m | 0) != 0 ? e : d;
            n = k[1335] | 0;
            j = s + (ia(k[n + 4 >> 2] | 0, c) | 0) | 0;
            i[(k[n >> 2] | 0) + j >> 0] = (z & m | 0) != 0 ? e : d;
            j = k[1335] | 0;
            n = t + (ia(k[j + 4 >> 2] | 0, c) | 0) | 0;
            i[(k[j >> 2] | 0) + n >> 0] = (A & m | 0) != 0 ? e : d;
            n = k[1335] | 0;
            c = u + (ia(k[n + 4 >> 2] | 0, c) | 0) | 0;
            i[(k[n >> 2] | 0) + c >> 0] = (B & m | 0) != 0 ? e : d;
            c = h + 1 | 0;
            if ((c | 0) == 10)
              break;
            else {
              g = (h & 1 | C) + g | 0;
              h = c;
            }
          }
          return ;
        } else {
          g = f;
          h = 0;
        }
        while (1) {
          if (m)
            c = 255;
          else
            c = l[g + n + (294984 + (G * 1280 | 0)) >> 0] | 0;
          j = h + E | 0;
          b = k[1335] | 0;
          a = D + (ia(k[b + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[b >> 2] | 0) + a >> 0] = (F & c | 0) != 0 ? e : d;
          a = k[1335] | 0;
          b = o + (ia(k[a + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[a >> 2] | 0) + b >> 0] = (v & c | 0) != 0 ? e : d;
          b = k[1335] | 0;
          a = p + (ia(k[b + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[b >> 2] | 0) + a >> 0] = (w & c | 0) != 0 ? e : d;
          a = k[1335] | 0;
          b = q + (ia(k[a + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[a >> 2] | 0) + b >> 0] = (x & c | 0) != 0 ? e : d;
          b = k[1335] | 0;
          a = r + (ia(k[b + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[b >> 2] | 0) + a >> 0] = (y & c | 0) != 0 ? e : d;
          a = k[1335] | 0;
          b = s + (ia(k[a + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[a >> 2] | 0) + b >> 0] = (z & c | 0) != 0 ? e : d;
          b = k[1335] | 0;
          a = t + (ia(k[b + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[b >> 2] | 0) + a >> 0] = (A & c | 0) != 0 ? e : d;
          a = k[1335] | 0;
          j = u + (ia(k[a + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[a >> 2] | 0) + j >> 0] = (B & c | 0) != 0 ? e : d;
          c = h + 1 | 0;
          if ((c | 0) == 10)
            break;
          else {
            g = (h & 1 | C) + g | 0;
            h = c;
          }
        }
        return ;
      } else {
        g = f;
        h = 0;
        while (1) {
          do
            if ((g | 0) != 9) {
              if (a) {
                c = l[b + g + (293064 + (G * 960 | 0)) >> 0] | 0;
                break;
              }
              if (!m)
                c = l[g + n + (294984 + (G * 1280 | 0)) >> 0] | 0;
              else
                c = 255;
            } else
              c = 255;
 while (0);
          j = h + E | 0;
          H = k[1335] | 0;
          f = D + (ia(k[H + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[H >> 2] | 0) + f >> 0] = (F & c | 0) != 0 ? e : d;
          f = k[1335] | 0;
          H = o + (ia(k[f + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[f >> 2] | 0) + H >> 0] = (v & c | 0) != 0 ? e : d;
          H = k[1335] | 0;
          f = p + (ia(k[H + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[H >> 2] | 0) + f >> 0] = (w & c | 0) != 0 ? e : d;
          f = k[1335] | 0;
          H = q + (ia(k[f + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[f >> 2] | 0) + H >> 0] = (x & c | 0) != 0 ? e : d;
          H = k[1335] | 0;
          f = r + (ia(k[H + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[H >> 2] | 0) + f >> 0] = (y & c | 0) != 0 ? e : d;
          f = k[1335] | 0;
          H = s + (ia(k[f + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[f >> 2] | 0) + H >> 0] = (z & c | 0) != 0 ? e : d;
          H = k[1335] | 0;
          f = t + (ia(k[H + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[H >> 2] | 0) + f >> 0] = (A & c | 0) != 0 ? e : d;
          f = k[1335] | 0;
          j = u + (ia(k[f + 4 >> 2] | 0, j) | 0) | 0;
          i[(k[f >> 2] | 0) + j >> 0] = (B & c | 0) != 0 ? e : d;
          c = h + 1 | 0;
          if ((c | 0) == 10)
            break;
          else {
            g = (h & 1 | C) + g | 0;
            h = c;
          }
        }
        return ;
      }
    }
    function qe(a) {
      a = a | 0;
      return te(k[a + 4 >> 2] | 0) | 0;
    }
    function re(a) {
      a = a | 0;
      Wb(368, 633131);
      gb(400, 633136, 1, 1, 0);
      xb(408, 633141, 1, -128, 127);
      xb(424, 633146, 1, -128, 127);
      xb(416, 633158, 1, 0, 255);
      xb(432, 633172, 2, -32768, 32767);
      xb(440, 633178, 2, 0, 65535);
      xb(448, 633193, 4, -2147483648, 2147483647);
      xb(456, 633197, 4, 0, -1);
      xb(464, 633210, 4, -2147483648, 2147483647);
      xb(472, 633215, 4, 0, -1);
      ec(480, 633229, 4);
      ec(488, 633235, 8);
      Sb(96, 633242);
      Sb(120, 633254);
      _b(144, 4, 633287);
      ib(168, 633300);
      Tb(176, 0, 633316);
      Tb(184, 0, 633346);
      Tb(192, 1, 633383);
      Tb(200, 2, 633422);
      Tb(208, 3, 633453);
      Tb(216, 4, 633493);
      Tb(224, 5, 633522);
      Tb(232, 4, 633560);
      Tb(240, 5, 633590);
      Tb(184, 0, 633629);
      Tb(192, 1, 633661);
      Tb(200, 2, 633694);
      Tb(208, 3, 633727);
      Tb(216, 4, 633761);
      Tb(224, 5, 633794);
      Tb(248, 6, 633828);
      Tb(256, 7, 633859);
      Tb(264, 7, 633891);
      return ;
    }
    function se() {
      re(0);
      return ;
    }
    function te(a) {
      a = a | 0;
      var b = 0,
          c = 0;
      b = (qf(a | 0) | 0) + 1 | 0;
      c = lf(b) | 0;
      if (!c) {
        a = 0;
        return a | 0;
      }
      vf(c | 0, a | 0, b | 0) | 0;
      a = c;
      return a | 0;
    }
    function ue(a) {
      a = a | 0;
      mf(a);
      return ;
    }
    function ve(a) {
      a = a | 0;
      return ;
    }
    function we(a) {
      a = a | 0;
      return ;
    }
    function xe(a) {
      a = a | 0;
      return ;
    }
    function ye(a) {
      a = a | 0;
      return ;
    }
    function ze(a) {
      a = a | 0;
      ue(a);
      return ;
    }
    function Ae(a) {
      a = a | 0;
      ue(a);
      return ;
    }
    function Be(a) {
      a = a | 0;
      ue(a);
      return ;
    }
    function Ce(a) {
      a = a | 0;
      ue(a);
      return ;
    }
    function De(a) {
      a = a | 0;
      ue(a);
      return ;
    }
    function Ee(a) {
      a = a | 0;
      ue(a);
      return ;
    }
    function Fe(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return (a | 0) == (b | 0) | 0;
    }
    function Ge(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return (a | 0) == (b | 0) | 0;
    }
    function He(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
          e = 0,
          f = 0,
          g = 0;
      g = r;
      r = r + 64 | 0;
      f = g;
      if ((a | 0) != (b | 0))
        if ((b | 0) != 0 ? (e = Oe(b, 288, 304, 0) | 0, (e | 0) != 0) : 0) {
          b = f;
          d = b + 56 | 0;
          do {
            k[b >> 2] = 0;
            b = b + 4 | 0;
          } while ((b | 0) < (d | 0));
          k[f >> 2] = e;
          k[f + 8 >> 2] = a;
          k[f + 12 >> 2] = -1;
          k[f + 48 >> 2] = 1;
          Ec[k[(k[e >> 2] | 0) + 28 >> 2] & 63](e, f, k[c >> 2] | 0, 1);
          if ((k[f + 24 >> 2] | 0) == 1) {
            k[c >> 2] = k[f + 16 >> 2];
            b = 1;
          } else
            b = 0;
        } else
          b = 0;
      else
        b = 1;
      r = g;
      return b | 0;
    }
    function Ie(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0;
      a = b + 16 | 0;
      e = k[a >> 2] | 0;
      do
        if (e) {
          if ((e | 0) != (c | 0)) {
            d = b + 36 | 0;
            k[d >> 2] = (k[d >> 2] | 0) + 1;
            k[b + 24 >> 2] = 2;
            i[b + 54 >> 0] = 1;
            break;
          }
          a = b + 24 | 0;
          if ((k[a >> 2] | 0) == 2)
            k[a >> 2] = d;
        } else {
          k[a >> 2] = c;
          k[b + 24 >> 2] = d;
          k[b + 36 >> 2] = 1;
        }
 while (0);
      return ;
    }
    function Je(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      if ((a | 0) == (k[b + 8 >> 2] | 0))
        Ie(0, b, c, d);
      return ;
    }
    function Ke(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      if ((a | 0) == (k[b + 8 >> 2] | 0))
        Ie(0, b, c, d);
      else {
        a = k[a + 8 >> 2] | 0;
        Ec[k[(k[a >> 2] | 0) + 28 >> 2] & 63](a, b, c, d);
      }
      return ;
    }
    function Le(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
          f = 0;
      f = k[a + 4 >> 2] | 0;
      e = f >> 8;
      if (f & 1)
        e = k[(k[c >> 2] | 0) + e >> 2] | 0;
      a = k[a >> 2] | 0;
      Ec[k[(k[a >> 2] | 0) + 28 >> 2] & 63](a, b, c + e | 0, (f & 2 | 0) != 0 ? d : 2);
      return ;
    }
    function Me(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
          f = 0;
      a: do
        if ((a | 0) != (k[b + 8 >> 2] | 0)) {
          f = k[a + 12 >> 2] | 0;
          e = a + 16 + (f << 3) | 0;
          Le(a + 16 | 0, b, c, d);
          if ((f | 0) > 1) {
            f = b + 54 | 0;
            a = a + 24 | 0;
            do {
              Le(a, b, c, d);
              if (i[f >> 0] | 0)
                break a;
              a = a + 8 | 0;
            } while (a >>> 0 < e >>> 0);
          }
        } else
          Ie(0, b, c, d);
 while (0);
      return ;
    }
    function Ne(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0;
      i = r;
      r = r + 64 | 0;
      h = i;
      k[c >> 2] = k[k[c >> 2] >> 2];
      if (!((a | 0) == (b | 0) | (b | 0) == 392))
        if (((b | 0) != 0 ? (d = Oe(b, 288, 336, 0) | 0, (d | 0) != 0) : 0) ? (k[d + 8 >> 2] & ~k[a + 8 >> 2] | 0) == 0 : 0) {
          b = k[a + 12 >> 2] | 0;
          a = d + 12 | 0;
          if (!((b | 0) == 368 ? 1 : (b | 0) == (k[a >> 2] | 0)))
            if ((((b | 0) != 0 ? (f = Oe(b, 288, 304, 0) | 0, (f | 0) != 0) : 0) ? (e = k[a >> 2] | 0, (e | 0) != 0) : 0) ? (g = Oe(e, 288, 304, 0) | 0, (g | 0) != 0) : 0) {
              b = h;
              a = b + 56 | 0;
              do {
                k[b >> 2] = 0;
                b = b + 4 | 0;
              } while ((b | 0) < (a | 0));
              k[h >> 2] = g;
              k[h + 8 >> 2] = f;
              k[h + 12 >> 2] = -1;
              k[h + 48 >> 2] = 1;
              Ec[k[(k[g >> 2] | 0) + 28 >> 2] & 63](g, h, k[c >> 2] | 0, 1);
              if ((k[h + 24 >> 2] | 0) == 1) {
                k[c >> 2] = k[h + 16 >> 2];
                b = 1;
              } else
                b = 0;
            } else
              b = 0;
          else
            b = 1;
        } else
          b = 0;
      else
        b = 1;
      r = i;
      return b | 0;
    }
    function Oe(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
          f = 0,
          g = 0,
          h = 0,
          l = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0;
      q = r;
      r = r + 64 | 0;
      p = q;
      o = k[a >> 2] | 0;
      n = a + (k[o + -8 >> 2] | 0) | 0;
      o = k[o + -4 >> 2] | 0;
      k[p >> 2] = c;
      k[p + 4 >> 2] = a;
      k[p + 8 >> 2] = b;
      k[p + 12 >> 2] = d;
      b = p + 16 | 0;
      a = p + 20 | 0;
      d = p + 24 | 0;
      e = p + 28 | 0;
      f = p + 32 | 0;
      g = p + 40 | 0;
      h = (o | 0) == (c | 0);
      l = b;
      m = l + 36 | 0;
      do {
        k[l >> 2] = 0;
        l = l + 4 | 0;
      } while ((l | 0) < (m | 0));
      j[b + 36 >> 1] = 0;
      i[b + 38 >> 0] = 0;
      a: do
        if (h) {
          k[p + 48 >> 2] = 1;
          Cc[k[(k[c >> 2] | 0) + 20 >> 2] & 63](c, p, n, n, 1, 0);
          d = (k[d >> 2] | 0) == 1 ? n : 0;
        } else {
          uc[k[(k[o >> 2] | 0) + 24 >> 2] & 63](o, p, n, 1, 0);
          switch (k[p + 36 >> 2] | 0) {
            case 0:
              {
                d = (k[g >> 2] | 0) == 1 & (k[e >> 2] | 0) == 1 & (k[f >> 2] | 0) == 1 ? k[a >> 2] | 0 : 0;
                break a;
              }
            case 1:
              break;
            default:
              {
                d = 0;
                break a;
              }
          }
          if ((k[d >> 2] | 0) != 1 ? !((k[g >> 2] | 0) == 0 & (k[e >> 2] | 0) == 1 & (k[f >> 2] | 0) == 1) : 0) {
            d = 0;
            break;
          }
          d = k[b >> 2] | 0;
        }
 while (0);
      r = q;
      return d | 0;
    }
    function Pe(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      i[b + 53 >> 0] = 1;
      do
        if ((k[b + 4 >> 2] | 0) == (d | 0)) {
          i[b + 52 >> 0] = 1;
          d = b + 16 | 0;
          a = k[d >> 2] | 0;
          if (!a) {
            k[d >> 2] = c;
            k[b + 24 >> 2] = e;
            k[b + 36 >> 2] = 1;
            if (!((e | 0) == 1 ? (k[b + 48 >> 2] | 0) == 1 : 0))
              break;
            i[b + 54 >> 0] = 1;
            break;
          }
          if ((a | 0) != (c | 0)) {
            c = b + 36 | 0;
            k[c >> 2] = (k[c >> 2] | 0) + 1;
            i[b + 54 >> 0] = 1;
            break;
          }
          a = b + 24 | 0;
          d = k[a >> 2] | 0;
          if ((d | 0) == 2)
            k[a >> 2] = e;
          else
            e = d;
          if ((e | 0) == 1 ? (k[b + 48 >> 2] | 0) == 1 : 0)
            i[b + 54 >> 0] = 1;
        }
 while (0);
      return ;
    }
    function Qe(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
          g = 0,
          h = 0,
          j = 0,
          l = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          r = 0;
      a: do
        if ((a | 0) == (k[b + 8 >> 2] | 0)) {
          if ((k[b + 4 >> 2] | 0) == (c | 0) ? (g = b + 28 | 0, (k[g >> 2] | 0) != 1) : 0)
            k[g >> 2] = d;
        } else {
          if ((a | 0) != (k[b >> 2] | 0)) {
            r = k[a + 12 >> 2] | 0;
            j = a + 16 + (r << 3) | 0;
            Se(a + 16 | 0, b, c, d, e);
            f = a + 24 | 0;
            if ((r | 0) <= 1)
              break;
            g = k[a + 8 >> 2] | 0;
            if ((g & 2 | 0) == 0 ? (l = b + 36 | 0, (k[l >> 2] | 0) != 1) : 0) {
              if (!(g & 1)) {
                g = b + 54 | 0;
                while (1) {
                  if (i[g >> 0] | 0)
                    break a;
                  if ((k[l >> 2] | 0) == 1)
                    break a;
                  Se(f, b, c, d, e);
                  f = f + 8 | 0;
                  if (f >>> 0 >= j >>> 0)
                    break a;
                }
              }
              g = b + 24 | 0;
              h = b + 54 | 0;
              while (1) {
                if (i[h >> 0] | 0)
                  break a;
                if ((k[l >> 2] | 0) == 1 ? (k[g >> 2] | 0) == 1 : 0)
                  break a;
                Se(f, b, c, d, e);
                f = f + 8 | 0;
                if (f >>> 0 >= j >>> 0)
                  break a;
              }
            }
            g = b + 54 | 0;
            while (1) {
              if (i[g >> 0] | 0)
                break a;
              Se(f, b, c, d, e);
              f = f + 8 | 0;
              if (f >>> 0 >= j >>> 0)
                break a;
            }
          }
          if ((k[b + 16 >> 2] | 0) != (c | 0) ? (q = b + 20 | 0, (k[q >> 2] | 0) != (c | 0)) : 0) {
            k[b + 32 >> 2] = d;
            n = b + 44 | 0;
            if ((k[n >> 2] | 0) == 4)
              break;
            l = k[a + 12 >> 2] | 0;
            j = a + 16 + (l << 3) | 0;
            f = b + 52 | 0;
            m = b + 53 | 0;
            o = b + 54 | 0;
            d = a + 8 | 0;
            p = b + 24 | 0;
            b: do
              if ((l | 0) > 0) {
                h = 0;
                g = 0;
                l = a + 16 | 0;
                while (1) {
                  i[f >> 0] = 0;
                  i[m >> 0] = 0;
                  Re(l, b, c, c, 1, e);
                  if (i[o >> 0] | 0) {
                    r = 20;
                    break b;
                  }
                  do
                    if (i[m >> 0] | 0) {
                      if (!(i[f >> 0] | 0))
                        if (!(k[d >> 2] & 1)) {
                          g = 1;
                          r = 20;
                          break b;
                        } else {
                          g = 1;
                          break;
                        }
                      if ((k[p >> 2] | 0) == 1)
                        break b;
                      if (!(k[d >> 2] & 2))
                        break b;
                      else {
                        h = 1;
                        g = 1;
                      }
                    }
 while (0);
                  l = l + 8 | 0;
                  if (l >>> 0 >= j >>> 0) {
                    r = 20;
                    break;
                  }
                }
              } else {
                h = 0;
                g = 0;
                r = 20;
              }
 while (0);
            do
              if ((r | 0) == 20) {
                if ((!h ? (k[q >> 2] = c, c = b + 40 | 0, k[c >> 2] = (k[c >> 2] | 0) + 1, (k[b + 36 >> 2] | 0) == 1) : 0) ? (k[p >> 2] | 0) == 2 : 0) {
                  i[o >> 0] = 1;
                  if (g)
                    break;
                } else
                  r = 24;
                if ((r | 0) == 24 ? g : 0)
                  break;
                k[n >> 2] = 4;
                break a;
              }
 while (0);
            k[n >> 2] = 3;
            break;
          }
          if ((d | 0) == 1)
            k[b + 32 >> 2] = 1;
        }
 while (0);
      return ;
    }
    function Re(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      var g = 0,
          h = 0;
      h = k[a + 4 >> 2] | 0;
      g = h >> 8;
      if (h & 1)
        g = k[(k[d >> 2] | 0) + g >> 2] | 0;
      a = k[a >> 2] | 0;
      Cc[k[(k[a >> 2] | 0) + 20 >> 2] & 63](a, b, c, d + g | 0, (h & 2 | 0) != 0 ? e : 2, f);
      return ;
    }
    function Se(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
          g = 0;
      g = k[a + 4 >> 2] | 0;
      f = g >> 8;
      if (g & 1)
        f = k[(k[c >> 2] | 0) + f >> 2] | 0;
      a = k[a >> 2] | 0;
      uc[k[(k[a >> 2] | 0) + 24 >> 2] & 63](a, b, c + f | 0, (g & 2 | 0) != 0 ? d : 2, e);
      return ;
    }
    function Te(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
          g = 0,
          h = 0,
          j = 0;
      a: do
        if ((a | 0) == (k[b + 8 >> 2] | 0)) {
          if ((k[b + 4 >> 2] | 0) == (c | 0) ? (f = b + 28 | 0, (k[f >> 2] | 0) != 1) : 0)
            k[f >> 2] = d;
        } else {
          if ((a | 0) != (k[b >> 2] | 0)) {
            h = k[a + 8 >> 2] | 0;
            uc[k[(k[h >> 2] | 0) + 24 >> 2] & 63](h, b, c, d, e);
            break;
          }
          if ((k[b + 16 >> 2] | 0) != (c | 0) ? (g = b + 20 | 0, (k[g >> 2] | 0) != (c | 0)) : 0) {
            k[b + 32 >> 2] = d;
            d = b + 44 | 0;
            if ((k[d >> 2] | 0) == 4)
              break;
            f = b + 52 | 0;
            i[f >> 0] = 0;
            j = b + 53 | 0;
            i[j >> 0] = 0;
            a = k[a + 8 >> 2] | 0;
            Cc[k[(k[a >> 2] | 0) + 20 >> 2] & 63](a, b, c, c, 1, e);
            if (i[j >> 0] | 0) {
              if (!(i[f >> 0] | 0)) {
                f = 1;
                h = 13;
              }
            } else {
              f = 0;
              h = 13;
            }
            do
              if ((h | 0) == 13) {
                k[g >> 2] = c;
                j = b + 40 | 0;
                k[j >> 2] = (k[j >> 2] | 0) + 1;
                if ((k[b + 36 >> 2] | 0) == 1 ? (k[b + 24 >> 2] | 0) == 2 : 0) {
                  i[b + 54 >> 0] = 1;
                  if (f)
                    break;
                } else
                  h = 16;
                if ((h | 0) == 16 ? f : 0)
                  break;
                k[d >> 2] = 4;
                break a;
              }
 while (0);
            k[d >> 2] = 3;
            break;
          }
          if ((d | 0) == 1)
            k[b + 32 >> 2] = 1;
        }
 while (0);
      return ;
    }
    function Ue(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
          g = 0;
      do
        if ((a | 0) == (k[b + 8 >> 2] | 0)) {
          if ((k[b + 4 >> 2] | 0) == (c | 0) ? (g = b + 28 | 0, (k[g >> 2] | 0) != 1) : 0)
            k[g >> 2] = d;
        } else if ((a | 0) == (k[b >> 2] | 0)) {
          if ((k[b + 16 >> 2] | 0) != (c | 0) ? (f = b + 20 | 0, (k[f >> 2] | 0) != (c | 0)) : 0) {
            k[b + 32 >> 2] = d;
            k[f >> 2] = c;
            e = b + 40 | 0;
            k[e >> 2] = (k[e >> 2] | 0) + 1;
            if ((k[b + 36 >> 2] | 0) == 1 ? (k[b + 24 >> 2] | 0) == 2 : 0)
              i[b + 54 >> 0] = 1;
            k[b + 44 >> 2] = 4;
            break;
          }
          if ((d | 0) == 1)
            k[b + 32 >> 2] = 1;
        }
 while (0);
      return ;
    }
    function Ve(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      var g = 0,
          h = 0,
          j = 0,
          l = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0;
      if ((a | 0) == (k[b + 8 >> 2] | 0))
        Pe(0, b, c, d, e);
      else {
        m = b + 52 | 0;
        n = i[m >> 0] | 0;
        o = b + 53 | 0;
        p = i[o >> 0] | 0;
        l = k[a + 12 >> 2] | 0;
        g = a + 16 + (l << 3) | 0;
        i[m >> 0] = 0;
        i[o >> 0] = 0;
        Re(a + 16 | 0, b, c, d, e, f);
        a: do
          if ((l | 0) > 1) {
            h = b + 24 | 0;
            j = a + 8 | 0;
            l = b + 54 | 0;
            a = a + 24 | 0;
            do {
              if (i[l >> 0] | 0)
                break a;
              if (!(i[m >> 0] | 0)) {
                if ((i[o >> 0] | 0) != 0 ? (k[j >> 2] & 1 | 0) == 0 : 0)
                  break a;
              } else {
                if ((k[h >> 2] | 0) == 1)
                  break a;
                if (!(k[j >> 2] & 2))
                  break a;
              }
              i[m >> 0] = 0;
              i[o >> 0] = 0;
              Re(a, b, c, d, e, f);
              a = a + 8 | 0;
            } while (a >>> 0 < g >>> 0);
          }
 while (0);
        i[m >> 0] = n;
        i[o >> 0] = p;
      }
      return ;
    }
    function We(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      if ((a | 0) == (k[b + 8 >> 2] | 0))
        Pe(0, b, c, d, e);
      else {
        a = k[a + 8 >> 2] | 0;
        Cc[k[(k[a >> 2] | 0) + 20 >> 2] & 63](a, b, c, d, e, f);
      }
      return ;
    }
    function Xe(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      if ((a | 0) == (k[b + 8 >> 2] | 0))
        Pe(0, b, c, d, e);
      return ;
    }
    function Ye(a, b) {
      a = +a;
      b = b | 0;
      var c = 0,
          d = 0,
          e = 0;
      p[t >> 3] = a;
      c = k[t >> 2] | 0;
      d = k[t + 4 >> 2] | 0;
      e = uf(c | 0, d | 0, 52) | 0;
      e = e & 2047;
      switch (e | 0) {
        case 0:
          {
            if (a != 0.0) {
              a = +Ye(a * 18446744073709551616.0, b);
              c = (k[b >> 2] | 0) + -64 | 0;
            } else
              c = 0;
            k[b >> 2] = c;
            return +a;
          }
        case 2047:
          return +a;
        default:
          {
            k[b >> 2] = e + -1022;
            k[t >> 2] = c;
            k[t + 4 >> 2] = d & -2146435073 | 1071644672;
            a = +p[t >> 3];
            return +a;
          }
      }
      return 0.0;
    }
    function Ze(a, b) {
      a = +a;
      b = b | 0;
      return +(+Ye(a, b));
    }
    function _e(a, b) {
      a = a | 0;
      b = b | 0;
      if (!a)
        a = 0;
      else
        a = $e(a, b, 0) | 0;
      return a | 0;
    }
    function $e(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      if (!a) {
        b = 1;
        return b | 0;
      }
      if (b >>> 0 < 128) {
        i[a >> 0] = b;
        b = 1;
        return b | 0;
      }
      if (b >>> 0 < 2048) {
        i[a >> 0] = b >>> 6 | 192;
        i[a + 1 >> 0] = b & 63 | 128;
        b = 2;
        return b | 0;
      }
      if (b >>> 0 < 55296 | (b & -8192 | 0) == 57344) {
        i[a >> 0] = b >>> 12 | 224;
        i[a + 1 >> 0] = b >>> 6 & 63 | 128;
        i[a + 2 >> 0] = b & 63 | 128;
        b = 3;
        return b | 0;
      }
      if ((b + -65536 | 0) >>> 0 < 1048576) {
        i[a >> 0] = b >>> 18 | 240;
        i[a + 1 >> 0] = b >>> 12 & 63 | 128;
        i[a + 2 >> 0] = b >>> 6 & 63 | 128;
        i[a + 3 >> 0] = b & 63 | 128;
        b = 4;
        return b | 0;
      } else {
        b = jc() | 0;
        k[b >> 2] = 84;
        b = -1;
        return b | 0;
      }
      return 0;
    }
    function af() {
      var a = 0,
          b = 0,
          c = 0;
      b = 544;
      b = Cf(k[b >> 2] | 0, k[b + 4 >> 2] | 0, 1284865837, 1481765933) | 0;
      b = tf(b | 0, M | 0, 1, 0) | 0;
      a = M;
      c = 544;
      k[c >> 2] = b;
      k[c + 4 >> 2] = a;
      a = uf(b | 0, a | 0, 33) | 0;
      return a | 0;
    }
    function bf(a) {
      a = a | 0;
      var b = 0,
          c = 0;
      b = a + 74 | 0;
      c = i[b >> 0] | 0;
      i[b >> 0] = c + 255 | c;
      b = k[a >> 2] | 0;
      if (!(b & 8)) {
        k[a + 8 >> 2] = 0;
        k[a + 4 >> 2] = 0;
        c = k[a + 44 >> 2] | 0;
        k[a + 28 >> 2] = c;
        k[a + 20 >> 2] = c;
        k[a + 16 >> 2] = c + (k[a + 48 >> 2] | 0);
        c = 0;
        return c | 0;
      } else {
        k[a >> 2] = b | 32;
        c = -1;
        return c | 0;
      }
      return 0;
    }
    function cf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
          e = 0,
          f = 0,
          g = 0;
      d = c + 16 | 0;
      e = k[d >> 2] | 0;
      do
        if (!e)
          if (!(bf(c) | 0)) {
            e = k[d >> 2] | 0;
            break;
          } else {
            g = 0;
            return g | 0;
          }
 while (0);
      g = c + 20 | 0;
      d = k[g >> 2] | 0;
      if ((e - d | 0) >>> 0 < b >>> 0) {
        g = tc[k[c + 36 >> 2] & 63](c, a, b) | 0;
        return g | 0;
      }
      a: do
        if ((i[c + 75 >> 0] | 0) > -1) {
          e = b;
          while (1) {
            if (!e) {
              f = b;
              e = 0;
              break a;
            }
            f = e + -1 | 0;
            if ((i[a + f >> 0] | 0) == 10)
              break;
            else
              e = f;
          }
          if ((tc[k[c + 36 >> 2] & 63](c, a, e) | 0) >>> 0 < e >>> 0) {
            g = e;
            return g | 0;
          } else {
            f = b - e | 0;
            a = a + e | 0;
            d = k[g >> 2] | 0;
            break;
          }
        } else {
          f = b;
          e = 0;
        }
 while (0);
      vf(d | 0, a | 0, f | 0) | 0;
      k[g >> 2] = (k[g >> 2] | 0) + f;
      g = e + f | 0;
      return g | 0;
    }
    function df(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
          f = 0;
      e = r;
      r = r + 16 | 0;
      f = e;
      k[f >> 2] = d;
      d = ff(a, b, c, f) | 0;
      r = e;
      return d | 0;
    }
    function ef(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0,
          l = 0,
          m = 0,
          n = 0,
          o = 0;
      o = r;
      r = r + 224 | 0;
      j = o + 120 | 0;
      n = o + 80 | 0;
      m = o;
      l = o + 136 | 0;
      d = n;
      e = d + 40 | 0;
      do {
        k[d >> 2] = 0;
        d = d + 4 | 0;
      } while ((d | 0) < (e | 0));
      k[j >> 2] = k[c >> 2];
      if ((jf(0, b, j, m, n) | 0) < 0) {
        a = -1;
        r = o;
        return a | 0;
      }
      d = a + 48 | 0;
      if (!(k[d >> 2] | 0)) {
        f = a + 44 | 0;
        g = k[f >> 2] | 0;
        k[f >> 2] = l;
        h = a + 28 | 0;
        k[h >> 2] = l;
        i = a + 20 | 0;
        k[i >> 2] = l;
        k[d >> 2] = 80;
        e = a + 16 | 0;
        k[e >> 2] = l + 80;
        c = jf(a, b, j, m, n) | 0;
        if (g) {
          tc[k[a + 36 >> 2] & 63](a, 0, 0) | 0;
          c = (k[i >> 2] | 0) == 0 ? -1 : c;
          k[f >> 2] = g;
          k[d >> 2] = 0;
          k[e >> 2] = 0;
          k[h >> 2] = 0;
          k[i >> 2] = 0;
        }
      } else
        c = jf(a, b, j, m, n) | 0;
      a = c;
      r = o;
      return a | 0;
    }
    function ff(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
          f = 0,
          g = 0,
          h = 0,
          j = 0,
          l = 0;
      l = r;
      r = r + 128 | 0;
      e = l + 112 | 0;
      j = l;
      f = j;
      g = 5796;
      h = f + 112 | 0;
      do {
        k[f >> 2] = k[g >> 2];
        f = f + 4 | 0;
        g = g + 4 | 0;
      } while ((f | 0) < (h | 0));
      if ((b + -1 | 0) >>> 0 > 2147483646)
        if (!b)
          b = 1;
        else {
          c = jc() | 0;
          k[c >> 2] = 75;
          c = -1;
          r = l;
          return c | 0;
        }
      else
        e = a;
      h = -2 - e | 0;
      h = b >>> 0 > h >>> 0 ? h : b;
      k[j + 48 >> 2] = h;
      a = j + 20 | 0;
      k[a >> 2] = e;
      k[j + 44 >> 2] = e;
      b = e + h | 0;
      e = j + 16 | 0;
      k[e >> 2] = b;
      k[j + 28 >> 2] = b;
      b = ef(j, c, d) | 0;
      if (!h) {
        c = b;
        r = l;
        return c | 0;
      }
      c = k[a >> 2] | 0;
      i[c + (((c | 0) == (k[e >> 2] | 0)) << 31 >> 31) >> 0] = 0;
      c = b;
      r = l;
      return c | 0;
    }
    function gf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
          e = 0,
          f = 0,
          g = 0;
      f = b & 255;
      d = (c | 0) != 0;
      a: do
        if (d & (a & 3 | 0) != 0) {
          e = b & 255;
          while (1) {
            if ((i[a >> 0] | 0) == e << 24 >> 24) {
              g = 6;
              break a;
            }
            a = a + 1 | 0;
            c = c + -1 | 0;
            d = (c | 0) != 0;
            if (!(d & (a & 3 | 0) != 0)) {
              g = 5;
              break;
            }
          }
        } else
          g = 5;
 while (0);
      if ((g | 0) == 5)
        if (d)
          g = 6;
        else
          c = 0;
      b: do
        if ((g | 0) == 6) {
          e = b & 255;
          if ((i[a >> 0] | 0) != e << 24 >> 24) {
            d = ia(f, 16843009) | 0;
            c: do
              if (c >>> 0 > 3)
                while (1) {
                  f = k[a >> 2] ^ d;
                  if ((f & -2139062144 ^ -2139062144) & f + -16843009)
                    break;
                  a = a + 4 | 0;
                  c = c + -4 | 0;
                  if (c >>> 0 <= 3) {
                    g = 11;
                    break c;
                  }
                }
              else
                g = 11;
 while (0);
            if ((g | 0) == 11)
              if (!c) {
                c = 0;
                break;
              }
            while (1) {
              if ((i[a >> 0] | 0) == e << 24 >> 24)
                break b;
              a = a + 1 | 0;
              c = c + -1 | 0;
              if (!c) {
                c = 0;
                break;
              }
            }
          }
        }
 while (0);
      return ((c | 0) != 0 ? a : 0) | 0;
    }
    function hf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
          e = 0,
          f = 0;
      if (!c) {
        f = 0;
        return f | 0;
      } else {
        e = c;
        d = a;
      }
      while (1) {
        c = i[d >> 0] | 0;
        a = i[b >> 0] | 0;
        if (c << 24 >> 24 != a << 24 >> 24)
          break;
        e = e + -1 | 0;
        if (!e) {
          a = 0;
          f = 5;
          break;
        } else {
          d = d + 1 | 0;
          b = b + 1 | 0;
        }
      }
      if ((f | 0) == 5)
        return a | 0;
      f = (c & 255) - (a & 255) | 0;
      return f | 0;
    }
    function jf(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
          g = 0,
          h = 0,
          m = 0,
          n = 0,
          o = 0,
          q = 0.0,
          s = 0,
          u = 0,
          v = 0,
          w = 0,
          x = 0,
          y = 0.0,
          z = 0,
          A = 0,
          B = 0,
          C = 0,
          D = 0,
          E = 0,
          F = 0,
          G = 0,
          H = 0,
          I = 0,
          J = 0,
          K = 0,
          L = 0,
          N = 0,
          O = 0,
          P = 0,
          Q = 0,
          R = 0,
          S = 0,
          T = 0,
          U = 0,
          V = 0,
          W = 0,
          X = 0,
          Y = 0,
          Z = 0,
          _ = 0,
          $ = 0,
          aa = 0,
          ba = 0,
          ca = 0,
          da = 0,
          ea = 0,
          fa = 0,
          ga = 0,
          ha = 0,
          ja = 0,
          ka = 0,
          la = 0,
          ma = 0,
          na = 0,
          oa = 0,
          pa = 0,
          qa = 0,
          ra = 0,
          sa = 0,
          ta = 0,
          ua = 0,
          va = 0,
          wa = 0,
          xa = 0,
          ya = 0,
          za = 0,
          Aa = 0,
          Ba = 0,
          Ca = 0,
          Da = 0,
          Ea = 0,
          Fa = 0,
          Ga = 0,
          Ha = 0,
          Ia = 0,
          Ja = 0,
          Ka = 0,
          La = 0,
          Ma = 0,
          Na = 0,
          Oa = 0,
          Pa = 0,
          Qa = 0,
          Ra = 0,
          Sa = 0,
          Ta = 0,
          Ua = 0,
          Va = 0,
          Wa = 0,
          Xa = 0,
          Ya = 0,
          Za = 0,
          _a = 0,
          $a = 0,
          ab = 0,
          bb = 0,
          cb = 0,
          db = 0,
          eb = 0;
      eb = r;
      r = r + 864 | 0;
      Na = eb + 16 | 0;
      Qa = eb + 8 | 0;
      Oa = eb + 560 | 0;
      ma = Oa;
      Ka = eb + 840 | 0;
      Xa = eb + 584 | 0;
      Ga = eb + 520 | 0;
      bb = eb;
      Ua = eb + 852 | 0;
      na = (a | 0) != 0;
      Aa = Ga + 40 | 0;
      Da = Aa;
      Ga = Ga + 39 | 0;
      Ha = bb + 4 | 0;
      Ia = bb;
      Ja = Ka + 12 | 0;
      Ka = Ka + 11 | 0;
      La = Ja;
      oa = La - ma | 0;
      pa = -2 - ma | 0;
      va = La + 2 | 0;
      wa = Na + 288 | 0;
      xa = Oa + 9 | 0;
      ya = xa;
      za = Oa + 8 | 0;
      G = 0;
      E = 0;
      u = 0;
      n = 0;
      v = 0;
      a: while (1) {
        do
          if ((u | 0) > -1)
            if ((n | 0) > (2147483647 - u | 0)) {
              aa = jc() | 0;
              k[aa >> 2] = 75;
              aa = -1;
              break;
            } else {
              aa = n + u | 0;
              break;
            }
          else
            aa = u;
 while (0);
        n = i[b >> 0] | 0;
        if (!(n << 24 >> 24)) {
          Pa = aa;
          Ta = v;
          P = 344;
          break;
        } else
          m = b;
        b: while (1) {
          switch (n << 24 >> 24) {
            case 0:
              {
                ka = m;
                ea = m;
                break b;
              }
            case 37:
              {
                Sa = m;
                cb = m;
                P = 9;
                break b;
              }
            default:
              {}
          }
          O = m + 1 | 0;
          n = i[O >> 0] | 0;
          m = O;
        }
        c: do
          if ((P | 0) == 9)
            while (1) {
              P = 0;
              if ((i[Sa + 1 >> 0] | 0) != 37) {
                ka = Sa;
                ea = cb;
                break c;
              }
              m = cb + 1 | 0;
              n = Sa + 2 | 0;
              if ((i[n >> 0] | 0) == 37) {
                Sa = n;
                cb = m;
              } else {
                ka = n;
                ea = m;
                break;
              }
            }
 while (0);
        n = ea - b | 0;
        if (na)
          cf(b, n, a) | 0;
        if ((ea | 0) != (b | 0)) {
          u = aa;
          b = ka;
          continue;
        }
        s = ka + 1 | 0;
        o = i[s >> 0] | 0;
        m = (o << 24 >> 24) + -48 | 0;
        if (m >>> 0 < 10) {
          O = (i[ka + 2 >> 0] | 0) == 36;
          s = O ? ka + 3 | 0 : s;
          o = i[s >> 0] | 0;
          F = O ? m : -1;
          v = O ? 1 : v;
        } else
          F = -1;
        m = o << 24 >> 24;
        d: do
          if ((m & -32 | 0) == 32) {
            u = 0;
            do {
              if (!(1 << m + -32 & 75913))
                break d;
              u = 1 << (o << 24 >> 24) + -32 | u;
              s = s + 1 | 0;
              o = i[s >> 0] | 0;
              m = o << 24 >> 24;
            } while ((m & -32 | 0) == 32);
          } else
            u = 0;
 while (0);
        do
          if (o << 24 >> 24 == 42) {
            m = s + 1 | 0;
            o = (i[m >> 0] | 0) + -48 | 0;
            if (o >>> 0 < 10 ? (i[s + 2 >> 0] | 0) == 36 : 0) {
              k[e + (o << 2) >> 2] = 10;
              v = 1;
              o = s + 3 | 0;
              s = k[d + ((i[m >> 0] | 0) + -48 << 3) >> 2] | 0;
            } else {
              if (v) {
                db = -1;
                P = 363;
                break a;
              }
              if (!na) {
                o = m;
                v = 0;
                N = 0;
                break;
              }
              v = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
              s = k[v >> 2] | 0;
              k[c >> 2] = v + 4;
              v = 0;
              o = m;
            }
            if ((s | 0) < 0) {
              u = u | 8192;
              N = 0 - s | 0;
            } else
              N = s;
          } else {
            m = (o << 24 >> 24) + -48 | 0;
            if (m >>> 0 < 10) {
              o = s;
              s = 0;
              do {
                s = (s * 10 | 0) + m | 0;
                o = o + 1 | 0;
                m = (i[o >> 0] | 0) + -48 | 0;
              } while (m >>> 0 < 10);
              if ((s | 0) < 0) {
                db = -1;
                P = 363;
                break a;
              } else
                N = s;
            } else {
              o = s;
              N = 0;
            }
          }
 while (0);
        e: do
          if ((i[o >> 0] | 0) == 46) {
            s = o + 1 | 0;
            m = i[s >> 0] | 0;
            if (m << 24 >> 24 != 42) {
              m = (m << 24 >> 24) + -48 | 0;
              if (m >>> 0 < 10) {
                o = s;
                s = 0;
              } else {
                o = s;
                z = 0;
                break;
              }
              while (1) {
                s = (s * 10 | 0) + m | 0;
                o = o + 1 | 0;
                m = (i[o >> 0] | 0) + -48 | 0;
                if (m >>> 0 >= 10) {
                  z = s;
                  break e;
                }
              }
            }
            m = o + 2 | 0;
            s = (i[m >> 0] | 0) + -48 | 0;
            if (s >>> 0 < 10 ? (i[o + 3 >> 0] | 0) == 36 : 0) {
              k[e + (s << 2) >> 2] = 10;
              o = o + 4 | 0;
              z = k[d + ((i[m >> 0] | 0) + -48 << 3) >> 2] | 0;
              break;
            }
            if (v) {
              db = -1;
              P = 363;
              break a;
            }
            if (na) {
              o = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
              z = k[o >> 2] | 0;
              k[c >> 2] = o + 4;
              o = m;
            } else {
              o = m;
              z = 0;
            }
          } else
            z = -1;
 while (0);
        x = 0;
        while (1) {
          s = (i[o >> 0] | 0) + -65 | 0;
          if (s >>> 0 > 57) {
            db = -1;
            P = 363;
            break a;
          }
          m = o + 1 | 0;
          s = i[634876 + (x * 58 | 0) + s >> 0] | 0;
          w = s & 255;
          if ((w + -1 | 0) >>> 0 < 8) {
            o = m;
            x = w;
          } else {
            O = m;
            break;
          }
        }
        if (!(s << 24 >> 24)) {
          db = -1;
          P = 363;
          break;
        }
        m = (F | 0) > -1;
        f: do
          if (s << 24 >> 24 == 19)
            if (m) {
              db = -1;
              P = 363;
              break a;
            } else {
              qa = G;
              ra = E;
              P = 62;
            }
          else {
            if (m) {
              k[e + (F << 2) >> 2] = w;
              ra = d + (F << 3) | 0;
              qa = k[ra + 4 >> 2] | 0;
              ra = k[ra >> 2] | 0;
              P = 62;
              break;
            }
            if (!na) {
              db = 0;
              P = 363;
              break a;
            }
            if ((s & 255) > 20) {
              Ba = E;
              Ca = G;
            } else
              do
                switch (w | 0) {
                  case 9:
                    {
                      Ca = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
                      Ba = k[Ca >> 2] | 0;
                      k[c >> 2] = Ca + 4;
                      Ca = G;
                      break f;
                    }
                  case 10:
                    {
                      Ba = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
                      Ca = k[Ba >> 2] | 0;
                      k[c >> 2] = Ba + 4;
                      Ba = Ca;
                      Ca = ((Ca | 0) < 0) << 31 >> 31;
                      break f;
                    }
                  case 11:
                    {
                      Ca = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
                      Ba = k[Ca >> 2] | 0;
                      k[c >> 2] = Ca + 4;
                      Ca = 0;
                      break f;
                    }
                  case 12:
                    {
                      L = (k[c >> 2] | 0) + (8 - 1) & ~(8 - 1);
                      Ca = L;
                      Ba = k[Ca >> 2] | 0;
                      Ca = k[Ca + 4 >> 2] | 0;
                      k[c >> 2] = L + 8;
                      break f;
                    }
                  case 13:
                    {
                      Ba = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
                      Ca = k[Ba >> 2] | 0;
                      k[c >> 2] = Ba + 4;
                      Ba = Ca << 16 >> 16;
                      Ca = (((Ca & 65535) << 16 >> 16 | 0) < 0) << 31 >> 31;
                      break f;
                    }
                  case 14:
                    {
                      Ca = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
                      Ba = k[Ca >> 2] | 0;
                      k[c >> 2] = Ca + 4;
                      Ba = Ba & 65535;
                      Ca = 0;
                      break f;
                    }
                  case 15:
                    {
                      Ba = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
                      Ca = k[Ba >> 2] | 0;
                      k[c >> 2] = Ba + 4;
                      Ba = Ca << 24 >> 24;
                      Ca = (((Ca & 255) << 24 >> 24 | 0) < 0) << 31 >> 31;
                      break f;
                    }
                  case 16:
                    {
                      Ca = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
                      Ba = k[Ca >> 2] | 0;
                      k[c >> 2] = Ca + 4;
                      Ba = Ba & 255;
                      Ca = 0;
                      break f;
                    }
                  case 17:
                    {
                      Ba = (k[c >> 2] | 0) + (8 - 1) & ~(8 - 1);
                      y = +p[Ba >> 3];
                      k[c >> 2] = Ba + 8;
                      p[t >> 3] = y;
                      Ba = k[t >> 2] | 0;
                      Ca = k[t + 4 >> 2] | 0;
                      break f;
                    }
                  case 18:
                    {
                      Ba = (k[c >> 2] | 0) + (8 - 1) & ~(8 - 1);
                      y = +p[Ba >> 3];
                      k[c >> 2] = Ba + 8;
                      p[t >> 3] = y;
                      Ba = k[t >> 2] | 0;
                      Ca = k[t + 4 >> 2] | 0;
                      break f;
                    }
                  default:
                    {
                      Ba = E;
                      Ca = G;
                      break f;
                    }
                }
 while (0);
          }
 while (0);
        if ((P | 0) == 62) {
          P = 0;
          if (na) {
            Ba = ra;
            Ca = qa;
          } else {
            G = qa;
            E = ra;
            u = aa;
            b = O;
            continue;
          }
        }
        H = i[o >> 0] | 0;
        H = (x | 0) != 0 & (H & 15 | 0) == 3 ? H & -33 : H;
        s = u & -65537;
        L = (u & 8192 | 0) == 0 ? u : s;
        g: do
          switch (H | 0) {
            case 110:
              switch (x | 0) {
                case 0:
                  {
                    k[Ba >> 2] = aa;
                    G = Ca;
                    E = Ba;
                    u = aa;
                    b = O;
                    continue a;
                  }
                case 1:
                  {
                    k[Ba >> 2] = aa;
                    G = Ca;
                    E = Ba;
                    u = aa;
                    b = O;
                    continue a;
                  }
                case 2:
                  {
                    G = Ba;
                    k[G >> 2] = aa;
                    k[G + 4 >> 2] = ((aa | 0) < 0) << 31 >> 31;
                    G = Ca;
                    E = Ba;
                    u = aa;
                    b = O;
                    continue a;
                  }
                case 3:
                  {
                    j[Ba >> 1] = aa;
                    G = Ca;
                    E = Ba;
                    u = aa;
                    b = O;
                    continue a;
                  }
                case 4:
                  {
                    i[Ba >> 0] = aa;
                    G = Ca;
                    E = Ba;
                    u = aa;
                    b = O;
                    continue a;
                  }
                case 6:
                  {
                    k[Ba >> 2] = aa;
                    G = Ca;
                    E = Ba;
                    u = aa;
                    b = O;
                    continue a;
                  }
                case 7:
                  {
                    G = Ba;
                    k[G >> 2] = aa;
                    k[G + 4 >> 2] = ((aa | 0) < 0) << 31 >> 31;
                    G = Ca;
                    E = Ba;
                    u = aa;
                    b = O;
                    continue a;
                  }
                default:
                  {
                    G = Ca;
                    E = Ba;
                    u = aa;
                    b = O;
                    continue a;
                  }
              }
            case 112:
              {
                Ra = L | 8;
                Va = z >>> 0 > 8 ? z : 8;
                ab = 120;
                P = 73;
                break;
              }
            case 88:
            case 120:
              {
                Ra = L;
                Va = z;
                ab = H;
                P = 73;
                break;
              }
            case 111:
              {
                m = (Ba | 0) == 0 & (Ca | 0) == 0;
                if (m)
                  h = Aa;
                else {
                  h = Aa;
                  b = Ba;
                  n = Ca;
                  do {
                    h = h + -1 | 0;
                    i[h >> 0] = b & 7 | 48;
                    b = uf(b | 0, n | 0, 3) | 0;
                    n = M;
                  } while (!((b | 0) == 0 & (n | 0) == 0));
                }
                T = (L & 8 | 0) == 0 | m;
                U = Ba;
                V = Ca;
                Q = L;
                R = z;
                S = T & 1 ^ 1;
                T = T ? 635356 : 635361;
                P = 89;
                break;
              }
            case 105:
            case 100:
              {
                if ((Ca | 0) < 0) {
                  Fa = of(0, 0, Ba | 0, Ca | 0) | 0;
                  Ea = M;
                  Ya = 1;
                  Za = 635356;
                  P = 84;
                  break g;
                }
                if (!(L & 2048)) {
                  Za = L & 1;
                  Ea = Ca;
                  Fa = Ba;
                  Ya = Za;
                  Za = (Za | 0) == 0 ? 635356 : 635358;
                  P = 84;
                } else {
                  Ea = Ca;
                  Fa = Ba;
                  Ya = 1;
                  Za = 635357;
                  P = 84;
                }
                break;
              }
            case 117:
              {
                Ea = Ca;
                Fa = Ba;
                Ya = 0;
                Za = 635356;
                P = 84;
                break;
              }
            case 115:
              {
                Ma = (Ba | 0) != 0 ? Ba : 635366;
                P = 94;
                break;
              }
            case 67:
              {
                k[bb >> 2] = Ba;
                k[Ha >> 2] = 0;
                sa = bb;
                ta = Ia;
                Wa = -1;
                P = 97;
                break;
              }
            case 65:
            case 71:
            case 70:
            case 69:
            case 97:
            case 103:
            case 102:
            case 101:
              {
                k[t >> 2] = Ba;
                k[t + 4 >> 2] = Ca;
                q = +p[t >> 3];
                k[Qa >> 2] = 0;
                if ((Ca | 0) >= 0)
                  if (!(L & 2048)) {
                    J = L & 1;
                    I = J;
                    J = (J | 0) == 0 ? 635374 : 635379;
                  } else {
                    I = 1;
                    J = 635376;
                  }
                else {
                  q = -q;
                  I = 1;
                  J = 635373;
                }
                p[t >> 3] = q;
                K = k[t + 4 >> 2] & 2146435072;
                do
                  if (K >>> 0 < 2146435072 | (K | 0) == 2146435072 & 0 < 0) {
                    y = +Ze(q, Qa) * 2.0;
                    s = y != 0.0;
                    if (s)
                      k[Qa >> 2] = (k[Qa >> 2] | 0) + -1;
                    G = H | 32;
                    if ((G | 0) == 97) {
                      A = H & 32;
                      C = (A | 0) == 0 ? J : J + 9 | 0;
                      D = I | 2;
                      s = 12 - z | 0;
                      do
                        if (!(z >>> 0 > 11 | (s | 0) == 0)) {
                          q = 8.0;
                          do {
                            s = s + -1 | 0;
                            q = q * 16.0;
                          } while ((s | 0) != 0);
                          if ((i[C >> 0] | 0) == 45) {
                            q = -(q + (-y - q));
                            break;
                          } else {
                            q = y + q - q;
                            break;
                          }
                        } else
                          q = y;
 while (0);
                      s = k[Qa >> 2] | 0;
                      s = (s | 0) < 0 ? 0 - s | 0 : s;
                      if ((s | 0) < 0) {
                        o = Ja;
                        b = s;
                        u = ((s | 0) < 0) << 31 >> 31;
                        while (1) {
                          s = Ef(b | 0, u | 0, 10, 0) | 0;
                          o = o + -1 | 0;
                          i[o >> 0] = s | 48;
                          s = Df(b | 0, u | 0, 10, 0) | 0;
                          if (u >>> 0 > 9 | (u | 0) == 9 & b >>> 0 > 4294967295) {
                            b = s;
                            u = M;
                          } else
                            break;
                        }
                      } else
                        o = Ja;
                      if (s)
                        while (1) {
                          o = o + -1 | 0;
                          i[o >> 0] = (s >>> 0) % 10 | 0 | 48;
                          if (s >>> 0 < 10)
                            break;
                          else
                            s = (s >>> 0) / 10 | 0;
                        }
                      if ((o | 0) == (Ja | 0)) {
                        i[Ka >> 0] = 48;
                        o = Ka;
                      }
                      i[o + -1 >> 0] = (k[Qa >> 2] >> 31 & 2) + 43;
                      B = o + -2 | 0;
                      i[B >> 0] = H + 15;
                      if (!(L & 8))
                        if ((z | 0) < 1) {
                          o = Oa;
                          do {
                            K = ~~q;
                            s = o + 1 | 0;
                            i[o >> 0] = l[635340 + K >> 0] | A;
                            q = (q - +(K | 0)) * 16.0;
                            if ((s - ma | 0) != 1 | q == 0.0)
                              o = s;
                            else {
                              i[s >> 0] = 46;
                              o = o + 2 | 0;
                            }
                          } while (q != 0.0);
                        } else {
                          o = Oa;
                          do {
                            K = ~~q;
                            s = o + 1 | 0;
                            i[o >> 0] = l[635340 + K >> 0] | A;
                            q = (q - +(K | 0)) * 16.0;
                            if ((s - ma | 0) == 1) {
                              i[s >> 0] = 46;
                              o = o + 2 | 0;
                            } else
                              o = s;
                          } while (q != 0.0);
                        }
                      else {
                        o = Oa;
                        do {
                          K = ~~q;
                          s = o + 1 | 0;
                          i[o >> 0] = l[635340 + K >> 0] | A;
                          q = (q - +(K | 0)) * 16.0;
                          if ((s - ma | 0) == 1) {
                            i[s >> 0] = 46;
                            o = o + 2 | 0;
                          } else
                            o = s;
                        } while (q != 0.0);
                      }
                      x = (z | 0) != 0 & (pa + o | 0) < (z | 0) ? va + z - B | 0 : oa - B + o | 0;
                      w = x + D | 0;
                      u = L & 73728;
                      m = (N | 0) > (w | 0);
                      if ((u | 0) == 0 & m) {
                        s = N - w | 0;
                        pf(Xa | 0, 32, (s >>> 0 > 256 ? 256 : s) | 0) | 0;
                        if (s >>> 0 > 255) {
                          b = s;
                          do {
                            cf(Xa, 256, a) | 0;
                            b = b + -256 | 0;
                          } while (b >>> 0 > 255);
                          s = s & 255;
                        }
                        cf(Xa, s, a) | 0;
                      }
                      cf(C, D, a) | 0;
                      if ((u | 0) == 65536 & m) {
                        b = N - w | 0;
                        pf(Xa | 0, 48, (b >>> 0 > 256 ? 256 : b) | 0) | 0;
                        if (b >>> 0 > 255) {
                          n = b;
                          do {
                            cf(Xa, 256, a) | 0;
                            n = n + -256 | 0;
                          } while (n >>> 0 > 255);
                          b = b & 255;
                        }
                        cf(Xa, b, a) | 0;
                      }
                      o = o - ma | 0;
                      cf(Oa, o, a) | 0;
                      s = La - B | 0;
                      o = x - s - o | 0;
                      if ((o | 0) > 0) {
                        pf(Xa | 0, 48, (o >>> 0 > 256 ? 256 : o) | 0) | 0;
                        if (o >>> 0 > 255) {
                          b = o;
                          do {
                            cf(Xa, 256, a) | 0;
                            b = b + -256 | 0;
                          } while (b >>> 0 > 255);
                          o = o & 255;
                        }
                        cf(Xa, o, a) | 0;
                      }
                      cf(B, s, a) | 0;
                      if ((u | 0) == 8192 & m) {
                        b = N - w | 0;
                        pf(Xa | 0, 32, (b >>> 0 > 256 ? 256 : b) | 0) | 0;
                        if (b >>> 0 > 255) {
                          o = b;
                          do {
                            cf(Xa, 256, a) | 0;
                            o = o + -256 | 0;
                          } while (o >>> 0 > 255);
                          b = b & 255;
                        }
                        cf(Xa, b, a) | 0;
                      }
                      n = m ? N : w;
                      break;
                    }
                    o = (z | 0) < 0 ? 6 : z;
                    if (s) {
                      s = (k[Qa >> 2] | 0) + -28 | 0;
                      k[Qa >> 2] = s;
                      q = y * 268435456.0;
                    } else {
                      q = y;
                      s = k[Qa >> 2] | 0;
                    }
                    K = (s | 0) < 0 ? Na : wa;
                    E = K;
                    u = K;
                    do {
                      F = ~~q >>> 0;
                      k[u >> 2] = F;
                      u = u + 4 | 0;
                      q = (q - +(F >>> 0)) * 1.0e9;
                    } while (q != 0.0);
                    s = k[Qa >> 2] | 0;
                    if ((s | 0) > 0) {
                      b = s;
                      s = K;
                      do {
                        x = (b | 0) > 29 ? 29 : b;
                        n = u + -4 | 0;
                        do
                          if (n >>> 0 >= s >>> 0) {
                            b = 0;
                            do {
                              F = sf(k[n >> 2] | 0, 0, x | 0) | 0;
                              F = tf(F | 0, M | 0, b | 0, 0) | 0;
                              b = M;
                              D = Ef(F | 0, b | 0, 1e9, 0) | 0;
                              k[n >> 2] = D;
                              b = Df(F | 0, b | 0, 1e9, 0) | 0;
                              n = n + -4 | 0;
                            } while (n >>> 0 >= s >>> 0);
                            if (!b)
                              break;
                            s = s + -4 | 0;
                            k[s >> 2] = b;
                          }
 while (0);
                        while (1) {
                          if (u >>> 0 <= s >>> 0)
                            break;
                          b = u + -4 | 0;
                          if (!(k[b >> 2] | 0))
                            u = b;
                          else
                            break;
                        }
                        b = (k[Qa >> 2] | 0) - x | 0;
                        k[Qa >> 2] = b;
                      } while ((b | 0) > 0);
                    } else {
                      b = s;
                      s = K;
                    }
                    h: do
                      if ((b | 0) < 0) {
                        B = ((o + 25 | 0) / 9 | 0) + 1 | 0;
                        if ((G | 0) != 102)
                          while (1) {
                            w = 0 - b | 0;
                            w = (w | 0) > 9 ? 9 : w;
                            do
                              if (s >>> 0 < u >>> 0) {
                                x = (1 << w) + -1 | 0;
                                n = 1e9 >>> w;
                                b = 0;
                                m = s;
                                do {
                                  F = k[m >> 2] | 0;
                                  k[m >> 2] = (F >>> w) + b;
                                  b = ia(F & x, n) | 0;
                                  m = m + 4 | 0;
                                } while (m >>> 0 < u >>> 0);
                                s = (k[s >> 2] | 0) == 0 ? s + 4 | 0 : s;
                                if (!b)
                                  break;
                                k[u >> 2] = b;
                                u = u + 4 | 0;
                              } else
                                s = (k[s >> 2] | 0) == 0 ? s + 4 | 0 : s;
 while (0);
                            u = (u - s >> 2 | 0) > (B | 0) ? s + (B << 2) | 0 : u;
                            b = (k[Qa >> 2] | 0) + w | 0;
                            k[Qa >> 2] = b;
                            if ((b | 0) >= 0)
                              break h;
                          }
                        z = K + (B << 2) | 0;
                        do {
                          w = 0 - b | 0;
                          w = (w | 0) > 9 ? 9 : w;
                          do
                            if (s >>> 0 < u >>> 0) {
                              x = (1 << w) + -1 | 0;
                              n = 1e9 >>> w;
                              b = 0;
                              m = s;
                              do {
                                F = k[m >> 2] | 0;
                                k[m >> 2] = (F >>> w) + b;
                                b = ia(F & x, n) | 0;
                                m = m + 4 | 0;
                              } while (m >>> 0 < u >>> 0);
                              s = (k[s >> 2] | 0) == 0 ? s + 4 | 0 : s;
                              if (!b)
                                break;
                              k[u >> 2] = b;
                              u = u + 4 | 0;
                            } else
                              s = (k[s >> 2] | 0) == 0 ? s + 4 | 0 : s;
 while (0);
                          u = (u - E >> 2 | 0) > (B | 0) ? z : u;
                          b = (k[Qa >> 2] | 0) + w | 0;
                          k[Qa >> 2] = b;
                        } while ((b | 0) < 0);
                      }
 while (0);
                    do
                      if (s >>> 0 < u >>> 0) {
                        b = (E - s >> 2) * 9 | 0;
                        m = k[s >> 2] | 0;
                        if (m >>> 0 < 10) {
                          A = b;
                          break;
                        } else
                          n = 10;
                        do {
                          n = n * 10 | 0;
                          b = b + 1 | 0;
                        } while (m >>> 0 >= n >>> 0);
                        A = b;
                      } else
                        A = 0;
 while (0);
                    D = (G | 0) == 103;
                    C = (o | 0) != 0;
                    b = o - ((G | 0) != 102 ? A : 0) + ((C & D) << 31 >> 31) | 0;
                    if ((b | 0) < (((u - E >> 2) * 9 | 0) + -9 | 0)) {
                      n = b + 9216 | 0;
                      z = (n | 0) / 9 | 0;
                      b = K + (z + -1023 << 2) | 0;
                      n = ((n | 0) % 9 | 0) + 1 | 0;
                      if ((n | 0) < 9) {
                        x = 10;
                        do {
                          x = x * 10 | 0;
                          n = n + 1 | 0;
                        } while ((n | 0) != 9);
                      } else
                        x = 10;
                      m = k[b >> 2] | 0;
                      w = (m >>> 0) % (x >>> 0) | 0;
                      if ((w | 0) == 0 ? (K + (z + -1022 << 2) | 0) == (u | 0) : 0) {
                        Y = s;
                        X = b;
                        W = A;
                      } else
                        P = 221;
                      do
                        if ((P | 0) == 221) {
                          P = 0;
                          y = (((m >>> 0) / (x >>> 0) | 0) & 1 | 0) == 0 ? 9007199254740992.0 : 9007199254740994.0;
                          n = (x | 0) / 2 | 0;
                          do
                            if (w >>> 0 < n >>> 0)
                              q = .5;
                            else {
                              if ((w | 0) == (n | 0) ? (K + (z + -1022 << 2) | 0) == (u | 0) : 0) {
                                q = 1.0;
                                break;
                              }
                              q = 1.5;
                            }
 while (0);
                          do
                            if (I) {
                              if ((i[J >> 0] | 0) != 45)
                                break;
                              y = -y;
                              q = -q;
                            }
 while (0);
                          n = m - w | 0;
                          k[b >> 2] = n;
                          if (!(y + q != y)) {
                            Y = s;
                            X = b;
                            W = A;
                            break;
                          }
                          Y = n + x | 0;
                          k[b >> 2] = Y;
                          if (Y >>> 0 > 999999999)
                            while (1) {
                              n = b + -4 | 0;
                              k[b >> 2] = 0;
                              if (n >>> 0 < s >>> 0) {
                                s = s + -4 | 0;
                                k[s >> 2] = 0;
                              }
                              Y = (k[n >> 2] | 0) + 1 | 0;
                              k[n >> 2] = Y;
                              if (Y >>> 0 > 999999999)
                                b = n;
                              else {
                                b = n;
                                break;
                              }
                            }
                          n = (E - s >> 2) * 9 | 0;
                          w = k[s >> 2] | 0;
                          if (w >>> 0 < 10) {
                            Y = s;
                            X = b;
                            W = n;
                            break;
                          } else
                            m = 10;
                          do {
                            m = m * 10 | 0;
                            n = n + 1 | 0;
                          } while (w >>> 0 >= m >>> 0);
                          Y = s;
                          X = b;
                          W = n;
                        }
 while (0);
                      G = X + 4 | 0;
                      s = Y;
                      A = W;
                      u = u >>> 0 > G >>> 0 ? G : u;
                    }
                    z = 0 - A | 0;
                    while (1) {
                      if (u >>> 0 <= s >>> 0) {
                        F = 0;
                        break;
                      }
                      b = u + -4 | 0;
                      if (!(k[b >> 2] | 0))
                        u = b;
                      else {
                        F = 1;
                        break;
                      }
                    }
                    do
                      if (D) {
                        o = (C & 1 ^ 1) + o | 0;
                        if ((o | 0) > (A | 0) & (A | 0) > -5) {
                          m = H + -1 | 0;
                          o = o + -1 - A | 0;
                        } else {
                          m = H + -2 | 0;
                          o = o + -1 | 0;
                        }
                        b = L & 8;
                        if (b) {
                          D = b;
                          break;
                        }
                        do
                          if (F) {
                            x = k[u + -4 >> 2] | 0;
                            if (!x) {
                              n = 9;
                              break;
                            }
                            if (!((x >>> 0) % 10 | 0)) {
                              b = 10;
                              n = 0;
                            } else {
                              n = 0;
                              break;
                            }
                            do {
                              b = b * 10 | 0;
                              n = n + 1 | 0;
                            } while (((x >>> 0) % (b >>> 0) | 0 | 0) == 0);
                          } else
                            n = 9;
 while (0);
                        b = ((u - E >> 2) * 9 | 0) + -9 | 0;
                        if ((m | 32 | 0) == 102) {
                          D = b - n | 0;
                          D = (D | 0) < 0 ? 0 : D;
                          o = (o | 0) < (D | 0) ? o : D;
                          D = 0;
                          break;
                        } else {
                          D = b + A - n | 0;
                          D = (D | 0) < 0 ? 0 : D;
                          o = (o | 0) < (D | 0) ? o : D;
                          D = 0;
                          break;
                        }
                      } else {
                        m = H;
                        D = L & 8;
                      }
 while (0);
                    E = o | D;
                    B = (E | 0) != 0 & 1;
                    C = (m | 32 | 0) == 102;
                    if (C) {
                      b = (A | 0) > 0 ? A : 0;
                      A = 0;
                    } else {
                      x = (A | 0) < 0 ? z : A;
                      if ((x | 0) < 0) {
                        b = Ja;
                        w = x;
                        n = ((x | 0) < 0) << 31 >> 31;
                        while (1) {
                          x = Ef(w | 0, n | 0, 10, 0) | 0;
                          b = b + -1 | 0;
                          i[b >> 0] = x | 48;
                          x = Df(w | 0, n | 0, 10, 0) | 0;
                          if (n >>> 0 > 9 | (n | 0) == 9 & w >>> 0 > 4294967295) {
                            w = x;
                            n = M;
                          } else
                            break;
                        }
                      } else
                        b = Ja;
                      if (x)
                        while (1) {
                          b = b + -1 | 0;
                          i[b >> 0] = (x >>> 0) % 10 | 0 | 48;
                          if (x >>> 0 < 10)
                            break;
                          else
                            x = (x >>> 0) / 10 | 0;
                        }
                      if ((La - b | 0) < 2)
                        do {
                          b = b + -1 | 0;
                          i[b >> 0] = 48;
                        } while ((La - b | 0) < 2);
                      i[b + -1 >> 0] = (A >> 31 & 2) + 43;
                      A = b + -2 | 0;
                      i[A >> 0] = m;
                      b = La - A | 0;
                    }
                    G = I + 1 + o + B + b | 0;
                    B = L & 73728;
                    z = (N | 0) > (G | 0);
                    if ((B | 0) == 0 & z) {
                      b = N - G | 0;
                      pf(Xa | 0, 32, (b >>> 0 > 256 ? 256 : b) | 0) | 0;
                      if (b >>> 0 > 255) {
                        x = b;
                        do {
                          cf(Xa, 256, a) | 0;
                          x = x + -256 | 0;
                        } while (x >>> 0 > 255);
                        b = b & 255;
                      }
                      cf(Xa, b, a) | 0;
                    }
                    cf(J, I, a) | 0;
                    if ((B | 0) == 65536 & z) {
                      b = N - G | 0;
                      pf(Xa | 0, 48, (b >>> 0 > 256 ? 256 : b) | 0) | 0;
                      if (b >>> 0 > 255) {
                        n = b;
                        do {
                          cf(Xa, 256, a) | 0;
                          n = n + -256 | 0;
                        } while (n >>> 0 > 255);
                        b = b & 255;
                      }
                      cf(Xa, b, a) | 0;
                    }
                    if (C) {
                      x = s >>> 0 > K >>> 0 ? K : s;
                      b = x;
                      do {
                        n = k[b >> 2] | 0;
                        if (!n)
                          s = xa;
                        else {
                          s = xa;
                          while (1) {
                            s = s + -1 | 0;
                            i[s >> 0] = (n >>> 0) % 10 | 0 | 48;
                            if (n >>> 0 < 10)
                              break;
                            else
                              n = (n >>> 0) / 10 | 0;
                          }
                        }
                        do
                          if ((b | 0) == (x | 0)) {
                            if ((s | 0) != (xa | 0))
                              break;
                            i[za >> 0] = 48;
                            s = za;
                          } else {
                            if (s >>> 0 <= Oa >>> 0)
                              break;
                            do {
                              s = s + -1 | 0;
                              i[s >> 0] = 48;
                            } while (s >>> 0 > Oa >>> 0);
                          }
 while (0);
                        cf(s, ya - s | 0, a) | 0;
                        b = b + 4 | 0;
                      } while (b >>> 0 <= K >>> 0);
                      if (E)
                        cf(635408, 1, a) | 0;
                      if ((o | 0) > 0 & b >>> 0 < u >>> 0) {
                        n = b;
                        do {
                          s = k[n >> 2] | 0;
                          if (s) {
                            b = xa;
                            while (1) {
                              b = b + -1 | 0;
                              i[b >> 0] = (s >>> 0) % 10 | 0 | 48;
                              if (s >>> 0 < 10)
                                break;
                              else
                                s = (s >>> 0) / 10 | 0;
                            }
                            if (b >>> 0 > Oa >>> 0) {
                              _a = b;
                              P = 289;
                            } else
                              la = b;
                          } else {
                            _a = xa;
                            P = 289;
                          }
                          if ((P | 0) == 289)
                            while (1) {
                              P = 0;
                              b = _a + -1 | 0;
                              i[b >> 0] = 48;
                              if (b >>> 0 > Oa >>> 0)
                                _a = b;
                              else {
                                la = b;
                                break;
                              }
                            }
                          L = (o | 0) > 9;
                          cf(la, L ? 9 : o, a) | 0;
                          n = n + 4 | 0;
                          o = o + -9 | 0;
                        } while (L & n >>> 0 < u >>> 0);
                      }
                      if ((o | 0) > 0) {
                        pf(Xa | 0, 48, (o >>> 0 > 256 ? 256 : o) | 0) | 0;
                        if (o >>> 0 > 255) {
                          b = o;
                          do {
                            cf(Xa, 256, a) | 0;
                            b = b + -256 | 0;
                          } while (b >>> 0 > 255);
                          o = o & 255;
                        }
                        cf(Xa, o, a) | 0;
                      }
                    } else {
                      w = F ? u : s + 4 | 0;
                      do
                        if ((o | 0) > -1) {
                          m = (D | 0) == 0;
                          x = s;
                          do {
                            u = k[x >> 2] | 0;
                            if (u) {
                              b = xa;
                              n = u;
                              while (1) {
                                u = b + -1 | 0;
                                i[u >> 0] = (n >>> 0) % 10 | 0 | 48;
                                if (n >>> 0 < 10)
                                  break;
                                else {
                                  b = u;
                                  n = (n >>> 0) / 10 | 0;
                                }
                              }
                              if ((u | 0) != (xa | 0)) {
                                ua = b;
                                $a = u;
                              } else
                                P = 303;
                            } else
                              P = 303;
                            if ((P | 0) == 303) {
                              P = 0;
                              i[za >> 0] = 48;
                              ua = xa;
                              $a = za;
                            }
                            do
                              if ((x | 0) == (s | 0)) {
                                cf($a, 1, a) | 0;
                                if (m & (o | 0) < 1) {
                                  u = ua;
                                  break;
                                }
                                cf(635408, 1, a) | 0;
                                u = ua;
                              } else {
                                if ($a >>> 0 > Oa >>> 0)
                                  u = $a;
                                else {
                                  u = $a;
                                  break;
                                }
                                do {
                                  u = u + -1 | 0;
                                  i[u >> 0] = 48;
                                } while (u >>> 0 > Oa >>> 0);
                              }
 while (0);
                            L = ya - u | 0;
                            cf(u, (o | 0) > (L | 0) ? L : o, a) | 0;
                            o = o - L | 0;
                            x = x + 4 | 0;
                          } while (x >>> 0 < w >>> 0 & (o | 0) > -1);
                          if ((o | 0) <= 0)
                            break;
                          pf(Xa | 0, 48, (o >>> 0 > 256 ? 256 : o) | 0) | 0;
                          if (o >>> 0 > 255) {
                            b = o;
                            do {
                              cf(Xa, 256, a) | 0;
                              b = b + -256 | 0;
                            } while (b >>> 0 > 255);
                            o = o & 255;
                          }
                          cf(Xa, o, a) | 0;
                        }
 while (0);
                      cf(A, La - A | 0, a) | 0;
                    }
                    if ((B | 0) == 8192 & z) {
                      b = N - G | 0;
                      pf(Xa | 0, 32, (b >>> 0 > 256 ? 256 : b) | 0) | 0;
                      if (b >>> 0 > 255) {
                        o = b;
                        do {
                          cf(Xa, 256, a) | 0;
                          o = o + -256 | 0;
                        } while (o >>> 0 > 255);
                        b = b & 255;
                      }
                      cf(Xa, b, a) | 0;
                    }
                    n = z ? N : G;
                  } else {
                    n = (H & 32 | 0) != 0;
                    u = q != q | 0.0 != 0.0;
                    s = u ? 0 : I;
                    n = u ? (n ? 635400 : 635404) : n ? 635392 : 635396;
                    u = s + 3 | 0;
                    m = (N | 0) > (u | 0);
                    if ((L & 8192 | 0) == 0 & m) {
                      o = N - u | 0;
                      pf(Xa | 0, 32, (o >>> 0 > 256 ? 256 : o) | 0) | 0;
                      if (o >>> 0 > 255) {
                        b = o;
                        do {
                          cf(Xa, 256, a) | 0;
                          b = b + -256 | 0;
                        } while (b >>> 0 > 255);
                        o = o & 255;
                      }
                      cf(Xa, o, a) | 0;
                    }
                    cf(J, s, a) | 0;
                    cf(n, 3, a) | 0;
                    if ((L & 73728 | 0) == 8192 & m) {
                      b = N - u | 0;
                      pf(Xa | 0, 32, (b >>> 0 > 256 ? 256 : b) | 0) | 0;
                      if (b >>> 0 > 255) {
                        o = b;
                        do {
                          cf(Xa, 256, a) | 0;
                          o = o + -256 | 0;
                        } while (o >>> 0 > 255);
                        b = b & 255;
                      }
                      cf(Xa, b, a) | 0;
                    }
                    n = m ? N : u;
                  }
 while (0);
                G = Ca;
                E = Ba;
                u = aa;
                b = O;
                continue a;
              }
            case 99:
              {
                i[Ga >> 0] = Ba;
                ga = Ca;
                ha = Ba;
                ja = Ga;
                g = s;
                ba = 1;
                ca = 0;
                da = 635356;
                fa = Aa;
                break;
              }
            case 109:
              {
                Ma = jc() | 0;
                Ma = pc(k[Ma >> 2] | 0) | 0;
                P = 94;
                break;
              }
            case 83:
              {
                b = Ba;
                if (!z) {
                  _ = Ba;
                  $ = b;
                  Z = 0;
                  P = 102;
                } else {
                  sa = b;
                  ta = Ba;
                  Wa = z;
                  P = 97;
                }
                break;
              }
            default:
              {
                ga = Ca;
                ha = Ba;
                ja = b;
                g = L;
                ba = z;
                ca = 0;
                da = 635356;
                fa = Aa;
              }
          }
 while (0);
        if ((P | 0) == 73) {
          h = ab & 32;
          if (!((Ba | 0) == 0 & (Ca | 0) == 0)) {
            m = Aa;
            n = Ba;
            b = Ca;
            do {
              m = m + -1 | 0;
              i[m >> 0] = l[635340 + (n & 15) >> 0] | h;
              n = uf(n | 0, b | 0, 4) | 0;
              b = M;
            } while (!((n | 0) == 0 & (b | 0) == 0));
            if (!(Ra & 8)) {
              U = Ba;
              V = Ca;
              h = m;
              Q = Ra;
              R = Va;
              S = 0;
              T = 635356;
              P = 89;
            } else {
              U = Ba;
              V = Ca;
              h = m;
              Q = Ra;
              R = Va;
              S = 2;
              T = 635356 + (ab >> 4) | 0;
              P = 89;
            }
          } else {
            U = Ba;
            V = Ca;
            h = Aa;
            Q = Ra;
            R = Va;
            S = 0;
            T = 635356;
            P = 89;
          }
        } else if ((P | 0) == 84) {
          if (Ea >>> 0 > 0 | (Ea | 0) == 0 & Fa >>> 0 > 4294967295) {
            h = Aa;
            b = Fa;
            n = Ea;
            while (1) {
              m = Ef(b | 0, n | 0, 10, 0) | 0;
              h = h + -1 | 0;
              i[h >> 0] = m | 48;
              m = Df(b | 0, n | 0, 10, 0) | 0;
              if (n >>> 0 > 9 | (n | 0) == 9 & b >>> 0 > 4294967295) {
                b = m;
                n = M;
              } else
                break;
            }
          } else {
            h = Aa;
            m = Fa;
          }
          if (!m) {
            U = Fa;
            V = Ea;
            Q = L;
            R = z;
            S = Ya;
            T = Za;
            P = 89;
          } else
            while (1) {
              h = h + -1 | 0;
              i[h >> 0] = (m >>> 0) % 10 | 0 | 48;
              if (m >>> 0 < 10) {
                U = Fa;
                V = Ea;
                Q = L;
                R = z;
                S = Ya;
                T = Za;
                P = 89;
                break;
              } else
                m = (m >>> 0) / 10 | 0;
            }
        } else if ((P | 0) == 94) {
          P = 0;
          fa = gf(Ma, 0, z) | 0;
          K = (fa | 0) == 0;
          ga = Ca;
          ha = Ba;
          ja = Ma;
          g = s;
          ba = K ? z : fa - Ma | 0;
          ca = 0;
          da = 635356;
          fa = K ? Ma + z | 0 : fa;
        } else if ((P | 0) == 97) {
          n = 0;
          b = 0;
          o = sa;
          while (1) {
            m = k[o >> 2] | 0;
            if (!m)
              break;
            b = _e(Ua, m) | 0;
            if ((b | 0) < 0 | b >>> 0 > (Wa - n | 0) >>> 0)
              break;
            n = b + n | 0;
            if (Wa >>> 0 > n >>> 0)
              o = o + 4 | 0;
            else
              break;
          }
          if ((b | 0) < 0) {
            db = -1;
            P = 363;
            break;
          } else {
            _ = ta;
            $ = sa;
            Z = n;
            P = 102;
          }
        }
        if ((P | 0) == 89) {
          P = 0;
          g = (R | 0) > -1 ? Q & -65537 : Q;
          m = (U | 0) != 0 | (V | 0) != 0;
          if (m | (R | 0) != 0) {
            ba = (m & 1 ^ 1) + (Da - h) | 0;
            ga = V;
            ha = U;
            ja = h;
            ba = (R | 0) > (ba | 0) ? R : ba;
            ca = S;
            da = T;
            fa = Aa;
          } else {
            ga = V;
            ha = U;
            ja = Aa;
            ba = 0;
            ca = S;
            da = T;
            fa = Aa;
          }
        } else if ((P | 0) == 102) {
          P = 0;
          s = L & 73728;
          x = (N | 0) > (Z | 0);
          if ((s | 0) == 0 & x) {
            b = N - Z | 0;
            pf(Xa | 0, 32, (b >>> 0 > 256 ? 256 : b) | 0) | 0;
            if (b >>> 0 > 255) {
              o = b;
              do {
                cf(Xa, 256, a) | 0;
                o = o + -256 | 0;
              } while (o >>> 0 > 255);
              b = b & 255;
            }
            cf(Xa, b, a) | 0;
          }
          i: do
            if (Z) {
              b = 0;
              n = $;
              while (1) {
                o = k[n >> 2] | 0;
                if (!o)
                  break i;
                o = _e(Ua, o) | 0;
                b = o + b | 0;
                if ((b | 0) > (Z | 0))
                  break i;
                cf(Ua, o, a) | 0;
                if (b >>> 0 >= Z >>> 0)
                  break;
                else
                  n = n + 4 | 0;
              }
            }
 while (0);
          if ((s | 0) == 8192 & x) {
            b = N - Z | 0;
            pf(Xa | 0, 32, (b >>> 0 > 256 ? 256 : b) | 0) | 0;
            if (b >>> 0 > 255) {
              n = b;
              do {
                cf(Xa, 256, a) | 0;
                n = n + -256 | 0;
              } while (n >>> 0 > 255);
              b = b & 255;
            }
            cf(Xa, b, a) | 0;
          }
          G = Ca;
          E = _;
          u = aa;
          b = O;
          n = x ? N : Z;
          continue;
        }
        w = fa - ja | 0;
        u = (ba | 0) < (w | 0) ? w : ba;
        m = ca + u | 0;
        x = (N | 0) < (m | 0) ? m : N;
        s = g & 73728;
        n = (x | 0) > (m | 0);
        if ((s | 0) == 0 & n) {
          o = x - m | 0;
          pf(Xa | 0, 32, (o >>> 0 > 256 ? 256 : o) | 0) | 0;
          if (o >>> 0 > 255) {
            b = o;
            do {
              cf(Xa, 256, a) | 0;
              b = b + -256 | 0;
            } while (b >>> 0 > 255);
            o = o & 255;
          }
          cf(Xa, o, a) | 0;
        }
        cf(da, ca, a) | 0;
        if ((s | 0) == 65536 & n) {
          o = x - m | 0;
          pf(Xa | 0, 48, (o >>> 0 > 256 ? 256 : o) | 0) | 0;
          if (o >>> 0 > 255) {
            b = o;
            do {
              cf(Xa, 256, a) | 0;
              b = b + -256 | 0;
            } while (b >>> 0 > 255);
            o = o & 255;
          }
          cf(Xa, o, a) | 0;
        }
        if ((u | 0) > (w | 0)) {
          o = u - w | 0;
          pf(Xa | 0, 48, (o >>> 0 > 256 ? 256 : o) | 0) | 0;
          if (o >>> 0 > 255) {
            b = o;
            do {
              cf(Xa, 256, a) | 0;
              b = b + -256 | 0;
            } while (b >>> 0 > 255);
            o = o & 255;
          }
          cf(Xa, o, a) | 0;
        }
        cf(ja, w, a) | 0;
        if ((s | 0) == 8192 & n) {
          b = x - m | 0;
          pf(Xa | 0, 32, (b >>> 0 > 256 ? 256 : b) | 0) | 0;
          if (b >>> 0 > 255) {
            n = b;
            do {
              cf(Xa, 256, a) | 0;
              n = n + -256 | 0;
            } while (n >>> 0 > 255);
            b = b & 255;
          }
          cf(Xa, b, a) | 0;
        }
        G = ga;
        E = ha;
        u = aa;
        b = O;
        n = x;
      }
      if ((P | 0) == 344) {
        if (a) {
          e = Pa;
          r = eb;
          return e | 0;
        }
        if (!Ta) {
          e = 0;
          r = eb;
          return e | 0;
        } else
          m = 1;
        while (1) {
          g = k[e + (m << 2) >> 2] | 0;
          if (!g) {
            f = m;
            break;
          }
          h = d + (m << 3) | 0;
          j: do
            if (g >>> 0 <= 20)
              do
                switch (g | 0) {
                  case 9:
                    {
                      $a = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
                      ab = k[$a >> 2] | 0;
                      k[c >> 2] = $a + 4;
                      k[h >> 2] = ab;
                      break j;
                    }
                  case 10:
                    {
                      ab = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
                      $a = k[ab >> 2] | 0;
                      k[c >> 2] = ab + 4;
                      ab = h;
                      k[ab >> 2] = $a;
                      k[ab + 4 >> 2] = (($a | 0) < 0) << 31 >> 31;
                      break j;
                    }
                  case 11:
                    {
                      ab = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
                      $a = k[ab >> 2] | 0;
                      k[c >> 2] = ab + 4;
                      ab = h;
                      k[ab >> 2] = $a;
                      k[ab + 4 >> 2] = 0;
                      break j;
                    }
                  case 12:
                    {
                      ab = (k[c >> 2] | 0) + (8 - 1) & ~(8 - 1);
                      $a = ab;
                      _a = k[$a >> 2] | 0;
                      $a = k[$a + 4 >> 2] | 0;
                      k[c >> 2] = ab + 8;
                      ab = h;
                      k[ab >> 2] = _a;
                      k[ab + 4 >> 2] = $a;
                      break j;
                    }
                  case 13:
                    {
                      ab = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
                      $a = k[ab >> 2] | 0;
                      k[c >> 2] = ab + 4;
                      $a = ($a & 65535) << 16 >> 16;
                      ab = h;
                      k[ab >> 2] = $a;
                      k[ab + 4 >> 2] = (($a | 0) < 0) << 31 >> 31;
                      break j;
                    }
                  case 14:
                    {
                      ab = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
                      $a = k[ab >> 2] | 0;
                      k[c >> 2] = ab + 4;
                      ab = h;
                      k[ab >> 2] = $a & 65535;
                      k[ab + 4 >> 2] = 0;
                      break j;
                    }
                  case 15:
                    {
                      ab = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
                      $a = k[ab >> 2] | 0;
                      k[c >> 2] = ab + 4;
                      $a = ($a & 255) << 24 >> 24;
                      ab = h;
                      k[ab >> 2] = $a;
                      k[ab + 4 >> 2] = (($a | 0) < 0) << 31 >> 31;
                      break j;
                    }
                  case 16:
                    {
                      ab = (k[c >> 2] | 0) + (4 - 1) & ~(4 - 1);
                      $a = k[ab >> 2] | 0;
                      k[c >> 2] = ab + 4;
                      ab = h;
                      k[ab >> 2] = $a & 255;
                      k[ab + 4 >> 2] = 0;
                      break j;
                    }
                  case 17:
                    {
                      ab = (k[c >> 2] | 0) + (8 - 1) & ~(8 - 1);
                      y = +p[ab >> 3];
                      k[c >> 2] = ab + 8;
                      p[h >> 3] = y;
                      break j;
                    }
                  case 18:
                    {
                      ab = (k[c >> 2] | 0) + (8 - 1) & ~(8 - 1);
                      y = +p[ab >> 3];
                      k[c >> 2] = ab + 8;
                      p[h >> 3] = y;
                      break j;
                    }
                  default:
                    break j;
                }
 while (0);
 while (0);
          m = m + 1 | 0;
          if ((m | 0) >= 10) {
            db = 1;
            P = 363;
            break;
          }
        }
        if ((P | 0) == 363) {
          r = eb;
          return db | 0;
        }
        if ((f | 0) >= 10) {
          e = 1;
          r = eb;
          return e | 0;
        }
        while (1) {
          if (k[e + (f << 2) >> 2] | 0) {
            db = -1;
            P = 363;
            break;
          }
          f = f + 1 | 0;
          if ((f | 0) >= 10) {
            db = 1;
            P = 363;
            break;
          }
        }
        if ((P | 0) == 363) {
          r = eb;
          return db | 0;
        }
      } else if ((P | 0) == 363) {
        r = eb;
        return db | 0;
      }
      return 0;
    }
    function kf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
          e = 0;
      d = a + 20 | 0;
      e = k[d >> 2] | 0;
      a = (k[a + 16 >> 2] | 0) - e | 0;
      a = a >>> 0 > c >>> 0 ? c : a;
      vf(e | 0, b | 0, a | 0) | 0;
      k[d >> 2] = (k[d >> 2] | 0) + a;
      return c | 0;
    }
    function lf(a) {
      a = a | 0;
      var b = 0,
          c = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0,
          l = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          r = 0,
          s = 0,
          t = 0,
          u = 0,
          v = 0,
          w = 0,
          x = 0,
          y = 0,
          z = 0,
          A = 0,
          B = 0,
          C = 0,
          D = 0,
          E = 0,
          F = 0,
          G = 0,
          H = 0,
          I = 0,
          J = 0,
          K = 0,
          L = 0,
          M = 0,
          N = 0;
      do
        if (a >>> 0 < 245) {
          q = a >>> 0 < 11 ? 16 : a + 11 & -8;
          a = q >>> 3;
          l = k[1477] | 0;
          i = l >>> a;
          if (i & 3) {
            d = (i & 1 ^ 1) + a | 0;
            e = d << 1;
            b = 5948 + (e << 2) | 0;
            e = 5948 + (e + 2 << 2) | 0;
            f = k[e >> 2] | 0;
            g = f + 8 | 0;
            h = k[g >> 2] | 0;
            do
              if ((b | 0) != (h | 0)) {
                if (h >>> 0 < (k[1481] | 0) >>> 0)
                  Ob();
                c = h + 12 | 0;
                if ((k[c >> 2] | 0) == (f | 0)) {
                  k[c >> 2] = b;
                  k[e >> 2] = h;
                  break;
                } else
                  Ob();
              } else
                k[1477] = l & ~(1 << d);
 while (0);
            N = d << 3;
            k[f + 4 >> 2] = N | 3;
            N = f + (N | 4) | 0;
            k[N >> 2] = k[N >> 2] | 1;
            N = g;
            return N | 0;
          }
          b = k[1479] | 0;
          if (q >>> 0 > b >>> 0) {
            if (i) {
              e = 2 << a;
              e = i << a & (e | 0 - e);
              e = (e & 0 - e) + -1 | 0;
              a = e >>> 12 & 16;
              e = e >>> a;
              d = e >>> 5 & 8;
              e = e >>> d;
              c = e >>> 2 & 4;
              e = e >>> c;
              f = e >>> 1 & 2;
              e = e >>> f;
              g = e >>> 1 & 1;
              g = (d | a | c | f | g) + (e >>> g) | 0;
              e = g << 1;
              f = 5948 + (e << 2) | 0;
              e = 5948 + (e + 2 << 2) | 0;
              c = k[e >> 2] | 0;
              a = c + 8 | 0;
              d = k[a >> 2] | 0;
              do
                if ((f | 0) != (d | 0)) {
                  if (d >>> 0 < (k[1481] | 0) >>> 0)
                    Ob();
                  h = d + 12 | 0;
                  if ((k[h >> 2] | 0) == (c | 0)) {
                    k[h >> 2] = f;
                    k[e >> 2] = d;
                    j = k[1479] | 0;
                    break;
                  } else
                    Ob();
                } else {
                  k[1477] = l & ~(1 << g);
                  j = b;
                }
 while (0);
              N = g << 3;
              b = N - q | 0;
              k[c + 4 >> 2] = q | 3;
              i = c + q | 0;
              k[c + (q | 4) >> 2] = b | 1;
              k[c + N >> 2] = b;
              if (j) {
                d = k[1482] | 0;
                f = j >>> 3;
                h = f << 1;
                e = 5948 + (h << 2) | 0;
                g = k[1477] | 0;
                f = 1 << f;
                if (g & f) {
                  g = 5948 + (h + 2 << 2) | 0;
                  h = k[g >> 2] | 0;
                  if (h >>> 0 < (k[1481] | 0) >>> 0)
                    Ob();
                  else {
                    m = g;
                    n = h;
                  }
                } else {
                  k[1477] = g | f;
                  m = 5948 + (h + 2 << 2) | 0;
                  n = e;
                }
                k[m >> 2] = d;
                k[n + 12 >> 2] = d;
                k[d + 8 >> 2] = n;
                k[d + 12 >> 2] = e;
              }
              k[1479] = b;
              k[1482] = i;
              N = a;
              return N | 0;
            }
            a = k[1478] | 0;
            if (a) {
              g = (a & 0 - a) + -1 | 0;
              M = g >>> 12 & 16;
              g = g >>> M;
              L = g >>> 5 & 8;
              g = g >>> L;
              N = g >>> 2 & 4;
              g = g >>> N;
              h = g >>> 1 & 2;
              g = g >>> h;
              f = g >>> 1 & 1;
              f = k[6212 + ((L | M | N | h | f) + (g >>> f) << 2) >> 2] | 0;
              g = (k[f + 4 >> 2] & -8) - q | 0;
              h = f;
              while (1) {
                c = k[h + 16 >> 2] | 0;
                if (!c) {
                  c = k[h + 20 >> 2] | 0;
                  if (!c) {
                    l = g;
                    j = f;
                    break;
                  }
                }
                h = (k[c + 4 >> 2] & -8) - q | 0;
                N = h >>> 0 < g >>> 0;
                g = N ? h : g;
                h = c;
                f = N ? c : f;
              }
              a = k[1481] | 0;
              if (j >>> 0 < a >>> 0)
                Ob();
              b = j + q | 0;
              if (j >>> 0 >= b >>> 0)
                Ob();
              i = k[j + 24 >> 2] | 0;
              f = k[j + 12 >> 2] | 0;
              do
                if ((f | 0) == (j | 0)) {
                  g = j + 20 | 0;
                  h = k[g >> 2] | 0;
                  if (!h) {
                    g = j + 16 | 0;
                    h = k[g >> 2] | 0;
                    if (!h) {
                      d = 0;
                      break;
                    }
                  }
                  while (1) {
                    f = h + 20 | 0;
                    e = k[f >> 2] | 0;
                    if (e) {
                      h = e;
                      g = f;
                      continue;
                    }
                    f = h + 16 | 0;
                    e = k[f >> 2] | 0;
                    if (!e)
                      break;
                    else {
                      h = e;
                      g = f;
                    }
                  }
                  if (g >>> 0 < a >>> 0)
                    Ob();
                  else {
                    k[g >> 2] = 0;
                    d = h;
                    break;
                  }
                } else {
                  e = k[j + 8 >> 2] | 0;
                  if (e >>> 0 < a >>> 0)
                    Ob();
                  h = e + 12 | 0;
                  if ((k[h >> 2] | 0) != (j | 0))
                    Ob();
                  g = f + 8 | 0;
                  if ((k[g >> 2] | 0) == (j | 0)) {
                    k[h >> 2] = f;
                    k[g >> 2] = e;
                    d = f;
                    break;
                  } else
                    Ob();
                }
 while (0);
              do
                if (i) {
                  h = k[j + 28 >> 2] | 0;
                  g = 6212 + (h << 2) | 0;
                  if ((j | 0) == (k[g >> 2] | 0)) {
                    k[g >> 2] = d;
                    if (!d) {
                      k[1478] = k[1478] & ~(1 << h);
                      break;
                    }
                  } else {
                    if (i >>> 0 < (k[1481] | 0) >>> 0)
                      Ob();
                    h = i + 16 | 0;
                    if ((k[h >> 2] | 0) == (j | 0))
                      k[h >> 2] = d;
                    else
                      k[i + 20 >> 2] = d;
                    if (!d)
                      break;
                  }
                  g = k[1481] | 0;
                  if (d >>> 0 < g >>> 0)
                    Ob();
                  k[d + 24 >> 2] = i;
                  h = k[j + 16 >> 2] | 0;
                  do
                    if (h)
                      if (h >>> 0 < g >>> 0)
                        Ob();
                      else {
                        k[d + 16 >> 2] = h;
                        k[h + 24 >> 2] = d;
                        break;
                      }
 while (0);
                  h = k[j + 20 >> 2] | 0;
                  if (h)
                    if (h >>> 0 < (k[1481] | 0) >>> 0)
                      Ob();
                    else {
                      k[d + 20 >> 2] = h;
                      k[h + 24 >> 2] = d;
                      break;
                    }
                }
 while (0);
              if (l >>> 0 < 16) {
                N = l + q | 0;
                k[j + 4 >> 2] = N | 3;
                N = j + (N + 4) | 0;
                k[N >> 2] = k[N >> 2] | 1;
              } else {
                k[j + 4 >> 2] = q | 3;
                k[j + (q | 4) >> 2] = l | 1;
                k[j + (l + q) >> 2] = l;
                c = k[1479] | 0;
                if (c) {
                  d = k[1482] | 0;
                  f = c >>> 3;
                  h = f << 1;
                  e = 5948 + (h << 2) | 0;
                  g = k[1477] | 0;
                  f = 1 << f;
                  if (g & f) {
                    h = 5948 + (h + 2 << 2) | 0;
                    g = k[h >> 2] | 0;
                    if (g >>> 0 < (k[1481] | 0) >>> 0)
                      Ob();
                    else {
                      p = h;
                      o = g;
                    }
                  } else {
                    k[1477] = g | f;
                    p = 5948 + (h + 2 << 2) | 0;
                    o = e;
                  }
                  k[p >> 2] = d;
                  k[o + 12 >> 2] = d;
                  k[d + 8 >> 2] = o;
                  k[d + 12 >> 2] = e;
                }
                k[1479] = l;
                k[1482] = b;
              }
              N = j + 8 | 0;
              return N | 0;
            } else
              z = q;
          } else
            z = q;
        } else if (a >>> 0 <= 4294967231) {
          a = a + 11 | 0;
          p = a & -8;
          j = k[1478] | 0;
          if (j) {
            i = 0 - p | 0;
            a = a >>> 8;
            if (a)
              if (p >>> 0 > 16777215)
                l = 31;
              else {
                q = (a + 1048320 | 0) >>> 16 & 8;
                w = a << q;
                o = (w + 520192 | 0) >>> 16 & 4;
                w = w << o;
                l = (w + 245760 | 0) >>> 16 & 2;
                l = 14 - (o | q | l) + (w << l >>> 15) | 0;
                l = p >>> (l + 7 | 0) & 1 | l << 1;
              }
            else
              l = 0;
            a = k[6212 + (l << 2) >> 2] | 0;
            a: do
              if (!a) {
                g = 0;
                a = 0;
                w = 86;
              } else {
                d = i;
                g = 0;
                c = p << ((l | 0) == 31 ? 0 : 25 - (l >>> 1) | 0);
                b = a;
                a = 0;
                while (1) {
                  f = k[b + 4 >> 2] & -8;
                  i = f - p | 0;
                  if (i >>> 0 < d >>> 0)
                    if ((f | 0) == (p | 0)) {
                      f = b;
                      a = b;
                      w = 90;
                      break a;
                    } else
                      a = b;
                  else
                    i = d;
                  w = k[b + 20 >> 2] | 0;
                  b = k[b + 16 + (c >>> 31 << 2) >> 2] | 0;
                  g = (w | 0) == 0 | (w | 0) == (b | 0) ? g : w;
                  if (!b) {
                    w = 86;
                    break;
                  } else {
                    d = i;
                    c = c << 1;
                  }
                }
              }
 while (0);
            if ((w | 0) == 86) {
              if ((g | 0) == 0 & (a | 0) == 0) {
                a = 2 << l;
                a = j & (a | 0 - a);
                if (!a) {
                  z = p;
                  break;
                }
                a = (a & 0 - a) + -1 | 0;
                n = a >>> 12 & 16;
                a = a >>> n;
                m = a >>> 5 & 8;
                a = a >>> m;
                o = a >>> 2 & 4;
                a = a >>> o;
                q = a >>> 1 & 2;
                a = a >>> q;
                g = a >>> 1 & 1;
                g = k[6212 + ((m | n | o | q | g) + (a >>> g) << 2) >> 2] | 0;
                a = 0;
              }
              if (!g) {
                n = i;
                q = a;
              } else {
                f = g;
                w = 90;
              }
            }
            if ((w | 0) == 90)
              while (1) {
                w = 0;
                q = (k[f + 4 >> 2] & -8) - p | 0;
                g = q >>> 0 < i >>> 0;
                i = g ? q : i;
                a = g ? f : a;
                g = k[f + 16 >> 2] | 0;
                if (g) {
                  f = g;
                  w = 90;
                  continue;
                }
                f = k[f + 20 >> 2] | 0;
                if (!f) {
                  n = i;
                  q = a;
                  break;
                } else
                  w = 90;
              }
            if ((q | 0) != 0 ? n >>> 0 < ((k[1479] | 0) - p | 0) >>> 0 : 0) {
              a = k[1481] | 0;
              if (q >>> 0 < a >>> 0)
                Ob();
              m = q + p | 0;
              if (q >>> 0 >= m >>> 0)
                Ob();
              i = k[q + 24 >> 2] | 0;
              f = k[q + 12 >> 2] | 0;
              do
                if ((f | 0) == (q | 0)) {
                  g = q + 20 | 0;
                  h = k[g >> 2] | 0;
                  if (!h) {
                    g = q + 16 | 0;
                    h = k[g >> 2] | 0;
                    if (!h) {
                      s = 0;
                      break;
                    }
                  }
                  while (1) {
                    f = h + 20 | 0;
                    e = k[f >> 2] | 0;
                    if (e) {
                      h = e;
                      g = f;
                      continue;
                    }
                    f = h + 16 | 0;
                    e = k[f >> 2] | 0;
                    if (!e)
                      break;
                    else {
                      h = e;
                      g = f;
                    }
                  }
                  if (g >>> 0 < a >>> 0)
                    Ob();
                  else {
                    k[g >> 2] = 0;
                    s = h;
                    break;
                  }
                } else {
                  e = k[q + 8 >> 2] | 0;
                  if (e >>> 0 < a >>> 0)
                    Ob();
                  h = e + 12 | 0;
                  if ((k[h >> 2] | 0) != (q | 0))
                    Ob();
                  g = f + 8 | 0;
                  if ((k[g >> 2] | 0) == (q | 0)) {
                    k[h >> 2] = f;
                    k[g >> 2] = e;
                    s = f;
                    break;
                  } else
                    Ob();
                }
 while (0);
              do
                if (i) {
                  h = k[q + 28 >> 2] | 0;
                  g = 6212 + (h << 2) | 0;
                  if ((q | 0) == (k[g >> 2] | 0)) {
                    k[g >> 2] = s;
                    if (!s) {
                      k[1478] = k[1478] & ~(1 << h);
                      break;
                    }
                  } else {
                    if (i >>> 0 < (k[1481] | 0) >>> 0)
                      Ob();
                    h = i + 16 | 0;
                    if ((k[h >> 2] | 0) == (q | 0))
                      k[h >> 2] = s;
                    else
                      k[i + 20 >> 2] = s;
                    if (!s)
                      break;
                  }
                  g = k[1481] | 0;
                  if (s >>> 0 < g >>> 0)
                    Ob();
                  k[s + 24 >> 2] = i;
                  h = k[q + 16 >> 2] | 0;
                  do
                    if (h)
                      if (h >>> 0 < g >>> 0)
                        Ob();
                      else {
                        k[s + 16 >> 2] = h;
                        k[h + 24 >> 2] = s;
                        break;
                      }
 while (0);
                  h = k[q + 20 >> 2] | 0;
                  if (h)
                    if (h >>> 0 < (k[1481] | 0) >>> 0)
                      Ob();
                    else {
                      k[s + 20 >> 2] = h;
                      k[h + 24 >> 2] = s;
                      break;
                    }
                }
 while (0);
              b: do
                if (n >>> 0 >= 16) {
                  k[q + 4 >> 2] = p | 3;
                  k[q + (p | 4) >> 2] = n | 1;
                  k[q + (n + p) >> 2] = n;
                  h = n >>> 3;
                  if (n >>> 0 < 256) {
                    g = h << 1;
                    e = 5948 + (g << 2) | 0;
                    f = k[1477] | 0;
                    h = 1 << h;
                    if (f & h) {
                      h = 5948 + (g + 2 << 2) | 0;
                      g = k[h >> 2] | 0;
                      if (g >>> 0 < (k[1481] | 0) >>> 0)
                        Ob();
                      else {
                        t = h;
                        u = g;
                      }
                    } else {
                      k[1477] = f | h;
                      t = 5948 + (g + 2 << 2) | 0;
                      u = e;
                    }
                    k[t >> 2] = m;
                    k[u + 12 >> 2] = m;
                    k[q + (p + 8) >> 2] = u;
                    k[q + (p + 12) >> 2] = e;
                    break;
                  }
                  c = n >>> 8;
                  if (c)
                    if (n >>> 0 > 16777215)
                      e = 31;
                    else {
                      M = (c + 1048320 | 0) >>> 16 & 8;
                      N = c << M;
                      L = (N + 520192 | 0) >>> 16 & 4;
                      N = N << L;
                      e = (N + 245760 | 0) >>> 16 & 2;
                      e = 14 - (L | M | e) + (N << e >>> 15) | 0;
                      e = n >>> (e + 7 | 0) & 1 | e << 1;
                    }
                  else
                    e = 0;
                  h = 6212 + (e << 2) | 0;
                  k[q + (p + 28) >> 2] = e;
                  k[q + (p + 20) >> 2] = 0;
                  k[q + (p + 16) >> 2] = 0;
                  g = k[1478] | 0;
                  f = 1 << e;
                  if (!(g & f)) {
                    k[1478] = g | f;
                    k[h >> 2] = m;
                    k[q + (p + 24) >> 2] = h;
                    k[q + (p + 12) >> 2] = m;
                    k[q + (p + 8) >> 2] = m;
                    break;
                  }
                  c = k[h >> 2] | 0;
                  c: do
                    if ((k[c + 4 >> 2] & -8 | 0) != (n | 0)) {
                      g = n << ((e | 0) == 31 ? 0 : 25 - (e >>> 1) | 0);
                      while (1) {
                        b = c + 16 + (g >>> 31 << 2) | 0;
                        h = k[b >> 2] | 0;
                        if (!h)
                          break;
                        if ((k[h + 4 >> 2] & -8 | 0) == (n | 0)) {
                          z = h;
                          break c;
                        } else {
                          g = g << 1;
                          c = h;
                        }
                      }
                      if (b >>> 0 < (k[1481] | 0) >>> 0)
                        Ob();
                      else {
                        k[b >> 2] = m;
                        k[q + (p + 24) >> 2] = c;
                        k[q + (p + 12) >> 2] = m;
                        k[q + (p + 8) >> 2] = m;
                        break b;
                      }
                    } else
                      z = c;
 while (0);
                  c = z + 8 | 0;
                  b = k[c >> 2] | 0;
                  N = k[1481] | 0;
                  if (b >>> 0 >= N >>> 0 & z >>> 0 >= N >>> 0) {
                    k[b + 12 >> 2] = m;
                    k[c >> 2] = m;
                    k[q + (p + 8) >> 2] = b;
                    k[q + (p + 12) >> 2] = z;
                    k[q + (p + 24) >> 2] = 0;
                    break;
                  } else
                    Ob();
                } else {
                  N = n + p | 0;
                  k[q + 4 >> 2] = N | 3;
                  N = q + (N + 4) | 0;
                  k[N >> 2] = k[N >> 2] | 1;
                }
 while (0);
              N = q + 8 | 0;
              return N | 0;
            } else
              z = p;
          } else
            z = p;
        } else
          z = -1;
 while (0);
      a = k[1479] | 0;
      if (a >>> 0 >= z >>> 0) {
        b = a - z | 0;
        c = k[1482] | 0;
        if (b >>> 0 > 15) {
          k[1482] = c + z;
          k[1479] = b;
          k[c + (z + 4) >> 2] = b | 1;
          k[c + a >> 2] = b;
          k[c + 4 >> 2] = z | 3;
        } else {
          k[1479] = 0;
          k[1482] = 0;
          k[c + 4 >> 2] = a | 3;
          N = c + (a + 4) | 0;
          k[N >> 2] = k[N >> 2] | 1;
        }
        N = c + 8 | 0;
        return N | 0;
      }
      a = k[1480] | 0;
      if (a >>> 0 > z >>> 0) {
        M = a - z | 0;
        k[1480] = M;
        N = k[1483] | 0;
        k[1483] = N + z;
        k[N + (z + 4) >> 2] = M | 1;
        k[N + 4 >> 2] = z | 3;
        N = N + 8 | 0;
        return N | 0;
      }
      do
        if (!(k[1595] | 0)) {
          a = Ua(30) | 0;
          if (!(a + -1 & a)) {
            k[1597] = a;
            k[1596] = a;
            k[1598] = -1;
            k[1599] = -1;
            k[1600] = 0;
            k[1588] = 0;
            u = (qb(0) | 0) & -16 ^ 1431655768;
            k[1595] = u;
            break;
          } else
            Ob();
        }
 while (0);
      l = z + 48 | 0;
      c = k[1597] | 0;
      j = z + 47 | 0;
      d = c + j | 0;
      c = 0 - c | 0;
      m = d & c;
      if (m >>> 0 <= z >>> 0) {
        N = 0;
        return N | 0;
      }
      a = k[1587] | 0;
      if ((a | 0) != 0 ? (t = k[1585] | 0, u = t + m | 0, u >>> 0 <= t >>> 0 | u >>> 0 > a >>> 0) : 0) {
        N = 0;
        return N | 0;
      }
      d: do
        if (!(k[1588] & 4)) {
          a = k[1483] | 0;
          e: do
            if (a) {
              g = 6356;
              while (1) {
                i = k[g >> 2] | 0;
                if (i >>> 0 <= a >>> 0 ? (r = g + 4 | 0, (i + (k[r >> 2] | 0) | 0) >>> 0 > a >>> 0) : 0) {
                  f = g;
                  a = r;
                  break;
                }
                g = k[g + 8 >> 2] | 0;
                if (!g) {
                  w = 174;
                  break e;
                }
              }
              i = d - (k[1480] | 0) & c;
              if (i >>> 0 < 2147483647) {
                g = Sa(i | 0) | 0;
                u = (g | 0) == ((k[f >> 2] | 0) + (k[a >> 2] | 0) | 0);
                a = u ? i : 0;
                if (u) {
                  if ((g | 0) != (-1 | 0)) {
                    x = g;
                    w = 194;
                    break d;
                  }
                } else
                  w = 184;
              } else
                a = 0;
            } else
              w = 174;
 while (0);
          do
            if ((w | 0) == 174) {
              f = Sa(0) | 0;
              if ((f | 0) != (-1 | 0)) {
                a = f;
                i = k[1596] | 0;
                g = i + -1 | 0;
                if (!(g & a))
                  i = m;
                else
                  i = m - a + (g + a & 0 - i) | 0;
                a = k[1585] | 0;
                g = a + i | 0;
                if (i >>> 0 > z >>> 0 & i >>> 0 < 2147483647) {
                  u = k[1587] | 0;
                  if ((u | 0) != 0 ? g >>> 0 <= a >>> 0 | g >>> 0 > u >>> 0 : 0) {
                    a = 0;
                    break;
                  }
                  g = Sa(i | 0) | 0;
                  w = (g | 0) == (f | 0);
                  a = w ? i : 0;
                  if (w) {
                    x = f;
                    w = 194;
                    break d;
                  } else
                    w = 184;
                } else
                  a = 0;
              } else
                a = 0;
            }
 while (0);
          f: do
            if ((w | 0) == 184) {
              f = 0 - i | 0;
              do
                if (l >>> 0 > i >>> 0 & (i >>> 0 < 2147483647 & (g | 0) != (-1 | 0)) ? (v = k[1597] | 0, v = j - i + v & 0 - v, v >>> 0 < 2147483647) : 0)
                  if ((Sa(v | 0) | 0) == (-1 | 0)) {
                    Sa(f | 0) | 0;
                    break f;
                  } else {
                    i = v + i | 0;
                    break;
                  }
 while (0);
              if ((g | 0) != (-1 | 0)) {
                x = g;
                a = i;
                w = 194;
                break d;
              }
            }
 while (0);
          k[1588] = k[1588] | 4;
          w = 191;
        } else {
          a = 0;
          w = 191;
        }
 while (0);
      if ((((w | 0) == 191 ? m >>> 0 < 2147483647 : 0) ? (x = Sa(m | 0) | 0, y = Sa(0) | 0, x >>> 0 < y >>> 0 & ((x | 0) != (-1 | 0) & (y | 0) != (-1 | 0))) : 0) ? (A = y - x | 0, B = A >>> 0 > (z + 40 | 0) >>> 0, B) : 0) {
        a = B ? A : a;
        w = 194;
      }
      if ((w | 0) == 194) {
        i = (k[1585] | 0) + a | 0;
        k[1585] = i;
        if (i >>> 0 > (k[1586] | 0) >>> 0)
          k[1586] = i;
        n = k[1483] | 0;
        g: do
          if (n) {
            d = 6356;
            do {
              i = k[d >> 2] | 0;
              g = d + 4 | 0;
              f = k[g >> 2] | 0;
              if ((x | 0) == (i + f | 0)) {
                C = i;
                D = g;
                E = f;
                F = d;
                w = 204;
                break;
              }
              d = k[d + 8 >> 2] | 0;
            } while ((d | 0) != 0);
            if (((w | 0) == 204 ? (k[F + 12 >> 2] & 8 | 0) == 0 : 0) ? n >>> 0 < x >>> 0 & n >>> 0 >= C >>> 0 : 0) {
              k[D >> 2] = E + a;
              N = (k[1480] | 0) + a | 0;
              M = n + 8 | 0;
              M = (M & 7 | 0) == 0 ? 0 : 0 - M & 7;
              L = N - M | 0;
              k[1483] = n + M;
              k[1480] = L;
              k[n + (M + 4) >> 2] = L | 1;
              k[n + (N + 4) >> 2] = 40;
              k[1484] = k[1599];
              break;
            }
            i = k[1481] | 0;
            if (x >>> 0 < i >>> 0) {
              k[1481] = x;
              i = x;
            }
            g = x + a | 0;
            d = 6356;
            while (1) {
              if ((k[d >> 2] | 0) == (g | 0)) {
                f = d;
                g = d;
                w = 212;
                break;
              }
              d = k[d + 8 >> 2] | 0;
              if (!d) {
                f = 6356;
                break;
              }
            }
            if ((w | 0) == 212)
              if (!(k[g + 12 >> 2] & 8)) {
                k[f >> 2] = x;
                p = g + 4 | 0;
                k[p >> 2] = (k[p >> 2] | 0) + a;
                p = x + 8 | 0;
                p = (p & 7 | 0) == 0 ? 0 : 0 - p & 7;
                b = x + (a + 8) | 0;
                b = (b & 7 | 0) == 0 ? 0 : 0 - b & 7;
                h = x + (b + a) | 0;
                o = p + z | 0;
                q = x + o | 0;
                m = h - (x + p) - z | 0;
                k[x + (p + 4) >> 2] = z | 3;
                h: do
                  if ((h | 0) != (n | 0)) {
                    if ((h | 0) == (k[1482] | 0)) {
                      N = (k[1479] | 0) + m | 0;
                      k[1479] = N;
                      k[1482] = q;
                      k[x + (o + 4) >> 2] = N | 1;
                      k[x + (N + o) >> 2] = N;
                      break;
                    }
                    l = a + 4 | 0;
                    g = k[x + (l + b) >> 2] | 0;
                    if ((g & 3 | 0) == 1) {
                      j = g & -8;
                      d = g >>> 3;
                      i: do
                        if (g >>> 0 >= 256) {
                          c = k[x + ((b | 24) + a) >> 2] | 0;
                          f = k[x + (a + 12 + b) >> 2] | 0;
                          do
                            if ((f | 0) == (h | 0)) {
                              e = b | 16;
                              f = x + (l + e) | 0;
                              g = k[f >> 2] | 0;
                              if (!g) {
                                f = x + (e + a) | 0;
                                g = k[f >> 2] | 0;
                                if (!g) {
                                  K = 0;
                                  break;
                                }
                              }
                              while (1) {
                                e = g + 20 | 0;
                                d = k[e >> 2] | 0;
                                if (d) {
                                  g = d;
                                  f = e;
                                  continue;
                                }
                                e = g + 16 | 0;
                                d = k[e >> 2] | 0;
                                if (!d)
                                  break;
                                else {
                                  g = d;
                                  f = e;
                                }
                              }
                              if (f >>> 0 < i >>> 0)
                                Ob();
                              else {
                                k[f >> 2] = 0;
                                K = g;
                                break;
                              }
                            } else {
                              e = k[x + ((b | 8) + a) >> 2] | 0;
                              if (e >>> 0 < i >>> 0)
                                Ob();
                              i = e + 12 | 0;
                              if ((k[i >> 2] | 0) != (h | 0))
                                Ob();
                              g = f + 8 | 0;
                              if ((k[g >> 2] | 0) == (h | 0)) {
                                k[i >> 2] = f;
                                k[g >> 2] = e;
                                K = f;
                                break;
                              } else
                                Ob();
                            }
 while (0);
                          if (!c)
                            break;
                          i = k[x + (a + 28 + b) >> 2] | 0;
                          g = 6212 + (i << 2) | 0;
                          do
                            if ((h | 0) != (k[g >> 2] | 0)) {
                              if (c >>> 0 < (k[1481] | 0) >>> 0)
                                Ob();
                              i = c + 16 | 0;
                              if ((k[i >> 2] | 0) == (h | 0))
                                k[i >> 2] = K;
                              else
                                k[c + 20 >> 2] = K;
                              if (!K)
                                break i;
                            } else {
                              k[g >> 2] = K;
                              if (K)
                                break;
                              k[1478] = k[1478] & ~(1 << i);
                              break i;
                            }
 while (0);
                          g = k[1481] | 0;
                          if (K >>> 0 < g >>> 0)
                            Ob();
                          k[K + 24 >> 2] = c;
                          i = b | 16;
                          h = k[x + (i + a) >> 2] | 0;
                          do
                            if (h)
                              if (h >>> 0 < g >>> 0)
                                Ob();
                              else {
                                k[K + 16 >> 2] = h;
                                k[h + 24 >> 2] = K;
                                break;
                              }
 while (0);
                          h = k[x + (l + i) >> 2] | 0;
                          if (!h)
                            break;
                          if (h >>> 0 < (k[1481] | 0) >>> 0)
                            Ob();
                          else {
                            k[K + 20 >> 2] = h;
                            k[h + 24 >> 2] = K;
                            break;
                          }
                        } else {
                          f = k[x + ((b | 8) + a) >> 2] | 0;
                          e = k[x + (a + 12 + b) >> 2] | 0;
                          g = 5948 + (d << 1 << 2) | 0;
                          do
                            if ((f | 0) != (g | 0)) {
                              if (f >>> 0 < i >>> 0)
                                Ob();
                              if ((k[f + 12 >> 2] | 0) == (h | 0))
                                break;
                              Ob();
                            }
 while (0);
                          if ((e | 0) == (f | 0)) {
                            k[1477] = k[1477] & ~(1 << d);
                            break;
                          }
                          do
                            if ((e | 0) == (g | 0))
                              G = e + 8 | 0;
                            else {
                              if (e >>> 0 < i >>> 0)
                                Ob();
                              i = e + 8 | 0;
                              if ((k[i >> 2] | 0) == (h | 0)) {
                                G = i;
                                break;
                              }
                              Ob();
                            }
 while (0);
                          k[f + 12 >> 2] = e;
                          k[G >> 2] = f;
                        }
 while (0);
                      h = x + ((j | b) + a) | 0;
                      i = j + m | 0;
                    } else
                      i = m;
                    h = h + 4 | 0;
                    k[h >> 2] = k[h >> 2] & -2;
                    k[x + (o + 4) >> 2] = i | 1;
                    k[x + (i + o) >> 2] = i;
                    h = i >>> 3;
                    if (i >>> 0 < 256) {
                      g = h << 1;
                      e = 5948 + (g << 2) | 0;
                      f = k[1477] | 0;
                      h = 1 << h;
                      do
                        if (!(f & h)) {
                          k[1477] = f | h;
                          L = 5948 + (g + 2 << 2) | 0;
                          M = e;
                        } else {
                          h = 5948 + (g + 2 << 2) | 0;
                          g = k[h >> 2] | 0;
                          if (g >>> 0 >= (k[1481] | 0) >>> 0) {
                            L = h;
                            M = g;
                            break;
                          }
                          Ob();
                        }
 while (0);
                      k[L >> 2] = q;
                      k[M + 12 >> 2] = q;
                      k[x + (o + 8) >> 2] = M;
                      k[x + (o + 12) >> 2] = e;
                      break;
                    }
                    c = i >>> 8;
                    do
                      if (!c)
                        e = 0;
                      else {
                        if (i >>> 0 > 16777215) {
                          e = 31;
                          break;
                        }
                        L = (c + 1048320 | 0) >>> 16 & 8;
                        M = c << L;
                        K = (M + 520192 | 0) >>> 16 & 4;
                        M = M << K;
                        e = (M + 245760 | 0) >>> 16 & 2;
                        e = 14 - (K | L | e) + (M << e >>> 15) | 0;
                        e = i >>> (e + 7 | 0) & 1 | e << 1;
                      }
 while (0);
                    h = 6212 + (e << 2) | 0;
                    k[x + (o + 28) >> 2] = e;
                    k[x + (o + 20) >> 2] = 0;
                    k[x + (o + 16) >> 2] = 0;
                    g = k[1478] | 0;
                    f = 1 << e;
                    if (!(g & f)) {
                      k[1478] = g | f;
                      k[h >> 2] = q;
                      k[x + (o + 24) >> 2] = h;
                      k[x + (o + 12) >> 2] = q;
                      k[x + (o + 8) >> 2] = q;
                      break;
                    }
                    c = k[h >> 2] | 0;
                    j: do
                      if ((k[c + 4 >> 2] & -8 | 0) != (i | 0)) {
                        g = i << ((e | 0) == 31 ? 0 : 25 - (e >>> 1) | 0);
                        while (1) {
                          b = c + 16 + (g >>> 31 << 2) | 0;
                          h = k[b >> 2] | 0;
                          if (!h)
                            break;
                          if ((k[h + 4 >> 2] & -8 | 0) == (i | 0)) {
                            N = h;
                            break j;
                          } else {
                            g = g << 1;
                            c = h;
                          }
                        }
                        if (b >>> 0 < (k[1481] | 0) >>> 0)
                          Ob();
                        else {
                          k[b >> 2] = q;
                          k[x + (o + 24) >> 2] = c;
                          k[x + (o + 12) >> 2] = q;
                          k[x + (o + 8) >> 2] = q;
                          break h;
                        }
                      } else
                        N = c;
 while (0);
                    c = N + 8 | 0;
                    b = k[c >> 2] | 0;
                    M = k[1481] | 0;
                    if (b >>> 0 >= M >>> 0 & N >>> 0 >= M >>> 0) {
                      k[b + 12 >> 2] = q;
                      k[c >> 2] = q;
                      k[x + (o + 8) >> 2] = b;
                      k[x + (o + 12) >> 2] = N;
                      k[x + (o + 24) >> 2] = 0;
                      break;
                    } else
                      Ob();
                  } else {
                    N = (k[1480] | 0) + m | 0;
                    k[1480] = N;
                    k[1483] = q;
                    k[x + (o + 4) >> 2] = N | 1;
                  }
 while (0);
                N = x + (p | 8) | 0;
                return N | 0;
              } else
                f = 6356;
            while (1) {
              g = k[f >> 2] | 0;
              if (g >>> 0 <= n >>> 0 ? (h = k[f + 4 >> 2] | 0, e = g + h | 0, e >>> 0 > n >>> 0) : 0)
                break;
              f = k[f + 8 >> 2] | 0;
            }
            i = g + (h + -39) | 0;
            g = g + (h + -47 + ((i & 7 | 0) == 0 ? 0 : 0 - i & 7)) | 0;
            i = n + 16 | 0;
            g = g >>> 0 < i >>> 0 ? n : g;
            h = g + 8 | 0;
            f = x + 8 | 0;
            f = (f & 7 | 0) == 0 ? 0 : 0 - f & 7;
            N = a + -40 - f | 0;
            k[1483] = x + f;
            k[1480] = N;
            k[x + (f + 4) >> 2] = N | 1;
            k[x + (a + -36) >> 2] = 40;
            k[1484] = k[1599];
            f = g + 4 | 0;
            k[f >> 2] = 27;
            k[h >> 2] = k[1589];
            k[h + 4 >> 2] = k[1590];
            k[h + 8 >> 2] = k[1591];
            k[h + 12 >> 2] = k[1592];
            k[1589] = x;
            k[1590] = a;
            k[1592] = 0;
            k[1591] = h;
            h = g + 28 | 0;
            k[h >> 2] = 7;
            if ((g + 32 | 0) >>> 0 < e >>> 0)
              do {
                N = h;
                h = h + 4 | 0;
                k[h >> 2] = 7;
              } while ((N + 8 | 0) >>> 0 < e >>> 0);
            if ((g | 0) != (n | 0)) {
              e = g - n | 0;
              k[f >> 2] = k[f >> 2] & -2;
              k[n + 4 >> 2] = e | 1;
              k[g >> 2] = e;
              h = e >>> 3;
              if (e >>> 0 < 256) {
                g = h << 1;
                e = 5948 + (g << 2) | 0;
                f = k[1477] | 0;
                h = 1 << h;
                if (f & h) {
                  c = 5948 + (g + 2 << 2) | 0;
                  b = k[c >> 2] | 0;
                  if (b >>> 0 < (k[1481] | 0) >>> 0)
                    Ob();
                  else {
                    H = c;
                    I = b;
                  }
                } else {
                  k[1477] = f | h;
                  H = 5948 + (g + 2 << 2) | 0;
                  I = e;
                }
                k[H >> 2] = n;
                k[I + 12 >> 2] = n;
                k[n + 8 >> 2] = I;
                k[n + 12 >> 2] = e;
                break;
              }
              c = e >>> 8;
              if (c)
                if (e >>> 0 > 16777215)
                  g = 31;
                else {
                  M = (c + 1048320 | 0) >>> 16 & 8;
                  N = c << M;
                  L = (N + 520192 | 0) >>> 16 & 4;
                  N = N << L;
                  g = (N + 245760 | 0) >>> 16 & 2;
                  g = 14 - (L | M | g) + (N << g >>> 15) | 0;
                  g = e >>> (g + 7 | 0) & 1 | g << 1;
                }
              else
                g = 0;
              h = 6212 + (g << 2) | 0;
              k[n + 28 >> 2] = g;
              k[n + 20 >> 2] = 0;
              k[i >> 2] = 0;
              c = k[1478] | 0;
              b = 1 << g;
              if (!(c & b)) {
                k[1478] = c | b;
                k[h >> 2] = n;
                k[n + 24 >> 2] = h;
                k[n + 12 >> 2] = n;
                k[n + 8 >> 2] = n;
                break;
              }
              c = k[h >> 2] | 0;
              k: do
                if ((k[c + 4 >> 2] & -8 | 0) != (e | 0)) {
                  h = e << ((g | 0) == 31 ? 0 : 25 - (g >>> 1) | 0);
                  while (1) {
                    b = c + 16 + (h >>> 31 << 2) | 0;
                    d = k[b >> 2] | 0;
                    if (!d)
                      break;
                    if ((k[d + 4 >> 2] & -8 | 0) == (e | 0)) {
                      J = d;
                      break k;
                    } else {
                      h = h << 1;
                      c = d;
                    }
                  }
                  if (b >>> 0 < (k[1481] | 0) >>> 0)
                    Ob();
                  else {
                    k[b >> 2] = n;
                    k[n + 24 >> 2] = c;
                    k[n + 12 >> 2] = n;
                    k[n + 8 >> 2] = n;
                    break g;
                  }
                } else
                  J = c;
 while (0);
              c = J + 8 | 0;
              b = k[c >> 2] | 0;
              N = k[1481] | 0;
              if (b >>> 0 >= N >>> 0 & J >>> 0 >= N >>> 0) {
                k[b + 12 >> 2] = n;
                k[c >> 2] = n;
                k[n + 8 >> 2] = b;
                k[n + 12 >> 2] = J;
                k[n + 24 >> 2] = 0;
                break;
              } else
                Ob();
            }
          } else {
            N = k[1481] | 0;
            if ((N | 0) == 0 | x >>> 0 < N >>> 0)
              k[1481] = x;
            k[1589] = x;
            k[1590] = a;
            k[1592] = 0;
            k[1486] = k[1595];
            k[1485] = -1;
            c = 0;
            do {
              N = c << 1;
              M = 5948 + (N << 2) | 0;
              k[5948 + (N + 3 << 2) >> 2] = M;
              k[5948 + (N + 2 << 2) >> 2] = M;
              c = c + 1 | 0;
            } while ((c | 0) != 32);
            N = x + 8 | 0;
            N = (N & 7 | 0) == 0 ? 0 : 0 - N & 7;
            M = a + -40 - N | 0;
            k[1483] = x + N;
            k[1480] = M;
            k[x + (N + 4) >> 2] = M | 1;
            k[x + (a + -36) >> 2] = 40;
            k[1484] = k[1599];
          }
 while (0);
        b = k[1480] | 0;
        if (b >>> 0 > z >>> 0) {
          M = b - z | 0;
          k[1480] = M;
          N = k[1483] | 0;
          k[1483] = N + z;
          k[N + (z + 4) >> 2] = M | 1;
          k[N + 4 >> 2] = z | 3;
          N = N + 8 | 0;
          return N | 0;
        }
      }
      N = jc() | 0;
      k[N >> 2] = 12;
      N = 0;
      return N | 0;
    }
    function mf(a) {
      a = a | 0;
      var b = 0,
          c = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0,
          l = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0,
          q = 0,
          r = 0,
          s = 0,
          t = 0,
          u = 0;
      if (!a)
        return ;
      f = a + -8 | 0;
      g = k[1481] | 0;
      if (f >>> 0 < g >>> 0)
        Ob();
      e = k[a + -4 >> 2] | 0;
      d = e & 3;
      if ((d | 0) == 1)
        Ob();
      o = e & -8;
      q = a + (o + -8) | 0;
      do
        if (!(e & 1)) {
          f = k[f >> 2] | 0;
          if (!d)
            return ;
          h = -8 - f | 0;
          l = a + h | 0;
          m = f + o | 0;
          if (l >>> 0 < g >>> 0)
            Ob();
          if ((l | 0) == (k[1482] | 0)) {
            f = a + (o + -4) | 0;
            e = k[f >> 2] | 0;
            if ((e & 3 | 0) != 3) {
              u = l;
              j = m;
              break;
            }
            k[1479] = m;
            k[f >> 2] = e & -2;
            k[a + (h + 4) >> 2] = m | 1;
            k[q >> 2] = m;
            return ;
          }
          c = f >>> 3;
          if (f >>> 0 < 256) {
            d = k[a + (h + 8) >> 2] | 0;
            e = k[a + (h + 12) >> 2] | 0;
            f = 5948 + (c << 1 << 2) | 0;
            if ((d | 0) != (f | 0)) {
              if (d >>> 0 < g >>> 0)
                Ob();
              if ((k[d + 12 >> 2] | 0) != (l | 0))
                Ob();
            }
            if ((e | 0) == (d | 0)) {
              k[1477] = k[1477] & ~(1 << c);
              u = l;
              j = m;
              break;
            }
            if ((e | 0) != (f | 0)) {
              if (e >>> 0 < g >>> 0)
                Ob();
              f = e + 8 | 0;
              if ((k[f >> 2] | 0) == (l | 0))
                b = f;
              else
                Ob();
            } else
              b = e + 8 | 0;
            k[d + 12 >> 2] = e;
            k[b >> 2] = d;
            u = l;
            j = m;
            break;
          }
          b = k[a + (h + 24) >> 2] | 0;
          d = k[a + (h + 12) >> 2] | 0;
          do
            if ((d | 0) == (l | 0)) {
              e = a + (h + 20) | 0;
              f = k[e >> 2] | 0;
              if (!f) {
                e = a + (h + 16) | 0;
                f = k[e >> 2] | 0;
                if (!f) {
                  i = 0;
                  break;
                }
              }
              while (1) {
                d = f + 20 | 0;
                c = k[d >> 2] | 0;
                if (c) {
                  f = c;
                  e = d;
                  continue;
                }
                d = f + 16 | 0;
                c = k[d >> 2] | 0;
                if (!c)
                  break;
                else {
                  f = c;
                  e = d;
                }
              }
              if (e >>> 0 < g >>> 0)
                Ob();
              else {
                k[e >> 2] = 0;
                i = f;
                break;
              }
            } else {
              c = k[a + (h + 8) >> 2] | 0;
              if (c >>> 0 < g >>> 0)
                Ob();
              f = c + 12 | 0;
              if ((k[f >> 2] | 0) != (l | 0))
                Ob();
              e = d + 8 | 0;
              if ((k[e >> 2] | 0) == (l | 0)) {
                k[f >> 2] = d;
                k[e >> 2] = c;
                i = d;
                break;
              } else
                Ob();
            }
 while (0);
          if (b) {
            f = k[a + (h + 28) >> 2] | 0;
            e = 6212 + (f << 2) | 0;
            if ((l | 0) == (k[e >> 2] | 0)) {
              k[e >> 2] = i;
              if (!i) {
                k[1478] = k[1478] & ~(1 << f);
                u = l;
                j = m;
                break;
              }
            } else {
              if (b >>> 0 < (k[1481] | 0) >>> 0)
                Ob();
              f = b + 16 | 0;
              if ((k[f >> 2] | 0) == (l | 0))
                k[f >> 2] = i;
              else
                k[b + 20 >> 2] = i;
              if (!i) {
                u = l;
                j = m;
                break;
              }
            }
            e = k[1481] | 0;
            if (i >>> 0 < e >>> 0)
              Ob();
            k[i + 24 >> 2] = b;
            f = k[a + (h + 16) >> 2] | 0;
            do
              if (f)
                if (f >>> 0 < e >>> 0)
                  Ob();
                else {
                  k[i + 16 >> 2] = f;
                  k[f + 24 >> 2] = i;
                  break;
                }
 while (0);
            f = k[a + (h + 20) >> 2] | 0;
            if (f)
              if (f >>> 0 < (k[1481] | 0) >>> 0)
                Ob();
              else {
                k[i + 20 >> 2] = f;
                k[f + 24 >> 2] = i;
                u = l;
                j = m;
                break;
              }
            else {
              u = l;
              j = m;
            }
          } else {
            u = l;
            j = m;
          }
        } else {
          u = f;
          j = o;
        }
 while (0);
      if (u >>> 0 >= q >>> 0)
        Ob();
      f = a + (o + -4) | 0;
      e = k[f >> 2] | 0;
      if (!(e & 1))
        Ob();
      if (!(e & 2)) {
        if ((q | 0) == (k[1483] | 0)) {
          t = (k[1480] | 0) + j | 0;
          k[1480] = t;
          k[1483] = u;
          k[u + 4 >> 2] = t | 1;
          if ((u | 0) != (k[1482] | 0))
            return ;
          k[1482] = 0;
          k[1479] = 0;
          return ;
        }
        if ((q | 0) == (k[1482] | 0)) {
          t = (k[1479] | 0) + j | 0;
          k[1479] = t;
          k[1482] = u;
          k[u + 4 >> 2] = t | 1;
          k[u + t >> 2] = t;
          return ;
        }
        g = (e & -8) + j | 0;
        b = e >>> 3;
        do
          if (e >>> 0 >= 256) {
            b = k[a + (o + 16) >> 2] | 0;
            f = k[a + (o | 4) >> 2] | 0;
            do
              if ((f | 0) == (q | 0)) {
                e = a + (o + 12) | 0;
                f = k[e >> 2] | 0;
                if (!f) {
                  e = a + (o + 8) | 0;
                  f = k[e >> 2] | 0;
                  if (!f) {
                    p = 0;
                    break;
                  }
                }
                while (1) {
                  d = f + 20 | 0;
                  c = k[d >> 2] | 0;
                  if (c) {
                    f = c;
                    e = d;
                    continue;
                  }
                  d = f + 16 | 0;
                  c = k[d >> 2] | 0;
                  if (!c)
                    break;
                  else {
                    f = c;
                    e = d;
                  }
                }
                if (e >>> 0 < (k[1481] | 0) >>> 0)
                  Ob();
                else {
                  k[e >> 2] = 0;
                  p = f;
                  break;
                }
              } else {
                e = k[a + o >> 2] | 0;
                if (e >>> 0 < (k[1481] | 0) >>> 0)
                  Ob();
                d = e + 12 | 0;
                if ((k[d >> 2] | 0) != (q | 0))
                  Ob();
                c = f + 8 | 0;
                if ((k[c >> 2] | 0) == (q | 0)) {
                  k[d >> 2] = f;
                  k[c >> 2] = e;
                  p = f;
                  break;
                } else
                  Ob();
              }
 while (0);
            if (b) {
              f = k[a + (o + 20) >> 2] | 0;
              e = 6212 + (f << 2) | 0;
              if ((q | 0) == (k[e >> 2] | 0)) {
                k[e >> 2] = p;
                if (!p) {
                  k[1478] = k[1478] & ~(1 << f);
                  break;
                }
              } else {
                if (b >>> 0 < (k[1481] | 0) >>> 0)
                  Ob();
                f = b + 16 | 0;
                if ((k[f >> 2] | 0) == (q | 0))
                  k[f >> 2] = p;
                else
                  k[b + 20 >> 2] = p;
                if (!p)
                  break;
              }
              f = k[1481] | 0;
              if (p >>> 0 < f >>> 0)
                Ob();
              k[p + 24 >> 2] = b;
              e = k[a + (o + 8) >> 2] | 0;
              do
                if (e)
                  if (e >>> 0 < f >>> 0)
                    Ob();
                  else {
                    k[p + 16 >> 2] = e;
                    k[e + 24 >> 2] = p;
                    break;
                  }
 while (0);
              c = k[a + (o + 12) >> 2] | 0;
              if (c)
                if (c >>> 0 < (k[1481] | 0) >>> 0)
                  Ob();
                else {
                  k[p + 20 >> 2] = c;
                  k[c + 24 >> 2] = p;
                  break;
                }
            }
          } else {
            c = k[a + o >> 2] | 0;
            d = k[a + (o | 4) >> 2] | 0;
            f = 5948 + (b << 1 << 2) | 0;
            if ((c | 0) != (f | 0)) {
              if (c >>> 0 < (k[1481] | 0) >>> 0)
                Ob();
              if ((k[c + 12 >> 2] | 0) != (q | 0))
                Ob();
            }
            if ((d | 0) == (c | 0)) {
              k[1477] = k[1477] & ~(1 << b);
              break;
            }
            if ((d | 0) != (f | 0)) {
              if (d >>> 0 < (k[1481] | 0) >>> 0)
                Ob();
              e = d + 8 | 0;
              if ((k[e >> 2] | 0) == (q | 0))
                n = e;
              else
                Ob();
            } else
              n = d + 8 | 0;
            k[c + 12 >> 2] = d;
            k[n >> 2] = c;
          }
 while (0);
        k[u + 4 >> 2] = g | 1;
        k[u + g >> 2] = g;
        if ((u | 0) == (k[1482] | 0)) {
          k[1479] = g;
          return ;
        } else
          f = g;
      } else {
        k[f >> 2] = e & -2;
        k[u + 4 >> 2] = j | 1;
        k[u + j >> 2] = j;
        f = j;
      }
      e = f >>> 3;
      if (f >>> 0 < 256) {
        d = e << 1;
        f = 5948 + (d << 2) | 0;
        b = k[1477] | 0;
        c = 1 << e;
        if (b & c) {
          c = 5948 + (d + 2 << 2) | 0;
          b = k[c >> 2] | 0;
          if (b >>> 0 < (k[1481] | 0) >>> 0)
            Ob();
          else {
            r = c;
            s = b;
          }
        } else {
          k[1477] = b | c;
          r = 5948 + (d + 2 << 2) | 0;
          s = f;
        }
        k[r >> 2] = u;
        k[s + 12 >> 2] = u;
        k[u + 8 >> 2] = s;
        k[u + 12 >> 2] = f;
        return ;
      }
      b = f >>> 8;
      if (b)
        if (f >>> 0 > 16777215)
          e = 31;
        else {
          r = (b + 1048320 | 0) >>> 16 & 8;
          s = b << r;
          q = (s + 520192 | 0) >>> 16 & 4;
          s = s << q;
          e = (s + 245760 | 0) >>> 16 & 2;
          e = 14 - (q | r | e) + (s << e >>> 15) | 0;
          e = f >>> (e + 7 | 0) & 1 | e << 1;
        }
      else
        e = 0;
      c = 6212 + (e << 2) | 0;
      k[u + 28 >> 2] = e;
      k[u + 20 >> 2] = 0;
      k[u + 16 >> 2] = 0;
      b = k[1478] | 0;
      d = 1 << e;
      a: do
        if (b & d) {
          c = k[c >> 2] | 0;
          b: do
            if ((k[c + 4 >> 2] & -8 | 0) != (f | 0)) {
              e = f << ((e | 0) == 31 ? 0 : 25 - (e >>> 1) | 0);
              while (1) {
                b = c + 16 + (e >>> 31 << 2) | 0;
                d = k[b >> 2] | 0;
                if (!d)
                  break;
                if ((k[d + 4 >> 2] & -8 | 0) == (f | 0)) {
                  t = d;
                  break b;
                } else {
                  e = e << 1;
                  c = d;
                }
              }
              if (b >>> 0 < (k[1481] | 0) >>> 0)
                Ob();
              else {
                k[b >> 2] = u;
                k[u + 24 >> 2] = c;
                k[u + 12 >> 2] = u;
                k[u + 8 >> 2] = u;
                break a;
              }
            } else
              t = c;
 while (0);
          b = t + 8 | 0;
          c = k[b >> 2] | 0;
          s = k[1481] | 0;
          if (c >>> 0 >= s >>> 0 & t >>> 0 >= s >>> 0) {
            k[c + 12 >> 2] = u;
            k[b >> 2] = u;
            k[u + 8 >> 2] = c;
            k[u + 12 >> 2] = t;
            k[u + 24 >> 2] = 0;
            break;
          } else
            Ob();
        } else {
          k[1478] = b | d;
          k[c >> 2] = u;
          k[u + 24 >> 2] = c;
          k[u + 12 >> 2] = u;
          k[u + 8 >> 2] = u;
        }
 while (0);
      u = (k[1485] | 0) + -1 | 0;
      k[1485] = u;
      if (!u)
        b = 6364;
      else
        return ;
      while (1) {
        b = k[b >> 2] | 0;
        if (!b)
          break;
        else
          b = b + 8 | 0;
      }
      k[1485] = -1;
      return ;
    }
    function nf() {}
    function of(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      d = b - d - (c >>> 0 > a >>> 0 | 0) >>> 0;
      return (M = d, a - c >>> 0 | 0) | 0;
    }
    function pf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
          e = 0,
          f = 0,
          g = 0;
      d = a + c | 0;
      if ((c | 0) >= 20) {
        b = b & 255;
        f = a & 3;
        g = b | b << 8 | b << 16 | b << 24;
        e = d & ~3;
        if (f) {
          f = a + 4 - f | 0;
          while ((a | 0) < (f | 0)) {
            i[a >> 0] = b;
            a = a + 1 | 0;
          }
        }
        while ((a | 0) < (e | 0)) {
          k[a >> 2] = g;
          a = a + 4 | 0;
        }
      }
      while ((a | 0) < (d | 0)) {
        i[a >> 0] = b;
        a = a + 1 | 0;
      }
      return a - c | 0;
    }
    function qf(a) {
      a = a | 0;
      var b = 0;
      b = a;
      while (i[b >> 0] | 0)
        b = b + 1 | 0;
      return b - a | 0;
    }
    function rf(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
          d = 0;
      d = a + (qf(a) | 0) | 0;
      do {
        i[d + c >> 0] = i[b + c >> 0];
        c = c + 1 | 0;
      } while (i[b + (c - 1) >> 0] | 0);
      return a | 0;
    }
    function sf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      if ((c | 0) < 32) {
        M = b << c | (a & (1 << c) - 1 << 32 - c) >>> 32 - c;
        return a << c;
      }
      M = a << c - 32;
      return 0;
    }
    function tf(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      c = a + c >>> 0;
      return (M = b + d + (c >>> 0 < a >>> 0 | 0) >>> 0, c | 0) | 0;
    }
    function uf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      if ((c | 0) < 32) {
        M = b >>> c;
        return a >>> c | (b & (1 << c) - 1) << 32 - c;
      }
      M = 0;
      return b >>> c - 32 | 0;
    }
    function vf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0;
      if ((c | 0) >= 4096)
        return Ta(a | 0, b | 0, c | 0) | 0;
      d = a | 0;
      if ((a & 3) == (b & 3)) {
        while (a & 3) {
          if (!c)
            return d | 0;
          i[a >> 0] = i[b >> 0] | 0;
          a = a + 1 | 0;
          b = b + 1 | 0;
          c = c - 1 | 0;
        }
        while ((c | 0) >= 4) {
          k[a >> 2] = k[b >> 2];
          a = a + 4 | 0;
          b = b + 4 | 0;
          c = c - 4 | 0;
        }
      }
      while ((c | 0) > 0) {
        i[a >> 0] = i[b >> 0] | 0;
        a = a + 1 | 0;
        b = b + 1 | 0;
        c = c - 1 | 0;
      }
      return d | 0;
    }
    function wf(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0;
      do {
        i[a + c >> 0] = i[b + c >> 0];
        c = c + 1 | 0;
      } while (i[b + (c - 1) >> 0] | 0);
      return a | 0;
    }
    function xf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      if ((c | 0) < 32) {
        M = b >> c;
        return a >>> c | (b & (1 << c) - 1) << 32 - c;
      }
      M = (b | 0) < 0 ? -1 : 0;
      return b >> c - 32 | 0;
    }
    function yf(a) {
      a = a | 0;
      var b = 0;
      b = i[v + (a & 255) >> 0] | 0;
      if ((b | 0) < 8)
        return b | 0;
      b = i[v + (a >> 8 & 255) >> 0] | 0;
      if ((b | 0) < 8)
        return b + 8 | 0;
      b = i[v + (a >> 16 & 255) >> 0] | 0;
      if ((b | 0) < 8)
        return b + 16 | 0;
      return (i[v + (a >>> 24) >> 0] | 0) + 24 | 0;
    }
    function zf(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
          d = 0,
          e = 0,
          f = 0;
      f = a & 65535;
      e = b & 65535;
      c = ia(e, f) | 0;
      d = a >>> 16;
      a = (c >>> 16) + (ia(e, d) | 0) | 0;
      e = b >>> 16;
      b = ia(e, f) | 0;
      return (M = (a >>> 16) + (ia(e, d) | 0) + (((a & 65535) + b | 0) >>> 16) | 0, a + b << 16 | c & 65535 | 0) | 0;
    }
    function Af(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0;
      j = b >> 31 | ((b | 0) < 0 ? -1 : 0) << 1;
      i = ((b | 0) < 0 ? -1 : 0) >> 31 | ((b | 0) < 0 ? -1 : 0) << 1;
      f = d >> 31 | ((d | 0) < 0 ? -1 : 0) << 1;
      e = ((d | 0) < 0 ? -1 : 0) >> 31 | ((d | 0) < 0 ? -1 : 0) << 1;
      h = of(j ^ a, i ^ b, j, i) | 0;
      g = M;
      a = f ^ j;
      b = e ^ i;
      return of((Ff(h, g, of(f ^ c, e ^ d, f, e) | 0, M, 0) | 0) ^ a, M ^ b, a, b) | 0;
    }
    function Bf(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
          f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0;
      e = r;
      r = r + 8 | 0;
      h = e | 0;
      g = b >> 31 | ((b | 0) < 0 ? -1 : 0) << 1;
      f = ((b | 0) < 0 ? -1 : 0) >> 31 | ((b | 0) < 0 ? -1 : 0) << 1;
      j = d >> 31 | ((d | 0) < 0 ? -1 : 0) << 1;
      i = ((d | 0) < 0 ? -1 : 0) >> 31 | ((d | 0) < 0 ? -1 : 0) << 1;
      a = of(g ^ a, f ^ b, g, f) | 0;
      b = M;
      Ff(a, b, of(j ^ c, i ^ d, j, i) | 0, M, h) | 0;
      d = of(k[h >> 2] ^ g, k[h + 4 >> 2] ^ f, g, f) | 0;
      c = M;
      r = e;
      return (M = c, d) | 0;
    }
    function Cf(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
          f = 0;
      e = a;
      f = c;
      c = zf(e, f) | 0;
      a = M;
      return (M = (ia(b, f) | 0) + (ia(d, e) | 0) + a | a & 0, c | 0 | 0) | 0;
    }
    function Df(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ff(a, b, c, d, 0) | 0;
    }
    function Ef(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
          f = 0;
      f = r;
      r = r + 8 | 0;
      e = f | 0;
      Ff(a, b, c, d, e) | 0;
      r = f;
      return (M = k[e + 4 >> 2] | 0, k[e >> 2] | 0) | 0;
    }
    function Ff(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      var f = 0,
          g = 0,
          h = 0,
          i = 0,
          j = 0,
          l = 0,
          m = 0,
          n = 0,
          o = 0,
          p = 0;
      n = a;
      l = b;
      m = l;
      j = c;
      o = d;
      h = o;
      if (!m) {
        f = (e | 0) != 0;
        if (!h) {
          if (f) {
            k[e >> 2] = (n >>> 0) % (j >>> 0);
            k[e + 4 >> 2] = 0;
          }
          o = 0;
          e = (n >>> 0) / (j >>> 0) >>> 0;
          return (M = o, e) | 0;
        } else {
          if (!f) {
            o = 0;
            e = 0;
            return (M = o, e) | 0;
          }
          k[e >> 2] = a | 0;
          k[e + 4 >> 2] = b & 0;
          o = 0;
          e = 0;
          return (M = o, e) | 0;
        }
      }
      i = (h | 0) == 0;
      do
        if (j) {
          if (!i) {
            g = (ka(h | 0) | 0) - (ka(m | 0) | 0) | 0;
            if (g >>> 0 <= 31) {
              f = g + 1 | 0;
              l = 31 - g | 0;
              j = g - 31 >> 31;
              h = f;
              i = n >>> (f >>> 0) & j | m << l;
              j = m >>> (f >>> 0) & j;
              f = 0;
              g = n << l;
              break;
            }
            if (!e) {
              o = 0;
              e = 0;
              return (M = o, e) | 0;
            }
            k[e >> 2] = a | 0;
            k[e + 4 >> 2] = l | b & 0;
            o = 0;
            e = 0;
            return (M = o, e) | 0;
          }
          i = j - 1 | 0;
          if (i & j) {
            g = (ka(j | 0) | 0) + 33 - (ka(m | 0) | 0) | 0;
            p = 64 - g | 0;
            l = 32 - g | 0;
            a = l >> 31;
            b = g - 32 | 0;
            j = b >> 31;
            h = g;
            i = l - 1 >> 31 & m >>> (b >>> 0) | (m << l | n >>> (g >>> 0)) & j;
            j = j & m >>> (g >>> 0);
            f = n << p & a;
            g = (m << p | n >>> (b >>> 0)) & a | n << l & g - 33 >> 31;
            break;
          }
          if (e) {
            k[e >> 2] = i & n;
            k[e + 4 >> 2] = 0;
          }
          if ((j | 0) == 1) {
            e = l | b & 0;
            p = a | 0 | 0;
            return (M = e, p) | 0;
          } else {
            p = yf(j | 0) | 0;
            e = m >>> (p >>> 0) | 0;
            p = m << 32 - p | n >>> (p >>> 0) | 0;
            return (M = e, p) | 0;
          }
        } else {
          if (i) {
            if (e) {
              k[e >> 2] = (m >>> 0) % (j >>> 0);
              k[e + 4 >> 2] = 0;
            }
            e = 0;
            p = (m >>> 0) / (j >>> 0) >>> 0;
            return (M = e, p) | 0;
          }
          if (!n) {
            if (e) {
              k[e >> 2] = 0;
              k[e + 4 >> 2] = (m >>> 0) % (h >>> 0);
            }
            e = 0;
            p = (m >>> 0) / (h >>> 0) >>> 0;
            return (M = e, p) | 0;
          }
          i = h - 1 | 0;
          if (!(i & h)) {
            if (e) {
              k[e >> 2] = a | 0;
              k[e + 4 >> 2] = i & m | b & 0;
            }
            e = 0;
            p = m >>> ((yf(h | 0) | 0) >>> 0);
            return (M = e, p) | 0;
          }
          g = (ka(h | 0) | 0) - (ka(m | 0) | 0) | 0;
          if (g >>> 0 <= 30) {
            j = g + 1 | 0;
            g = 31 - g | 0;
            h = j;
            i = m << g | n >>> (j >>> 0);
            j = m >>> (j >>> 0);
            f = 0;
            g = n << g;
            break;
          }
          if (!e) {
            e = 0;
            p = 0;
            return (M = e, p) | 0;
          }
          k[e >> 2] = a | 0;
          k[e + 4 >> 2] = l | b & 0;
          e = 0;
          p = 0;
          return (M = e, p) | 0;
        }
 while (0);
      if (!h) {
        l = g;
        h = 0;
        g = 0;
      } else {
        m = c | 0 | 0;
        l = o | d & 0;
        b = tf(m | 0, l | 0, -1, -1) | 0;
        a = M;
        c = g;
        g = 0;
        do {
          n = c;
          c = f >>> 31 | c << 1;
          f = g | f << 1;
          n = i << 1 | n >>> 31 | 0;
          d = i >>> 31 | j << 1 | 0;
          of(b, a, n, d) | 0;
          p = M;
          o = p >> 31 | ((p | 0) < 0 ? -1 : 0) << 1;
          g = o & 1;
          i = of(n, d, o & m, (((p | 0) < 0 ? -1 : 0) >> 31 | ((p | 0) < 0 ? -1 : 0) << 1) & l) | 0;
          j = M;
          h = h - 1 | 0;
        } while ((h | 0) != 0);
        l = c;
        h = 0;
      }
      c = 0;
      if (e) {
        k[e >> 2] = i;
        k[e + 4 >> 2] = j;
      }
      e = (f | 0) >>> 31 | (l | c) << 1 | (c << 1 | f >>> 31) & 0 | h;
      p = (f << 1 | 0 >>> 31) & -2 | g;
      return (M = e, p) | 0;
    }
    function Gf(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return tc[a & 63](b | 0, c | 0, d | 0) | 0;
    }
    function Hf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(0, a | 0, b | 0, c | 0) | 0;
    }
    function If(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(1, a | 0, b | 0, c | 0) | 0;
    }
    function Jf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(2, a | 0, b | 0, c | 0) | 0;
    }
    function Kf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(3, a | 0, b | 0, c | 0) | 0;
    }
    function Lf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(4, a | 0, b | 0, c | 0) | 0;
    }
    function Mf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(5, a | 0, b | 0, c | 0) | 0;
    }
    function Nf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(6, a | 0, b | 0, c | 0) | 0;
    }
    function Of(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(7, a | 0, b | 0, c | 0) | 0;
    }
    function Pf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(8, a | 0, b | 0, c | 0) | 0;
    }
    function Qf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(9, a | 0, b | 0, c | 0) | 0;
    }
    function Rf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(10, a | 0, b | 0, c | 0) | 0;
    }
    function Sf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(11, a | 0, b | 0, c | 0) | 0;
    }
    function Tf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(12, a | 0, b | 0, c | 0) | 0;
    }
    function Uf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(13, a | 0, b | 0, c | 0) | 0;
    }
    function Vf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(14, a | 0, b | 0, c | 0) | 0;
    }
    function Wf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(15, a | 0, b | 0, c | 0) | 0;
    }
    function Xf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(16, a | 0, b | 0, c | 0) | 0;
    }
    function Yf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(17, a | 0, b | 0, c | 0) | 0;
    }
    function Zf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(18, a | 0, b | 0, c | 0) | 0;
    }
    function _f(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return oa(19, a | 0, b | 0, c | 0) | 0;
    }
    function $f(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      uc[a & 63](b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function ag(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(0, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function bg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(1, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function cg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(2, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function dg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(3, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function eg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(4, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function fg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(5, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function gg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(6, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function hg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(7, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function ig(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(8, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function jg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(9, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function kg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(10, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function lg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(11, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function mg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(12, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function ng(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(13, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function og(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(14, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function pg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(15, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function qg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(16, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function rg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(17, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function sg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(18, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function tg(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      qa(19, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function ug(a) {
      a = a | 0;
      return vc[a & 63]() | 0;
    }
    function vg() {
      return sa(0) | 0;
    }
    function wg() {
      return sa(1) | 0;
    }
    function xg() {
      return sa(2) | 0;
    }
    function yg() {
      return sa(3) | 0;
    }
    function zg() {
      return sa(4) | 0;
    }
    function Ag() {
      return sa(5) | 0;
    }
    function Bg() {
      return sa(6) | 0;
    }
    function Cg() {
      return sa(7) | 0;
    }
    function Dg() {
      return sa(8) | 0;
    }
    function Eg() {
      return sa(9) | 0;
    }
    function Fg() {
      return sa(10) | 0;
    }
    function Gg() {
      return sa(11) | 0;
    }
    function Hg() {
      return sa(12) | 0;
    }
    function Ig() {
      return sa(13) | 0;
    }
    function Jg() {
      return sa(14) | 0;
    }
    function Kg() {
      return sa(15) | 0;
    }
    function Lg() {
      return sa(16) | 0;
    }
    function Mg() {
      return sa(17) | 0;
    }
    function Ng() {
      return sa(18) | 0;
    }
    function Og() {
      return sa(19) | 0;
    }
    function Pg(a, b) {
      a = a | 0;
      b = b | 0;
      wc[a & 63](b | 0);
    }
    function Qg(a) {
      a = a | 0;
      ua(0, a | 0);
    }
    function Rg(a) {
      a = a | 0;
      ua(1, a | 0);
    }
    function Sg(a) {
      a = a | 0;
      ua(2, a | 0);
    }
    function Tg(a) {
      a = a | 0;
      ua(3, a | 0);
    }
    function Ug(a) {
      a = a | 0;
      ua(4, a | 0);
    }
    function Vg(a) {
      a = a | 0;
      ua(5, a | 0);
    }
    function Wg(a) {
      a = a | 0;
      ua(6, a | 0);
    }
    function Xg(a) {
      a = a | 0;
      ua(7, a | 0);
    }
    function Yg(a) {
      a = a | 0;
      ua(8, a | 0);
    }
    function Zg(a) {
      a = a | 0;
      ua(9, a | 0);
    }
    function _g(a) {
      a = a | 0;
      ua(10, a | 0);
    }
    function $g(a) {
      a = a | 0;
      ua(11, a | 0);
    }
    function ah(a) {
      a = a | 0;
      ua(12, a | 0);
    }
    function bh(a) {
      a = a | 0;
      ua(13, a | 0);
    }
    function ch(a) {
      a = a | 0;
      ua(14, a | 0);
    }
    function dh(a) {
      a = a | 0;
      ua(15, a | 0);
    }
    function eh(a) {
      a = a | 0;
      ua(16, a | 0);
    }
    function fh(a) {
      a = a | 0;
      ua(17, a | 0);
    }
    function gh(a) {
      a = a | 0;
      ua(18, a | 0);
    }
    function hh(a) {
      a = a | 0;
      ua(19, a | 0);
    }
    function ih(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      xc[a & 63](b | 0, c | 0);
    }
    function jh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(0, a | 0, b | 0);
    }
    function kh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(1, a | 0, b | 0);
    }
    function lh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(2, a | 0, b | 0);
    }
    function mh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(3, a | 0, b | 0);
    }
    function nh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(4, a | 0, b | 0);
    }
    function oh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(5, a | 0, b | 0);
    }
    function ph(a, b) {
      a = a | 0;
      b = b | 0;
      wa(6, a | 0, b | 0);
    }
    function qh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(7, a | 0, b | 0);
    }
    function rh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(8, a | 0, b | 0);
    }
    function sh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(9, a | 0, b | 0);
    }
    function th(a, b) {
      a = a | 0;
      b = b | 0;
      wa(10, a | 0, b | 0);
    }
    function uh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(11, a | 0, b | 0);
    }
    function vh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(12, a | 0, b | 0);
    }
    function wh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(13, a | 0, b | 0);
    }
    function xh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(14, a | 0, b | 0);
    }
    function yh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(15, a | 0, b | 0);
    }
    function zh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(16, a | 0, b | 0);
    }
    function Ah(a, b) {
      a = a | 0;
      b = b | 0;
      wa(17, a | 0, b | 0);
    }
    function Bh(a, b) {
      a = a | 0;
      b = b | 0;
      wa(18, a | 0, b | 0);
    }
    function Ch(a, b) {
      a = a | 0;
      b = b | 0;
      wa(19, a | 0, b | 0);
    }
    function Dh(a, b) {
      a = a | 0;
      b = b | 0;
      return yc[a & 63](b | 0) | 0;
    }
    function Eh(a) {
      a = a | 0;
      return ya(0, a | 0) | 0;
    }
    function Fh(a) {
      a = a | 0;
      return ya(1, a | 0) | 0;
    }
    function Gh(a) {
      a = a | 0;
      return ya(2, a | 0) | 0;
    }
    function Hh(a) {
      a = a | 0;
      return ya(3, a | 0) | 0;
    }
    function Ih(a) {
      a = a | 0;
      return ya(4, a | 0) | 0;
    }
    function Jh(a) {
      a = a | 0;
      return ya(5, a | 0) | 0;
    }
    function Kh(a) {
      a = a | 0;
      return ya(6, a | 0) | 0;
    }
    function Lh(a) {
      a = a | 0;
      return ya(7, a | 0) | 0;
    }
    function Mh(a) {
      a = a | 0;
      return ya(8, a | 0) | 0;
    }
    function Nh(a) {
      a = a | 0;
      return ya(9, a | 0) | 0;
    }
    function Oh(a) {
      a = a | 0;
      return ya(10, a | 0) | 0;
    }
    function Ph(a) {
      a = a | 0;
      return ya(11, a | 0) | 0;
    }
    function Qh(a) {
      a = a | 0;
      return ya(12, a | 0) | 0;
    }
    function Rh(a) {
      a = a | 0;
      return ya(13, a | 0) | 0;
    }
    function Sh(a) {
      a = a | 0;
      return ya(14, a | 0) | 0;
    }
    function Th(a) {
      a = a | 0;
      return ya(15, a | 0) | 0;
    }
    function Uh(a) {
      a = a | 0;
      return ya(16, a | 0) | 0;
    }
    function Vh(a) {
      a = a | 0;
      return ya(17, a | 0) | 0;
    }
    function Wh(a) {
      a = a | 0;
      return ya(18, a | 0) | 0;
    }
    function Xh(a) {
      a = a | 0;
      return ya(19, a | 0) | 0;
    }
    function Yh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      zc[a & 63](b | 0, c | 0, d | 0);
    }
    function Zh(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(0, a | 0, b | 0, c | 0);
    }
    function _h(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(1, a | 0, b | 0, c | 0);
    }
    function $h(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(2, a | 0, b | 0, c | 0);
    }
    function ai(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(3, a | 0, b | 0, c | 0);
    }
    function bi(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(4, a | 0, b | 0, c | 0);
    }
    function ci(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(5, a | 0, b | 0, c | 0);
    }
    function di(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(6, a | 0, b | 0, c | 0);
    }
    function ei(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(7, a | 0, b | 0, c | 0);
    }
    function fi(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(8, a | 0, b | 0, c | 0);
    }
    function gi(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(9, a | 0, b | 0, c | 0);
    }
    function hi(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(10, a | 0, b | 0, c | 0);
    }
    function ii(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(11, a | 0, b | 0, c | 0);
    }
    function ji(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(12, a | 0, b | 0, c | 0);
    }
    function ki(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(13, a | 0, b | 0, c | 0);
    }
    function li(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(14, a | 0, b | 0, c | 0);
    }
    function mi(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(15, a | 0, b | 0, c | 0);
    }
    function ni(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(16, a | 0, b | 0, c | 0);
    }
    function oi(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(17, a | 0, b | 0, c | 0);
    }
    function pi(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(18, a | 0, b | 0, c | 0);
    }
    function qi(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      Aa(19, a | 0, b | 0, c | 0);
    }
    function ri(a) {
      a = a | 0;
      Ac[a & 63]();
    }
    function si() {
      Ca(0);
    }
    function ti() {
      Ca(1);
    }
    function ui() {
      Ca(2);
    }
    function vi() {
      Ca(3);
    }
    function wi() {
      Ca(4);
    }
    function xi() {
      Ca(5);
    }
    function yi() {
      Ca(6);
    }
    function zi() {
      Ca(7);
    }
    function Ai() {
      Ca(8);
    }
    function Bi() {
      Ca(9);
    }
    function Ci() {
      Ca(10);
    }
    function Di() {
      Ca(11);
    }
    function Ei() {
      Ca(12);
    }
    function Fi() {
      Ca(13);
    }
    function Gi() {
      Ca(14);
    }
    function Hi() {
      Ca(15);
    }
    function Ii() {
      Ca(16);
    }
    function Ji() {
      Ca(17);
    }
    function Ki() {
      Ca(18);
    }
    function Li() {
      Ca(19);
    }
    function Mi(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      return Bc[a & 63](b | 0, c | 0, d | 0, e | 0) | 0;
    }
    function Ni(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(0, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Oi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(1, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Pi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(2, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Qi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(3, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Ri(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(4, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Si(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(5, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Ti(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(6, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Ui(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(7, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Vi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(8, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Wi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(9, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Xi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(10, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Yi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(11, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Zi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(12, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function _i(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(13, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function $i(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(14, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function aj(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(15, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function bj(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(16, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function cj(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(17, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function dj(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(18, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function ej(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ea(19, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function fj(a, b, c, d, e, f, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      g = g | 0;
      Cc[a & 63](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0);
    }
    function gj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(0, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function hj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(1, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function ij(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(2, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function jj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(3, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function kj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(4, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function lj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(5, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function mj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(6, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function nj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(7, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function oj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(8, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function pj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(9, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function qj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(10, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function rj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(11, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function sj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(12, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function tj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(13, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function uj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(14, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function vj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(15, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function wj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(16, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function xj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(17, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function yj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(18, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function zj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ga(19, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Aj(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return Dc[a & 63](b | 0, c | 0) | 0;
    }
    function Bj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(0, a | 0, b | 0) | 0;
    }
    function Cj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(1, a | 0, b | 0) | 0;
    }
    function Dj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(2, a | 0, b | 0) | 0;
    }
    function Ej(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(3, a | 0, b | 0) | 0;
    }
    function Fj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(4, a | 0, b | 0) | 0;
    }
    function Gj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(5, a | 0, b | 0) | 0;
    }
    function Hj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(6, a | 0, b | 0) | 0;
    }
    function Ij(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(7, a | 0, b | 0) | 0;
    }
    function Jj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(8, a | 0, b | 0) | 0;
    }
    function Kj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(9, a | 0, b | 0) | 0;
    }
    function Lj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(10, a | 0, b | 0) | 0;
    }
    function Mj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(11, a | 0, b | 0) | 0;
    }
    function Nj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(12, a | 0, b | 0) | 0;
    }
    function Oj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(13, a | 0, b | 0) | 0;
    }
    function Pj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(14, a | 0, b | 0) | 0;
    }
    function Qj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(15, a | 0, b | 0) | 0;
    }
    function Rj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(16, a | 0, b | 0) | 0;
    }
    function Sj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(17, a | 0, b | 0) | 0;
    }
    function Tj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(18, a | 0, b | 0) | 0;
    }
    function Uj(a, b) {
      a = a | 0;
      b = b | 0;
      return Ia(19, a | 0, b | 0) | 0;
    }
    function Vj(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      Ec[a & 63](b | 0, c | 0, d | 0, e | 0);
    }
    function Wj(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(0, a | 0, b | 0, c | 0, d | 0);
    }
    function Xj(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(1, a | 0, b | 0, c | 0, d | 0);
    }
    function Yj(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(2, a | 0, b | 0, c | 0, d | 0);
    }
    function Zj(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(3, a | 0, b | 0, c | 0, d | 0);
    }
    function _j(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(4, a | 0, b | 0, c | 0, d | 0);
    }
    function $j(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(5, a | 0, b | 0, c | 0, d | 0);
    }
    function ak(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(6, a | 0, b | 0, c | 0, d | 0);
    }
    function bk(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(7, a | 0, b | 0, c | 0, d | 0);
    }
    function ck(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(8, a | 0, b | 0, c | 0, d | 0);
    }
    function dk(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(9, a | 0, b | 0, c | 0, d | 0);
    }
    function ek(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(10, a | 0, b | 0, c | 0, d | 0);
    }
    function fk(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(11, a | 0, b | 0, c | 0, d | 0);
    }
    function gk(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(12, a | 0, b | 0, c | 0, d | 0);
    }
    function hk(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(13, a | 0, b | 0, c | 0, d | 0);
    }
    function ik(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(14, a | 0, b | 0, c | 0, d | 0);
    }
    function jk(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(15, a | 0, b | 0, c | 0, d | 0);
    }
    function kk(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(16, a | 0, b | 0, c | 0, d | 0);
    }
    function lk(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(17, a | 0, b | 0, c | 0, d | 0);
    }
    function mk(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(18, a | 0, b | 0, c | 0, d | 0);
    }
    function nk(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ka(19, a | 0, b | 0, c | 0, d | 0);
    }
    function ok(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      la(0);
      return 0;
    }
    function pk(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      la(1);
    }
    function qk() {
      la(2);
      return 0;
    }
    function rk(a) {
      a = a | 0;
      la(3);
    }
    function sk(a, b) {
      a = a | 0;
      b = b | 0;
      la(4);
    }
    function tk(a, b) {
      a = a | 0;
      b = b | 0;
      eb(a | 0, b | 0);
    }
    function uk(a) {
      a = a | 0;
      la(5);
      return 0;
    }
    function vk(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      la(6);
    }
    function wk() {
      la(7);
    }
    function xk() {
      yb();
    }
    function yk(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      la(8);
      return 0;
    }
    function zk(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return vb(a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Ak(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      la(9);
    }
    function Bk(a, b) {
      a = a | 0;
      b = b | 0;
      la(10);
      return 0;
    }
    function Ck(a, b) {
      a = a | 0;
      b = b | 0;
      return Mb(a | 0, b | 0) | 0;
    }
    function Dk(a, b) {
      a = a | 0;
      b = b | 0;
      return Pa(a | 0, b | 0) | 0;
    }
    function Ek(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      la(11);
    }
    function Fk(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Va(a | 0, b | 0, c | 0, d | 0);
    }
    var tc = [ok, ok, Hf, ok, If, ok, Jf, ok, Kf, ok, Lf, ok, Mf, ok, Nf, ok, Of, ok, Pf, ok, Qf, ok, Rf, ok, Sf, ok, Tf, ok, Uf, ok, Vf, ok, Wf, ok, Xf, ok, Yf, ok, Zf, ok, _f, ok, Fe, Ge, He, Ne, kf, ok, ok, ok, ok, ok, ok, ok, ok, ok, ok, ok, ok, ok, ok, ok, ok, ok];
    var uc = [pk, pk, ag, pk, bg, pk, cg, pk, dg, pk, eg, pk, fg, pk, gg, pk, hg, pk, ig, pk, jg, pk, kg, pk, lg, pk, mg, pk, ng, pk, og, pk, pg, pk, qg, pk, rg, pk, sg, pk, tg, pk, Ue, Te, Qe, pk, pk, pk, pk, pk, pk, pk, pk, pk, pk, pk, pk, pk, pk, pk, pk, pk, pk, pk];
    var vc = [qk, qk, vg, qk, wg, qk, xg, qk, yg, qk, zg, qk, Ag, qk, Bg, qk, Cg, qk, Dg, qk, Eg, qk, Fg, qk, Gg, qk, Hg, qk, Ig, qk, Jg, qk, Kg, qk, Lg, qk, Mg, qk, Ng, qk, Og, qk, ge, fe, Zd, qk, qk, qk, qk, qk, qk, qk, qk, qk, qk, qk, qk, qk, qk, qk, qk, qk, qk, qk];
    var wc = [rk, rk, Qg, rk, Rg, rk, Sg, rk, Tg, rk, Ug, rk, Vg, rk, Wg, rk, Xg, rk, Yg, rk, Zg, rk, _g, rk, $g, rk, ah, rk, bh, rk, ch, rk, dh, rk, eh, rk, fh, rk, gh, rk, hh, rk, we, ze, xe, ye, Ae, Be, Ce, De, Ee, Qc, rk, rk, rk, rk, rk, rk, rk, rk, rk, rk, rk, rk];
    var xc = [sk, sk, jh, sk, kh, sk, lh, sk, mh, sk, nh, sk, oh, sk, ph, sk, qh, sk, rh, sk, sh, sk, th, sk, uh, sk, vh, sk, wh, sk, xh, sk, yh, sk, zh, sk, Ah, sk, Bh, sk, Ch, sk, tk, Yd, sk, sk, sk, sk, sk, sk, sk, sk, sk, sk, sk, sk, sk, sk, sk, sk, sk, sk, sk, sk];
    var yc = [uk, uk, Eh, uk, Fh, uk, Gh, uk, Hh, uk, Ih, uk, Jh, uk, Kh, uk, Lh, uk, Mh, uk, Nh, uk, Oh, uk, Ph, uk, Qh, uk, Rh, uk, Sh, uk, Th, uk, Uh, uk, Vh, uk, Wh, uk, Xh, uk, Rc, ie, uk, uk, uk, uk, uk, uk, uk, uk, uk, uk, uk, uk, uk, uk, uk, uk, uk, uk, uk, uk];
    var zc = [vk, vk, Zh, vk, _h, vk, $h, vk, ai, vk, bi, vk, ci, vk, di, vk, ei, vk, fi, vk, gi, vk, hi, vk, ii, vk, ji, vk, ki, vk, li, vk, mi, vk, ni, vk, oi, vk, pi, vk, qi, vk, Tc, vk, vk, vk, vk, vk, vk, vk, vk, vk, vk, vk, vk, vk, vk, vk, vk, vk, vk, vk, vk, vk];
    var Ac = [wk, wk, si, wk, ti, wk, ui, wk, vi, wk, wi, wk, xi, wk, yi, wk, zi, wk, Ai, wk, Bi, wk, Ci, wk, Di, wk, Ei, wk, Fi, wk, Gi, wk, Hi, wk, Ii, wk, Ji, wk, Ki, wk, Li, wk, xk, Oc, ke, le, me, ee, ae, wk, wk, wk, wk, wk, wk, wk, wk, wk, wk, wk, wk, wk, wk, wk];
    var Bc = [yk, yk, Ni, yk, Oi, yk, Pi, yk, Qi, yk, Ri, yk, Si, yk, Ti, yk, Ui, yk, Vi, yk, Wi, yk, Xi, yk, Yi, yk, Zi, yk, _i, yk, $i, yk, aj, yk, bj, yk, cj, yk, dj, yk, ej, yk, zk, yk, yk, yk, yk, yk, yk, yk, yk, yk, yk, yk, yk, yk, yk, yk, yk, yk, yk, yk, yk, yk];
    var Cc = [Ak, Ak, gj, Ak, hj, Ak, ij, Ak, jj, Ak, kj, Ak, lj, Ak, mj, Ak, nj, Ak, oj, Ak, pj, Ak, qj, Ak, rj, Ak, sj, Ak, tj, Ak, uj, Ak, vj, Ak, wj, Ak, xj, Ak, yj, Ak, zj, Ak, Xe, We, Ve, Ak, Ak, Ak, Ak, Ak, Ak, Ak, Ak, Ak, Ak, Ak, Ak, Ak, Ak, Ak, Ak, Ak, Ak, Ak];
    var Dc = [Bk, Bk, Bj, Bk, Cj, Bk, Dj, Bk, Ej, Bk, Fj, Bk, Gj, Bk, Hj, Bk, Ij, Bk, Jj, Bk, Kj, Bk, Lj, Bk, Mj, Bk, Nj, Bk, Oj, Bk, Pj, Bk, Qj, Bk, Rj, Bk, Sj, Bk, Tj, Bk, Uj, Bk, Ck, Dk, Sc, Bk, Bk, Bk, Bk, Bk, Bk, Bk, Bk, Bk, Bk, Bk, Bk, Bk, Bk, Bk, Bk, Bk, Bk, Bk];
    var Ec = [Ek, Ek, Wj, Ek, Xj, Ek, Yj, Ek, Zj, Ek, _j, Ek, $j, Ek, ak, Ek, bk, Ek, ck, Ek, dk, Ek, ek, Ek, fk, Ek, gk, Ek, hk, Ek, ik, Ek, jk, Ek, kk, Ek, lk, Ek, mk, Ek, nk, Ek, Je, Ke, Me, Fk, Ek, Ek, Ek, Ek, Ek, Ek, Ek, Ek, Ek, Ek, Ek, Ek, Ek, Ek, Ek, Ek, Ek, Ek];
    return {
      _retro_cheat_set: be,
      _i64Subtract: of,
      _strcat: rf,
      _free: mf,
      _memset: pf,
      _i64Add: tf,
      _retro_load_game: ce,
      _retro_get_memory_data: he,
      _strlen: qf,
      _retro_unserialize: $d,
      _malloc: lf,
      _memcpy: vf,
      ___getTypeName: qe,
      _bitshift64Lshr: uf,
      _retro_get_system_info: Wd,
      _retro_serialize: _d,
      _strcpy: wf,
      _retro_get_system_av_info: Xd,
      _retro_load_game_special: de,
      _bitshift64Shl: sf,
      __GLOBAL__sub_I_libretro_emscripten_cpp: Uc,
      __GLOBAL__sub_I_bind_cpp: se,
      runPostSets: nf,
      _emscripten_replace_memory: _emscripten_replace_memory,
      stackAlloc: Fc,
      stackSave: Gc,
      stackRestore: Hc,
      establishStackSpace: Ic,
      setThrew: Jc,
      setTempRet0: Mc,
      getTempRet0: Nc,
      dynCall_iiii: Gf,
      dynCall_viiiii: $f,
      dynCall_i: ug,
      dynCall_vi: Pg,
      dynCall_vii: ih,
      dynCall_ii: Dh,
      dynCall_viii: Yh,
      dynCall_v: ri,
      dynCall_iiiii: Mi,
      dynCall_viiiiii: fj,
      dynCall_iii: Aj,
      dynCall_viiii: Vj
    };
  })(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
  var _strlen = Module["_strlen"] = asm["_strlen"];
  var _strcat = Module["_strcat"] = asm["_strcat"];
  var __GLOBAL__sub_I_libretro_emscripten_cpp = Module["__GLOBAL__sub_I_libretro_emscripten_cpp"] = asm["__GLOBAL__sub_I_libretro_emscripten_cpp"];
  var _retro_get_memory_data = Module["_retro_get_memory_data"] = asm["_retro_get_memory_data"];
  var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
  var _retro_get_system_info = Module["_retro_get_system_info"] = asm["_retro_get_system_info"];
  var _retro_get_system_av_info = Module["_retro_get_system_av_info"] = asm["_retro_get_system_av_info"];
  var _retro_load_game_special = Module["_retro_load_game_special"] = asm["_retro_load_game_special"];
  var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
  var _retro_cheat_set = Module["_retro_cheat_set"] = asm["_retro_cheat_set"];
  var _memset = Module["_memset"] = asm["_memset"];
  var _memcpy = Module["_memcpy"] = asm["_memcpy"];
  var _retro_serialize = Module["_retro_serialize"] = asm["_retro_serialize"];
  var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
  var __GLOBAL__sub_I_bind_cpp = Module["__GLOBAL__sub_I_bind_cpp"] = asm["__GLOBAL__sub_I_bind_cpp"];
  var _i64Add = Module["_i64Add"] = asm["_i64Add"];
  var ___getTypeName = Module["___getTypeName"] = asm["___getTypeName"];
  var _free = Module["_free"] = asm["_free"];
  var runPostSets = Module["runPostSets"] = asm["runPostSets"];
  var _retro_load_game = Module["_retro_load_game"] = asm["_retro_load_game"];
  var _retro_unserialize = Module["_retro_unserialize"] = asm["_retro_unserialize"];
  var _malloc = Module["_malloc"] = asm["_malloc"];
  var _emscripten_replace_memory = Module["_emscripten_replace_memory"] = asm["_emscripten_replace_memory"];
  var _strcpy = Module["_strcpy"] = asm["_strcpy"];
  var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
  var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
  var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
  var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
  var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
  var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
  var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];
  var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
  var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
  var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
  var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
  var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];
  Runtime.stackAlloc = asm["stackAlloc"];
  Runtime.stackSave = asm["stackSave"];
  Runtime.stackRestore = asm["stackRestore"];
  Runtime.establishStackSpace = asm["establishStackSpace"];
  Runtime.setTempRet0 = asm["setTempRet0"];
  Runtime.getTempRet0 = asm["getTempRet0"];
  var i64Math = (function() {
    var goog = {math: {}};
    goog.math.Long = (function(low, high) {
      this.low_ = low | 0;
      this.high_ = high | 0;
    });
    goog.math.Long.IntCache_ = {};
    goog.math.Long.fromInt = (function(value) {
      if (-128 <= value && value < 128) {
        var cachedObj = goog.math.Long.IntCache_[value];
        if (cachedObj) {
          return cachedObj;
        }
      }
      var obj = new goog.math.Long(value | 0, value < 0 ? -1 : 0);
      if (-128 <= value && value < 128) {
        goog.math.Long.IntCache_[value] = obj;
      }
      return obj;
    });
    goog.math.Long.fromNumber = (function(value) {
      if (isNaN(value) || !isFinite(value)) {
        return goog.math.Long.ZERO;
      } else if (value <= -goog.math.Long.TWO_PWR_63_DBL_) {
        return goog.math.Long.MIN_VALUE;
      } else if (value + 1 >= goog.math.Long.TWO_PWR_63_DBL_) {
        return goog.math.Long.MAX_VALUE;
      } else if (value < 0) {
        return goog.math.Long.fromNumber(-value).negate();
      } else {
        return new goog.math.Long(value % goog.math.Long.TWO_PWR_32_DBL_ | 0, value / goog.math.Long.TWO_PWR_32_DBL_ | 0);
      }
    });
    goog.math.Long.fromBits = (function(lowBits, highBits) {
      return new goog.math.Long(lowBits, highBits);
    });
    goog.math.Long.fromString = (function(str, opt_radix) {
      if (str.length == 0) {
        throw Error("number format error: empty string");
      }
      var radix = opt_radix || 10;
      if (radix < 2 || 36 < radix) {
        throw Error("radix out of range: " + radix);
      }
      if (str.charAt(0) == "-") {
        return goog.math.Long.fromString(str.substring(1), radix).negate();
      } else if (str.indexOf("-") >= 0) {
        throw Error('number format error: interior "-" character: ' + str);
      }
      var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 8));
      var result = goog.math.Long.ZERO;
      for (var i = 0; i < str.length; i += 8) {
        var size = Math.min(8, str.length - i);
        var value = parseInt(str.substring(i, i + size), radix);
        if (size < 8) {
          var power = goog.math.Long.fromNumber(Math.pow(radix, size));
          result = result.multiply(power).add(goog.math.Long.fromNumber(value));
        } else {
          result = result.multiply(radixToPower);
          result = result.add(goog.math.Long.fromNumber(value));
        }
      }
      return result;
    });
    goog.math.Long.TWO_PWR_16_DBL_ = 1 << 16;
    goog.math.Long.TWO_PWR_24_DBL_ = 1 << 24;
    goog.math.Long.TWO_PWR_32_DBL_ = goog.math.Long.TWO_PWR_16_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;
    goog.math.Long.TWO_PWR_31_DBL_ = goog.math.Long.TWO_PWR_32_DBL_ / 2;
    goog.math.Long.TWO_PWR_48_DBL_ = goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;
    goog.math.Long.TWO_PWR_64_DBL_ = goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_32_DBL_;
    goog.math.Long.TWO_PWR_63_DBL_ = goog.math.Long.TWO_PWR_64_DBL_ / 2;
    goog.math.Long.ZERO = goog.math.Long.fromInt(0);
    goog.math.Long.ONE = goog.math.Long.fromInt(1);
    goog.math.Long.NEG_ONE = goog.math.Long.fromInt(-1);
    goog.math.Long.MAX_VALUE = goog.math.Long.fromBits(4294967295 | 0, 2147483647 | 0);
    goog.math.Long.MIN_VALUE = goog.math.Long.fromBits(0, 2147483648 | 0);
    goog.math.Long.TWO_PWR_24_ = goog.math.Long.fromInt(1 << 24);
    goog.math.Long.prototype.toInt = (function() {
      return this.low_;
    });
    goog.math.Long.prototype.toNumber = (function() {
      return this.high_ * goog.math.Long.TWO_PWR_32_DBL_ + this.getLowBitsUnsigned();
    });
    goog.math.Long.prototype.toString = (function(opt_radix) {
      var radix = opt_radix || 10;
      if (radix < 2 || 36 < radix) {
        throw Error("radix out of range: " + radix);
      }
      if (this.isZero()) {
        return "0";
      }
      if (this.isNegative()) {
        if (this.equals(goog.math.Long.MIN_VALUE)) {
          var radixLong = goog.math.Long.fromNumber(radix);
          var div = this.div(radixLong);
          var rem = div.multiply(radixLong).subtract(this);
          return div.toString(radix) + rem.toInt().toString(radix);
        } else {
          return "-" + this.negate().toString(radix);
        }
      }
      var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 6));
      var rem = this;
      var result = "";
      while (true) {
        var remDiv = rem.div(radixToPower);
        var intval = rem.subtract(remDiv.multiply(radixToPower)).toInt();
        var digits = intval.toString(radix);
        rem = remDiv;
        if (rem.isZero()) {
          return digits + result;
        } else {
          while (digits.length < 6) {
            digits = "0" + digits;
          }
          result = "" + digits + result;
        }
      }
    });
    goog.math.Long.prototype.getHighBits = (function() {
      return this.high_;
    });
    goog.math.Long.prototype.getLowBits = (function() {
      return this.low_;
    });
    goog.math.Long.prototype.getLowBitsUnsigned = (function() {
      return this.low_ >= 0 ? this.low_ : goog.math.Long.TWO_PWR_32_DBL_ + this.low_;
    });
    goog.math.Long.prototype.getNumBitsAbs = (function() {
      if (this.isNegative()) {
        if (this.equals(goog.math.Long.MIN_VALUE)) {
          return 64;
        } else {
          return this.negate().getNumBitsAbs();
        }
      } else {
        var val = this.high_ != 0 ? this.high_ : this.low_;
        for (var bit = 31; bit > 0; bit--) {
          if ((val & 1 << bit) != 0) {
            break;
          }
        }
        return this.high_ != 0 ? bit + 33 : bit + 1;
      }
    });
    goog.math.Long.prototype.isZero = (function() {
      return this.high_ == 0 && this.low_ == 0;
    });
    goog.math.Long.prototype.isNegative = (function() {
      return this.high_ < 0;
    });
    goog.math.Long.prototype.isOdd = (function() {
      return (this.low_ & 1) == 1;
    });
    goog.math.Long.prototype.equals = (function(other) {
      return this.high_ == other.high_ && this.low_ == other.low_;
    });
    goog.math.Long.prototype.notEquals = (function(other) {
      return this.high_ != other.high_ || this.low_ != other.low_;
    });
    goog.math.Long.prototype.lessThan = (function(other) {
      return this.compare(other) < 0;
    });
    goog.math.Long.prototype.lessThanOrEqual = (function(other) {
      return this.compare(other) <= 0;
    });
    goog.math.Long.prototype.greaterThan = (function(other) {
      return this.compare(other) > 0;
    });
    goog.math.Long.prototype.greaterThanOrEqual = (function(other) {
      return this.compare(other) >= 0;
    });
    goog.math.Long.prototype.compare = (function(other) {
      if (this.equals(other)) {
        return 0;
      }
      var thisNeg = this.isNegative();
      var otherNeg = other.isNegative();
      if (thisNeg && !otherNeg) {
        return -1;
      }
      if (!thisNeg && otherNeg) {
        return 1;
      }
      if (this.subtract(other).isNegative()) {
        return -1;
      } else {
        return 1;
      }
    });
    goog.math.Long.prototype.negate = (function() {
      if (this.equals(goog.math.Long.MIN_VALUE)) {
        return goog.math.Long.MIN_VALUE;
      } else {
        return this.not().add(goog.math.Long.ONE);
      }
    });
    goog.math.Long.prototype.add = (function(other) {
      var a48 = this.high_ >>> 16;
      var a32 = this.high_ & 65535;
      var a16 = this.low_ >>> 16;
      var a00 = this.low_ & 65535;
      var b48 = other.high_ >>> 16;
      var b32 = other.high_ & 65535;
      var b16 = other.low_ >>> 16;
      var b00 = other.low_ & 65535;
      var c48 = 0,
          c32 = 0,
          c16 = 0,
          c00 = 0;
      c00 += a00 + b00;
      c16 += c00 >>> 16;
      c00 &= 65535;
      c16 += a16 + b16;
      c32 += c16 >>> 16;
      c16 &= 65535;
      c32 += a32 + b32;
      c48 += c32 >>> 16;
      c32 &= 65535;
      c48 += a48 + b48;
      c48 &= 65535;
      return goog.math.Long.fromBits(c16 << 16 | c00, c48 << 16 | c32);
    });
    goog.math.Long.prototype.subtract = (function(other) {
      return this.add(other.negate());
    });
    goog.math.Long.prototype.multiply = (function(other) {
      if (this.isZero()) {
        return goog.math.Long.ZERO;
      } else if (other.isZero()) {
        return goog.math.Long.ZERO;
      }
      if (this.equals(goog.math.Long.MIN_VALUE)) {
        return other.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
      } else if (other.equals(goog.math.Long.MIN_VALUE)) {
        return this.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
      }
      if (this.isNegative()) {
        if (other.isNegative()) {
          return this.negate().multiply(other.negate());
        } else {
          return this.negate().multiply(other).negate();
        }
      } else if (other.isNegative()) {
        return this.multiply(other.negate()).negate();
      }
      if (this.lessThan(goog.math.Long.TWO_PWR_24_) && other.lessThan(goog.math.Long.TWO_PWR_24_)) {
        return goog.math.Long.fromNumber(this.toNumber() * other.toNumber());
      }
      var a48 = this.high_ >>> 16;
      var a32 = this.high_ & 65535;
      var a16 = this.low_ >>> 16;
      var a00 = this.low_ & 65535;
      var b48 = other.high_ >>> 16;
      var b32 = other.high_ & 65535;
      var b16 = other.low_ >>> 16;
      var b00 = other.low_ & 65535;
      var c48 = 0,
          c32 = 0,
          c16 = 0,
          c00 = 0;
      c00 += a00 * b00;
      c16 += c00 >>> 16;
      c00 &= 65535;
      c16 += a16 * b00;
      c32 += c16 >>> 16;
      c16 &= 65535;
      c16 += a00 * b16;
      c32 += c16 >>> 16;
      c16 &= 65535;
      c32 += a32 * b00;
      c48 += c32 >>> 16;
      c32 &= 65535;
      c32 += a16 * b16;
      c48 += c32 >>> 16;
      c32 &= 65535;
      c32 += a00 * b32;
      c48 += c32 >>> 16;
      c32 &= 65535;
      c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
      c48 &= 65535;
      return goog.math.Long.fromBits(c16 << 16 | c00, c48 << 16 | c32);
    });
    goog.math.Long.prototype.div = (function(other) {
      if (other.isZero()) {
        throw Error("division by zero");
      } else if (this.isZero()) {
        return goog.math.Long.ZERO;
      }
      if (this.equals(goog.math.Long.MIN_VALUE)) {
        if (other.equals(goog.math.Long.ONE) || other.equals(goog.math.Long.NEG_ONE)) {
          return goog.math.Long.MIN_VALUE;
        } else if (other.equals(goog.math.Long.MIN_VALUE)) {
          return goog.math.Long.ONE;
        } else {
          var halfThis = this.shiftRight(1);
          var approx = halfThis.div(other).shiftLeft(1);
          if (approx.equals(goog.math.Long.ZERO)) {
            return other.isNegative() ? goog.math.Long.ONE : goog.math.Long.NEG_ONE;
          } else {
            var rem = this.subtract(other.multiply(approx));
            var result = approx.add(rem.div(other));
            return result;
          }
        }
      } else if (other.equals(goog.math.Long.MIN_VALUE)) {
        return goog.math.Long.ZERO;
      }
      if (this.isNegative()) {
        if (other.isNegative()) {
          return this.negate().div(other.negate());
        } else {
          return this.negate().div(other).negate();
        }
      } else if (other.isNegative()) {
        return this.div(other.negate()).negate();
      }
      var res = goog.math.Long.ZERO;
      var rem = this;
      while (rem.greaterThanOrEqual(other)) {
        var approx = Math.max(1, Math.floor(rem.toNumber() / other.toNumber()));
        var log2 = Math.ceil(Math.log(approx) / Math.LN2);
        var delta = log2 <= 48 ? 1 : Math.pow(2, log2 - 48);
        var approxRes = goog.math.Long.fromNumber(approx);
        var approxRem = approxRes.multiply(other);
        while (approxRem.isNegative() || approxRem.greaterThan(rem)) {
          approx -= delta;
          approxRes = goog.math.Long.fromNumber(approx);
          approxRem = approxRes.multiply(other);
        }
        if (approxRes.isZero()) {
          approxRes = goog.math.Long.ONE;
        }
        res = res.add(approxRes);
        rem = rem.subtract(approxRem);
      }
      return res;
    });
    goog.math.Long.prototype.modulo = (function(other) {
      return this.subtract(this.div(other).multiply(other));
    });
    goog.math.Long.prototype.not = (function() {
      return goog.math.Long.fromBits(~this.low_, ~this.high_);
    });
    goog.math.Long.prototype.and = (function(other) {
      return goog.math.Long.fromBits(this.low_ & other.low_, this.high_ & other.high_);
    });
    goog.math.Long.prototype.or = (function(other) {
      return goog.math.Long.fromBits(this.low_ | other.low_, this.high_ | other.high_);
    });
    goog.math.Long.prototype.xor = (function(other) {
      return goog.math.Long.fromBits(this.low_ ^ other.low_, this.high_ ^ other.high_);
    });
    goog.math.Long.prototype.shiftLeft = (function(numBits) {
      numBits &= 63;
      if (numBits == 0) {
        return this;
      } else {
        var low = this.low_;
        if (numBits < 32) {
          var high = this.high_;
          return goog.math.Long.fromBits(low << numBits, high << numBits | low >>> 32 - numBits);
        } else {
          return goog.math.Long.fromBits(0, low << numBits - 32);
        }
      }
    });
    goog.math.Long.prototype.shiftRight = (function(numBits) {
      numBits &= 63;
      if (numBits == 0) {
        return this;
      } else {
        var high = this.high_;
        if (numBits < 32) {
          var low = this.low_;
          return goog.math.Long.fromBits(low >>> numBits | high << 32 - numBits, high >> numBits);
        } else {
          return goog.math.Long.fromBits(high >> numBits - 32, high >= 0 ? 0 : -1);
        }
      }
    });
    goog.math.Long.prototype.shiftRightUnsigned = (function(numBits) {
      numBits &= 63;
      if (numBits == 0) {
        return this;
      } else {
        var high = this.high_;
        if (numBits < 32) {
          var low = this.low_;
          return goog.math.Long.fromBits(low >>> numBits | high << 32 - numBits, high >>> numBits);
        } else if (numBits == 32) {
          return goog.math.Long.fromBits(high, 0);
        } else {
          return goog.math.Long.fromBits(high >>> numBits - 32, 0);
        }
      }
    });
    var navigator = {appName: "Modern Browser"};
    var dbits;
    var canary = 0xdeadbeefcafe;
    var j_lm = (canary & 16777215) == 15715070;
    function BigInteger(a, b, c) {
      if (a != null)
        if ("number" == typeof a)
          this.fromNumber(a, b, c);
        else if (b == null && "string" != typeof a)
          this.fromString(a, 256);
        else
          this.fromString(a, b);
    }
    function nbi() {
      return new BigInteger(null);
    }
    function am1(i, x, w, j, c, n) {
      while (--n >= 0) {
        var v = x * this[i++] + w[j] + c;
        c = Math.floor(v / 67108864);
        w[j++] = v & 67108863;
      }
      return c;
    }
    function am2(i, x, w, j, c, n) {
      var xl = x & 32767,
          xh = x >> 15;
      while (--n >= 0) {
        var l = this[i] & 32767;
        var h = this[i++] >> 15;
        var m = xh * l + h * xl;
        l = xl * l + ((m & 32767) << 15) + w[j] + (c & 1073741823);
        c = (l >>> 30) + (m >>> 15) + xh * h + (c >>> 30);
        w[j++] = l & 1073741823;
      }
      return c;
    }
    function am3(i, x, w, j, c, n) {
      var xl = x & 16383,
          xh = x >> 14;
      while (--n >= 0) {
        var l = this[i] & 16383;
        var h = this[i++] >> 14;
        var m = xh * l + h * xl;
        l = xl * l + ((m & 16383) << 14) + w[j] + c;
        c = (l >> 28) + (m >> 14) + xh * h;
        w[j++] = l & 268435455;
      }
      return c;
    }
    if (j_lm && navigator.appName == "Microsoft Internet Explorer") {
      BigInteger.prototype.am = am2;
      dbits = 30;
    } else if (j_lm && navigator.appName != "Netscape") {
      BigInteger.prototype.am = am1;
      dbits = 26;
    } else {
      BigInteger.prototype.am = am3;
      dbits = 28;
    }
    BigInteger.prototype.DB = dbits;
    BigInteger.prototype.DM = (1 << dbits) - 1;
    BigInteger.prototype.DV = 1 << dbits;
    var BI_FP = 52;
    BigInteger.prototype.FV = Math.pow(2, BI_FP);
    BigInteger.prototype.F1 = BI_FP - dbits;
    BigInteger.prototype.F2 = 2 * dbits - BI_FP;
    var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
    var BI_RC = new Array;
    var rr,
        vv;
    rr = "0".charCodeAt(0);
    for (vv = 0; vv <= 9; ++vv)
      BI_RC[rr++] = vv;
    rr = "a".charCodeAt(0);
    for (vv = 10; vv < 36; ++vv)
      BI_RC[rr++] = vv;
    rr = "A".charCodeAt(0);
    for (vv = 10; vv < 36; ++vv)
      BI_RC[rr++] = vv;
    function int2char(n) {
      return BI_RM.charAt(n);
    }
    function intAt(s, i) {
      var c = BI_RC[s.charCodeAt(i)];
      return c == null ? -1 : c;
    }
    function bnpCopyTo(r) {
      for (var i = this.t - 1; i >= 0; --i)
        r[i] = this[i];
      r.t = this.t;
      r.s = this.s;
    }
    function bnpFromInt(x) {
      this.t = 1;
      this.s = x < 0 ? -1 : 0;
      if (x > 0)
        this[0] = x;
      else if (x < -1)
        this[0] = x + DV;
      else
        this.t = 0;
    }
    function nbv(i) {
      var r = nbi();
      r.fromInt(i);
      return r;
    }
    function bnpFromString(s, b) {
      var k;
      if (b == 16)
        k = 4;
      else if (b == 8)
        k = 3;
      else if (b == 256)
        k = 8;
      else if (b == 2)
        k = 1;
      else if (b == 32)
        k = 5;
      else if (b == 4)
        k = 2;
      else {
        this.fromRadix(s, b);
        return ;
      }
      this.t = 0;
      this.s = 0;
      var i = s.length,
          mi = false,
          sh = 0;
      while (--i >= 0) {
        var x = k == 8 ? s[i] & 255 : intAt(s, i);
        if (x < 0) {
          if (s.charAt(i) == "-")
            mi = true;
          continue;
        }
        mi = false;
        if (sh == 0)
          this[this.t++] = x;
        else if (sh + k > this.DB) {
          this[this.t - 1] |= (x & (1 << this.DB - sh) - 1) << sh;
          this[this.t++] = x >> this.DB - sh;
        } else
          this[this.t - 1] |= x << sh;
        sh += k;
        if (sh >= this.DB)
          sh -= this.DB;
      }
      if (k == 8 && (s[0] & 128) != 0) {
        this.s = -1;
        if (sh > 0)
          this[this.t - 1] |= (1 << this.DB - sh) - 1 << sh;
      }
      this.clamp();
      if (mi)
        BigInteger.ZERO.subTo(this, this);
    }
    function bnpClamp() {
      var c = this.s & this.DM;
      while (this.t > 0 && this[this.t - 1] == c)
        --this.t;
    }
    function bnToString(b) {
      if (this.s < 0)
        return "-" + this.negate().toString(b);
      var k;
      if (b == 16)
        k = 4;
      else if (b == 8)
        k = 3;
      else if (b == 2)
        k = 1;
      else if (b == 32)
        k = 5;
      else if (b == 4)
        k = 2;
      else
        return this.toRadix(b);
      var km = (1 << k) - 1,
          d,
          m = false,
          r = "",
          i = this.t;
      var p = this.DB - i * this.DB % k;
      if (i-- > 0) {
        if (p < this.DB && (d = this[i] >> p) > 0) {
          m = true;
          r = int2char(d);
        }
        while (i >= 0) {
          if (p < k) {
            d = (this[i] & (1 << p) - 1) << k - p;
            d |= this[--i] >> (p += this.DB - k);
          } else {
            d = this[i] >> (p -= k) & km;
            if (p <= 0) {
              p += this.DB;
              --i;
            }
          }
          if (d > 0)
            m = true;
          if (m)
            r += int2char(d);
        }
      }
      return m ? r : "0";
    }
    function bnNegate() {
      var r = nbi();
      BigInteger.ZERO.subTo(this, r);
      return r;
    }
    function bnAbs() {
      return this.s < 0 ? this.negate() : this;
    }
    function bnCompareTo(a) {
      var r = this.s - a.s;
      if (r != 0)
        return r;
      var i = this.t;
      r = i - a.t;
      if (r != 0)
        return this.s < 0 ? -r : r;
      while (--i >= 0)
        if ((r = this[i] - a[i]) != 0)
          return r;
      return 0;
    }
    function nbits(x) {
      var r = 1,
          t;
      if ((t = x >>> 16) != 0) {
        x = t;
        r += 16;
      }
      if ((t = x >> 8) != 0) {
        x = t;
        r += 8;
      }
      if ((t = x >> 4) != 0) {
        x = t;
        r += 4;
      }
      if ((t = x >> 2) != 0) {
        x = t;
        r += 2;
      }
      if ((t = x >> 1) != 0) {
        x = t;
        r += 1;
      }
      return r;
    }
    function bnBitLength() {
      if (this.t <= 0)
        return 0;
      return this.DB * (this.t - 1) + nbits(this[this.t - 1] ^ this.s & this.DM);
    }
    function bnpDLShiftTo(n, r) {
      var i;
      for (i = this.t - 1; i >= 0; --i)
        r[i + n] = this[i];
      for (i = n - 1; i >= 0; --i)
        r[i] = 0;
      r.t = this.t + n;
      r.s = this.s;
    }
    function bnpDRShiftTo(n, r) {
      for (var i = n; i < this.t; ++i)
        r[i - n] = this[i];
      r.t = Math.max(this.t - n, 0);
      r.s = this.s;
    }
    function bnpLShiftTo(n, r) {
      var bs = n % this.DB;
      var cbs = this.DB - bs;
      var bm = (1 << cbs) - 1;
      var ds = Math.floor(n / this.DB),
          c = this.s << bs & this.DM,
          i;
      for (i = this.t - 1; i >= 0; --i) {
        r[i + ds + 1] = this[i] >> cbs | c;
        c = (this[i] & bm) << bs;
      }
      for (i = ds - 1; i >= 0; --i)
        r[i] = 0;
      r[ds] = c;
      r.t = this.t + ds + 1;
      r.s = this.s;
      r.clamp();
    }
    function bnpRShiftTo(n, r) {
      r.s = this.s;
      var ds = Math.floor(n / this.DB);
      if (ds >= this.t) {
        r.t = 0;
        return ;
      }
      var bs = n % this.DB;
      var cbs = this.DB - bs;
      var bm = (1 << bs) - 1;
      r[0] = this[ds] >> bs;
      for (var i = ds + 1; i < this.t; ++i) {
        r[i - ds - 1] |= (this[i] & bm) << cbs;
        r[i - ds] = this[i] >> bs;
      }
      if (bs > 0)
        r[this.t - ds - 1] |= (this.s & bm) << cbs;
      r.t = this.t - ds;
      r.clamp();
    }
    function bnpSubTo(a, r) {
      var i = 0,
          c = 0,
          m = Math.min(a.t, this.t);
      while (i < m) {
        c += this[i] - a[i];
        r[i++] = c & this.DM;
        c >>= this.DB;
      }
      if (a.t < this.t) {
        c -= a.s;
        while (i < this.t) {
          c += this[i];
          r[i++] = c & this.DM;
          c >>= this.DB;
        }
        c += this.s;
      } else {
        c += this.s;
        while (i < a.t) {
          c -= a[i];
          r[i++] = c & this.DM;
          c >>= this.DB;
        }
        c -= a.s;
      }
      r.s = c < 0 ? -1 : 0;
      if (c < -1)
        r[i++] = this.DV + c;
      else if (c > 0)
        r[i++] = c;
      r.t = i;
      r.clamp();
    }
    function bnpMultiplyTo(a, r) {
      var x = this.abs(),
          y = a.abs();
      var i = x.t;
      r.t = i + y.t;
      while (--i >= 0)
        r[i] = 0;
      for (i = 0; i < y.t; ++i)
        r[i + x.t] = x.am(0, y[i], r, i, 0, x.t);
      r.s = 0;
      r.clamp();
      if (this.s != a.s)
        BigInteger.ZERO.subTo(r, r);
    }
    function bnpSquareTo(r) {
      var x = this.abs();
      var i = r.t = 2 * x.t;
      while (--i >= 0)
        r[i] = 0;
      for (i = 0; i < x.t - 1; ++i) {
        var c = x.am(i, x[i], r, 2 * i, 0, 1);
        if ((r[i + x.t] += x.am(i + 1, 2 * x[i], r, 2 * i + 1, c, x.t - i - 1)) >= x.DV) {
          r[i + x.t] -= x.DV;
          r[i + x.t + 1] = 1;
        }
      }
      if (r.t > 0)
        r[r.t - 1] += x.am(i, x[i], r, 2 * i, 0, 1);
      r.s = 0;
      r.clamp();
    }
    function bnpDivRemTo(m, q, r) {
      var pm = m.abs();
      if (pm.t <= 0)
        return ;
      var pt = this.abs();
      if (pt.t < pm.t) {
        if (q != null)
          q.fromInt(0);
        if (r != null)
          this.copyTo(r);
        return ;
      }
      if (r == null)
        r = nbi();
      var y = nbi(),
          ts = this.s,
          ms = m.s;
      var nsh = this.DB - nbits(pm[pm.t - 1]);
      if (nsh > 0) {
        pm.lShiftTo(nsh, y);
        pt.lShiftTo(nsh, r);
      } else {
        pm.copyTo(y);
        pt.copyTo(r);
      }
      var ys = y.t;
      var y0 = y[ys - 1];
      if (y0 == 0)
        return ;
      var yt = y0 * (1 << this.F1) + (ys > 1 ? y[ys - 2] >> this.F2 : 0);
      var d1 = this.FV / yt,
          d2 = (1 << this.F1) / yt,
          e = 1 << this.F2;
      var i = r.t,
          j = i - ys,
          t = q == null ? nbi() : q;
      y.dlShiftTo(j, t);
      if (r.compareTo(t) >= 0) {
        r[r.t++] = 1;
        r.subTo(t, r);
      }
      BigInteger.ONE.dlShiftTo(ys, t);
      t.subTo(y, y);
      while (y.t < ys)
        y[y.t++] = 0;
      while (--j >= 0) {
        var qd = r[--i] == y0 ? this.DM : Math.floor(r[i] * d1 + (r[i - 1] + e) * d2);
        if ((r[i] += y.am(0, qd, r, j, 0, ys)) < qd) {
          y.dlShiftTo(j, t);
          r.subTo(t, r);
          while (r[i] < --qd)
            r.subTo(t, r);
        }
      }
      if (q != null) {
        r.drShiftTo(ys, q);
        if (ts != ms)
          BigInteger.ZERO.subTo(q, q);
      }
      r.t = ys;
      r.clamp();
      if (nsh > 0)
        r.rShiftTo(nsh, r);
      if (ts < 0)
        BigInteger.ZERO.subTo(r, r);
    }
    function bnMod(a) {
      var r = nbi();
      this.abs().divRemTo(a, null, r);
      if (this.s < 0 && r.compareTo(BigInteger.ZERO) > 0)
        a.subTo(r, r);
      return r;
    }
    function Classic(m) {
      this.m = m;
    }
    function cConvert(x) {
      if (x.s < 0 || x.compareTo(this.m) >= 0)
        return x.mod(this.m);
      else
        return x;
    }
    function cRevert(x) {
      return x;
    }
    function cReduce(x) {
      x.divRemTo(this.m, null, x);
    }
    function cMulTo(x, y, r) {
      x.multiplyTo(y, r);
      this.reduce(r);
    }
    function cSqrTo(x, r) {
      x.squareTo(r);
      this.reduce(r);
    }
    Classic.prototype.convert = cConvert;
    Classic.prototype.revert = cRevert;
    Classic.prototype.reduce = cReduce;
    Classic.prototype.mulTo = cMulTo;
    Classic.prototype.sqrTo = cSqrTo;
    function bnpInvDigit() {
      if (this.t < 1)
        return 0;
      var x = this[0];
      if ((x & 1) == 0)
        return 0;
      var y = x & 3;
      y = y * (2 - (x & 15) * y) & 15;
      y = y * (2 - (x & 255) * y) & 255;
      y = y * (2 - ((x & 65535) * y & 65535)) & 65535;
      y = y * (2 - x * y % this.DV) % this.DV;
      return y > 0 ? this.DV - y : -y;
    }
    function Montgomery(m) {
      this.m = m;
      this.mp = m.invDigit();
      this.mpl = this.mp & 32767;
      this.mph = this.mp >> 15;
      this.um = (1 << m.DB - 15) - 1;
      this.mt2 = 2 * m.t;
    }
    function montConvert(x) {
      var r = nbi();
      x.abs().dlShiftTo(this.m.t, r);
      r.divRemTo(this.m, null, r);
      if (x.s < 0 && r.compareTo(BigInteger.ZERO) > 0)
        this.m.subTo(r, r);
      return r;
    }
    function montRevert(x) {
      var r = nbi();
      x.copyTo(r);
      this.reduce(r);
      return r;
    }
    function montReduce(x) {
      while (x.t <= this.mt2)
        x[x.t++] = 0;
      for (var i = 0; i < this.m.t; ++i) {
        var j = x[i] & 32767;
        var u0 = j * this.mpl + ((j * this.mph + (x[i] >> 15) * this.mpl & this.um) << 15) & x.DM;
        j = i + this.m.t;
        x[j] += this.m.am(0, u0, x, i, 0, this.m.t);
        while (x[j] >= x.DV) {
          x[j] -= x.DV;
          x[++j]++;
        }
      }
      x.clamp();
      x.drShiftTo(this.m.t, x);
      if (x.compareTo(this.m) >= 0)
        x.subTo(this.m, x);
    }
    function montSqrTo(x, r) {
      x.squareTo(r);
      this.reduce(r);
    }
    function montMulTo(x, y, r) {
      x.multiplyTo(y, r);
      this.reduce(r);
    }
    Montgomery.prototype.convert = montConvert;
    Montgomery.prototype.revert = montRevert;
    Montgomery.prototype.reduce = montReduce;
    Montgomery.prototype.mulTo = montMulTo;
    Montgomery.prototype.sqrTo = montSqrTo;
    function bnpIsEven() {
      return (this.t > 0 ? this[0] & 1 : this.s) == 0;
    }
    function bnpExp(e, z) {
      if (e > 4294967295 || e < 1)
        return BigInteger.ONE;
      var r = nbi(),
          r2 = nbi(),
          g = z.convert(this),
          i = nbits(e) - 1;
      g.copyTo(r);
      while (--i >= 0) {
        z.sqrTo(r, r2);
        if ((e & 1 << i) > 0)
          z.mulTo(r2, g, r);
        else {
          var t = r;
          r = r2;
          r2 = t;
        }
      }
      return z.revert(r);
    }
    function bnModPowInt(e, m) {
      var z;
      if (e < 256 || m.isEven())
        z = new Classic(m);
      else
        z = new Montgomery(m);
      return this.exp(e, z);
    }
    BigInteger.prototype.copyTo = bnpCopyTo;
    BigInteger.prototype.fromInt = bnpFromInt;
    BigInteger.prototype.fromString = bnpFromString;
    BigInteger.prototype.clamp = bnpClamp;
    BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
    BigInteger.prototype.drShiftTo = bnpDRShiftTo;
    BigInteger.prototype.lShiftTo = bnpLShiftTo;
    BigInteger.prototype.rShiftTo = bnpRShiftTo;
    BigInteger.prototype.subTo = bnpSubTo;
    BigInteger.prototype.multiplyTo = bnpMultiplyTo;
    BigInteger.prototype.squareTo = bnpSquareTo;
    BigInteger.prototype.divRemTo = bnpDivRemTo;
    BigInteger.prototype.invDigit = bnpInvDigit;
    BigInteger.prototype.isEven = bnpIsEven;
    BigInteger.prototype.exp = bnpExp;
    BigInteger.prototype.toString = bnToString;
    BigInteger.prototype.negate = bnNegate;
    BigInteger.prototype.abs = bnAbs;
    BigInteger.prototype.compareTo = bnCompareTo;
    BigInteger.prototype.bitLength = bnBitLength;
    BigInteger.prototype.mod = bnMod;
    BigInteger.prototype.modPowInt = bnModPowInt;
    BigInteger.ZERO = nbv(0);
    BigInteger.ONE = nbv(1);
    function bnpFromRadix(s, b) {
      this.fromInt(0);
      if (b == null)
        b = 10;
      var cs = this.chunkSize(b);
      var d = Math.pow(b, cs),
          mi = false,
          j = 0,
          w = 0;
      for (var i = 0; i < s.length; ++i) {
        var x = intAt(s, i);
        if (x < 0) {
          if (s.charAt(i) == "-" && this.signum() == 0)
            mi = true;
          continue;
        }
        w = b * w + x;
        if (++j >= cs) {
          this.dMultiply(d);
          this.dAddOffset(w, 0);
          j = 0;
          w = 0;
        }
      }
      if (j > 0) {
        this.dMultiply(Math.pow(b, j));
        this.dAddOffset(w, 0);
      }
      if (mi)
        BigInteger.ZERO.subTo(this, this);
    }
    function bnpChunkSize(r) {
      return Math.floor(Math.LN2 * this.DB / Math.log(r));
    }
    function bnSigNum() {
      if (this.s < 0)
        return -1;
      else if (this.t <= 0 || this.t == 1 && this[0] <= 0)
        return 0;
      else
        return 1;
    }
    function bnpDMultiply(n) {
      this[this.t] = this.am(0, n - 1, this, 0, 0, this.t);
      ++this.t;
      this.clamp();
    }
    function bnpDAddOffset(n, w) {
      if (n == 0)
        return ;
      while (this.t <= w)
        this[this.t++] = 0;
      this[w] += n;
      while (this[w] >= this.DV) {
        this[w] -= this.DV;
        if (++w >= this.t)
          this[this.t++] = 0;
        ++this[w];
      }
    }
    function bnpToRadix(b) {
      if (b == null)
        b = 10;
      if (this.signum() == 0 || b < 2 || b > 36)
        return "0";
      var cs = this.chunkSize(b);
      var a = Math.pow(b, cs);
      var d = nbv(a),
          y = nbi(),
          z = nbi(),
          r = "";
      this.divRemTo(d, y, z);
      while (y.signum() > 0) {
        r = (a + z.intValue()).toString(b).substr(1) + r;
        y.divRemTo(d, y, z);
      }
      return z.intValue().toString(b) + r;
    }
    function bnIntValue() {
      if (this.s < 0) {
        if (this.t == 1)
          return this[0] - this.DV;
        else if (this.t == 0)
          return -1;
      } else if (this.t == 1)
        return this[0];
      else if (this.t == 0)
        return 0;
      return (this[1] & (1 << 32 - this.DB) - 1) << this.DB | this[0];
    }
    function bnpAddTo(a, r) {
      var i = 0,
          c = 0,
          m = Math.min(a.t, this.t);
      while (i < m) {
        c += this[i] + a[i];
        r[i++] = c & this.DM;
        c >>= this.DB;
      }
      if (a.t < this.t) {
        c += a.s;
        while (i < this.t) {
          c += this[i];
          r[i++] = c & this.DM;
          c >>= this.DB;
        }
        c += this.s;
      } else {
        c += this.s;
        while (i < a.t) {
          c += a[i];
          r[i++] = c & this.DM;
          c >>= this.DB;
        }
        c += a.s;
      }
      r.s = c < 0 ? -1 : 0;
      if (c > 0)
        r[i++] = c;
      else if (c < -1)
        r[i++] = this.DV + c;
      r.t = i;
      r.clamp();
    }
    BigInteger.prototype.fromRadix = bnpFromRadix;
    BigInteger.prototype.chunkSize = bnpChunkSize;
    BigInteger.prototype.signum = bnSigNum;
    BigInteger.prototype.dMultiply = bnpDMultiply;
    BigInteger.prototype.dAddOffset = bnpDAddOffset;
    BigInteger.prototype.toRadix = bnpToRadix;
    BigInteger.prototype.intValue = bnIntValue;
    BigInteger.prototype.addTo = bnpAddTo;
    var Wrapper = {
      abs: (function(l, h) {
        var x = new goog.math.Long(l, h);
        var ret;
        if (x.isNegative()) {
          ret = x.negate();
        } else {
          ret = x;
        }
        HEAP32[tempDoublePtr >> 2] = ret.low_;
        HEAP32[tempDoublePtr + 4 >> 2] = ret.high_;
      }),
      ensureTemps: (function() {
        if (Wrapper.ensuredTemps)
          return ;
        Wrapper.ensuredTemps = true;
        Wrapper.two32 = new BigInteger;
        Wrapper.two32.fromString("4294967296", 10);
        Wrapper.two64 = new BigInteger;
        Wrapper.two64.fromString("18446744073709551616", 10);
        Wrapper.temp1 = new BigInteger;
        Wrapper.temp2 = new BigInteger;
      }),
      lh2bignum: (function(l, h) {
        var a = new BigInteger;
        a.fromString(h.toString(), 10);
        var b = new BigInteger;
        a.multiplyTo(Wrapper.two32, b);
        var c = new BigInteger;
        c.fromString(l.toString(), 10);
        var d = new BigInteger;
        c.addTo(b, d);
        return d;
      }),
      stringify: (function(l, h, unsigned) {
        var ret = (new goog.math.Long(l, h)).toString();
        if (unsigned && ret[0] == "-") {
          Wrapper.ensureTemps();
          var bignum = new BigInteger;
          bignum.fromString(ret, 10);
          ret = new BigInteger;
          Wrapper.two64.addTo(bignum, ret);
          ret = ret.toString(10);
        }
        return ret;
      }),
      fromString: (function(str, base, min, max, unsigned) {
        Wrapper.ensureTemps();
        var bignum = new BigInteger;
        bignum.fromString(str, base);
        var bigmin = new BigInteger;
        bigmin.fromString(min, 10);
        var bigmax = new BigInteger;
        bigmax.fromString(max, 10);
        if (unsigned && bignum.compareTo(BigInteger.ZERO) < 0) {
          var temp = new BigInteger;
          bignum.addTo(Wrapper.two64, temp);
          bignum = temp;
        }
        var error = false;
        if (bignum.compareTo(bigmin) < 0) {
          bignum = bigmin;
          error = true;
        } else if (bignum.compareTo(bigmax) > 0) {
          bignum = bigmax;
          error = true;
        }
        var ret = goog.math.Long.fromString(bignum.toString());
        HEAP32[tempDoublePtr >> 2] = ret.low_;
        HEAP32[tempDoublePtr + 4 >> 2] = ret.high_;
        if (error)
          throw "range error";
      })
    };
    return Wrapper;
  })();
  function ExitStatus(status) {
    this.name = "ExitStatus";
    this.message = "Program terminated with exit(" + status + ")";
    this.status = status;
  }
  ExitStatus.prototype = new Error;
  ExitStatus.prototype.constructor = ExitStatus;
  var initialStackTop;
  var preloadStartTime = null;
  var calledMain = false;
  dependenciesFulfilled = function runCaller() {
    if (!Module["calledRun"])
      run();
    if (!Module["calledRun"])
      dependenciesFulfilled = runCaller;
  };
  Module["callMain"] = Module.callMain = function callMain(args) {
    assert(runDependencies == 0, "cannot call main when async dependencies remain! (listen on __ATMAIN__)");
    assert(__ATPRERUN__.length == 0, "cannot call main when preRun functions remain to be called");
    args = args || [];
    ensureInitRuntime();
    var argc = args.length + 1;
    function pad() {
      for (var i = 0; i < 4 - 1; i++) {
        argv.push(0);
      }
    }
    var argv = [allocate(intArrayFromString(Module["thisProgram"]), "i8", ALLOC_NORMAL)];
    pad();
    for (var i = 0; i < argc - 1; i = i + 1) {
      argv.push(allocate(intArrayFromString(args[i]), "i8", ALLOC_NORMAL));
      pad();
    }
    argv.push(0);
    argv = allocate(argv, "i32", ALLOC_NORMAL);
    initialStackTop = STACKTOP;
    try {
      var ret = Module["_main"](argc, argv, 0);
      exit(ret, true);
    } catch (e) {
      if (e instanceof ExitStatus) {
        return ;
      } else if (e == "SimulateInfiniteLoop") {
        Module["noExitRuntime"] = true;
        return ;
      } else {
        if (e && typeof e === "object" && e.stack)
          Module.printErr("exception thrown: " + [e, e.stack]);
        throw e;
      }
    } finally {
      calledMain = true;
    }
  };
  function run(args) {
    args = args || Module["arguments"];
    if (preloadStartTime === null)
      preloadStartTime = Date.now();
    if (runDependencies > 0) {
      return ;
    }
    preRun();
    if (runDependencies > 0)
      return ;
    if (Module["calledRun"])
      return ;
    function doRun() {
      if (Module["calledRun"])
        return ;
      Module["calledRun"] = true;
      if (ABORT)
        return ;
      ensureInitRuntime();
      preMain();
      if (ENVIRONMENT_IS_WEB && preloadStartTime !== null) {
        Module.printErr("pre-main prep time: " + (Date.now() - preloadStartTime) + " ms");
      }
      if (Module["onRuntimeInitialized"])
        Module["onRuntimeInitialized"]();
      if (Module["_main"] && shouldRunNow)
        Module["callMain"](args);
      postRun();
    }
    if (Module["setStatus"]) {
      Module["setStatus"]("Running...");
      setTimeout((function() {
        setTimeout((function() {
          Module["setStatus"]("");
        }), 1);
        doRun();
      }), 1);
    } else {
      doRun();
    }
  }
  Module["run"] = Module.run = run;
  function exit(status, implicit) {
    if (implicit && Module["noExitRuntime"]) {
      return ;
    }
    if (Module["noExitRuntime"]) {} else {
      ABORT = true;
      EXITSTATUS = status;
      STACKTOP = initialStackTop;
      exitRuntime();
      if (Module["onExit"])
        Module["onExit"](status);
    }
    if (ENVIRONMENT_IS_NODE) {
      process["stdout"]["once"]("drain", (function() {
        process["exit"](status);
      }));
      console.log(" ");
      setTimeout((function() {
        process["exit"](status);
      }), 500);
    } else if (ENVIRONMENT_IS_SHELL && typeof quit === "function") {
      quit(status);
    }
    throw new ExitStatus(status);
  }
  Module["exit"] = Module.exit = exit;
  var abortDecorators = [];
  function abort(what) {
    if (what !== undefined) {
      Module.print(what);
      Module.printErr(what);
      what = JSON.stringify(what);
    } else {
      what = "";
    }
    ABORT = true;
    EXITSTATUS = 1;
    var extra = "\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.";
    var output = "abort(" + what + ") at " + stackTrace() + extra;
    if (abortDecorators) {
      abortDecorators.forEach((function(decorator) {
        output = decorator(output, what);
      }));
    }
    throw output;
  }
  Module["abort"] = Module.abort = abort;
  if (Module["preInit"]) {
    if (typeof Module["preInit"] == "function")
      Module["preInit"] = [Module["preInit"]];
    while (Module["preInit"].length > 0) {
      Module["preInit"].pop()();
    }
  }
  var shouldRunNow = true;
  if (Module["noInitialRun"]) {
    shouldRunNow = false;
  }
  run();
  module.exports = Module;
})(require("buffer").Buffer, require("process"));
