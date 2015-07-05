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
  STATICTOP = STATIC_BASE + 2591808;
  __ATINIT__.push({func: (function() {
      __GLOBAL__sub_I_libretro_emscripten_cpp();
    })}, {func: (function() {
      __GLOBAL__sub_I_bind_cpp();
    })});
  allocate([36, 138, 34, 0, 174, 192, 38, 0, 36, 138, 34, 0, 163, 192, 38, 0, 36, 138, 34, 0, 152, 192, 38, 0, 36, 138, 34, 0, 134, 192, 38, 0, 36, 138, 34, 0, 112, 192, 38, 0, 36, 138, 34, 0, 90, 192, 38, 0, 36, 138, 34, 0, 68, 192, 38, 0, 36, 138, 34, 0, 44, 192, 38, 0, 36, 138, 34, 0, 23, 192, 38, 0, 144, 138, 34, 0, 188, 138, 39, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 144, 138, 34, 0, 125, 138, 39, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 144, 138, 34, 0, 24, 138, 39, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 64, 138, 34, 0, 5, 138, 39, 0, 64, 138, 34, 0, 230, 137, 39, 0, 64, 138, 34, 0, 199, 137, 39, 0, 64, 138, 34, 0, 168, 137, 39, 0, 64, 138, 34, 0, 137, 137, 39, 0, 64, 138, 34, 0, 106, 137, 39, 0, 64, 138, 34, 0, 75, 137, 39, 0, 64, 138, 34, 0, 44, 137, 39, 0, 64, 138, 34, 0, 13, 137, 39, 0, 64, 138, 34, 0, 238, 136, 39, 0, 64, 138, 34, 0, 207, 136, 39, 0, 64, 138, 34, 0, 176, 136, 39, 0, 64, 138, 34, 0, 145, 136, 39, 0, 64, 138, 34, 0, 87, 138, 39, 0, 64, 138, 34, 0, 251, 138, 39, 0, 104, 138, 34, 0, 8, 139, 39, 0, 8, 1, 0, 0, 0, 0, 0, 0, 104, 138, 34, 0, 41, 139, 39, 0, 16, 1, 0, 0, 0, 0, 0, 0, 104, 138, 34, 0, 111, 139, 39, 0, 16, 1, 0, 0, 0, 0, 0, 0, 104, 138, 34, 0, 75, 139, 39, 0, 48, 1, 0, 0, 0, 0, 0, 0, 104, 138, 34, 0, 145, 139, 39, 0, 16, 1, 0, 0, 0, 0, 0, 0, 8, 138, 34, 0, 185, 139, 39, 0, 184, 138, 34, 0, 187, 139, 39, 0, 0, 0, 0, 0, 96, 1, 0, 0, 8, 138, 34, 0, 190, 139, 39, 0, 8, 138, 34, 0, 193, 139, 39, 0, 8, 138, 34, 0, 195, 139, 39, 0, 8, 138, 34, 0, 197, 139, 39, 0, 8, 138, 34, 0, 199, 139, 39, 0, 8, 138, 34, 0, 201, 139, 39, 0, 8, 138, 34, 0, 203, 139, 39, 0, 8, 138, 34, 0, 205, 139, 39, 0, 8, 138, 34, 0, 207, 139, 39, 0, 8, 138, 34, 0, 209, 139, 39, 0, 8, 138, 34, 0, 211, 139, 39, 0, 8, 138, 34, 0, 213, 139, 39, 0, 8, 138, 34, 0, 215, 139, 39, 0, 104, 138, 34, 0, 217, 139, 39, 0, 16, 1, 0, 0, 0, 0, 0, 0, 104, 138, 34, 0, 250, 139, 39, 0, 32, 1, 0, 0, 0, 0, 0, 0, 104, 138, 34, 0, 31, 140, 39, 0, 32, 1, 0, 0, 0, 0, 0, 0, 96, 1, 0, 0, 184, 1, 0, 0, 184, 1, 0, 0, 184, 1, 0, 0, 96, 1, 0, 0, 184, 1, 0, 0, 184, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 69, 133, 39, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 74, 133, 39, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 77, 133, 39, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 82, 133, 39, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 88, 133, 39, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 90, 133, 39, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 92, 133, 39, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 94, 133, 39, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 69, 133, 39, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 74, 133, 39, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 77, 133, 39, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 82, 133, 39, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 88, 133, 39, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 90, 133, 39, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 92, 133, 39, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 94, 133, 39], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);
  allocate([108, 3, 0, 0, 112, 3, 0, 0, 116, 3, 0, 0, 120, 3, 0, 0, 0, 0, 0, 0, 80, 1, 0, 0, 42, 0, 0, 0, 43, 0, 0, 0, 44, 0, 0, 0, 45, 0, 0, 0, 42, 0, 0, 0, 0, 0, 0, 0, 224, 1, 0, 0, 42, 0, 0, 0, 46, 0, 0, 0, 44, 0, 0, 0, 45, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0, 32, 1, 0, 0, 42, 0, 0, 0, 47, 0, 0, 0, 44, 0, 0, 0, 45, 0, 0, 0, 44, 0, 0, 0, 42, 0, 0, 0, 42, 0, 0, 0, 42, 0, 0, 0, 0, 0, 0, 0, 240, 1, 0, 0, 42, 0, 0, 0, 48, 0, 0, 0, 44, 0, 0, 0, 45, 0, 0, 0, 44, 0, 0, 0, 43, 0, 0, 0, 43, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 42, 0, 0, 0, 49, 0, 0, 0, 44, 0, 0, 0, 45, 0, 0, 0, 44, 0, 0, 0, 44, 0, 0, 0, 44, 0, 0, 0, 44, 0, 0, 0, 0, 0, 0, 0, 64, 1, 0, 0, 42, 0, 0, 0, 50, 0, 0, 0, 44, 0, 0, 0, 45, 0, 0, 0, 45], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 2263528);
  allocate([65, 80, 73, 95, 86, 69, 82, 83, 73, 79, 78, 0, 68, 69, 86, 73, 67, 69, 95, 84, 89, 80, 69, 95, 83, 72, 73, 70, 84, 0, 68, 69, 86, 73, 67, 69, 95, 77, 65, 83, 75, 0, 68, 69, 86, 73, 67, 69, 95, 78, 79, 78, 69, 0, 68, 69, 86, 73, 67, 69, 95, 74, 79, 89, 80, 65, 68, 0, 68, 69, 86, 73, 67, 69, 95, 77, 79, 85, 83, 69, 0, 68, 69, 86, 73, 67, 69, 95, 75, 69, 89, 66, 79, 65, 82, 68, 0, 68, 69, 86, 73, 67, 69, 95, 76, 73, 71, 72, 84, 71, 85, 78, 0, 68, 69, 86, 73, 67, 69, 95, 65, 78, 65, 76, 79, 71, 0, 68, 69, 86, 73, 67, 69, 95, 80, 79, 73, 78, 84, 69, 82, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 66, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 89, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 83, 69, 76, 69, 67, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 83, 84, 65, 82, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 85, 80, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 68, 79, 87, 78, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 76, 69, 70, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 82, 73, 71, 72, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 65, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 88, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 76, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 82, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 76, 50, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 82, 50, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 76, 51, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 74, 79, 89, 80, 65, 68, 95, 82, 51, 0, 68, 69, 86, 73, 67, 69, 95, 73, 78, 68, 69, 88, 95, 65, 78, 65, 76, 79, 71, 95, 76, 69, 70, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 78, 68, 69, 88, 95, 65, 78, 65, 76, 79, 71, 95, 82, 73, 71, 72, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 65, 78, 65, 76, 79, 71, 95, 88, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 65, 78, 65, 76, 79, 71, 95, 89, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 88, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 89, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 76, 69, 70, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 82, 73, 71, 72, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 87, 72, 69, 69, 76, 85, 80, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 87, 72, 69, 69, 76, 68, 79, 87, 78, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 77, 73, 68, 68, 76, 69, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 72, 79, 82, 73, 90, 95, 87, 72, 69, 69, 76, 85, 80, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 77, 79, 85, 83, 69, 95, 72, 79, 82, 73, 90, 95, 87, 72, 69, 69, 76, 68, 79, 87, 78, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 76, 73, 71, 72, 84, 71, 85, 78, 95, 88, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 76, 73, 71, 72, 84, 71, 85, 78, 95, 89, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 76, 73, 71, 72, 84, 71, 85, 78, 95, 84, 82, 73, 71, 71, 69, 82, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 76, 73, 71, 72, 84, 71, 85, 78, 95, 67, 85, 82, 83, 79, 82, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 76, 73, 71, 72, 84, 71, 85, 78, 95, 84, 85, 82, 66, 79, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 76, 73, 71, 72, 84, 71, 85, 78, 95, 80, 65, 85, 83, 69, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 76, 73, 71, 72, 84, 71, 85, 78, 95, 83, 84, 65, 82, 84, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 80, 79, 73, 78, 84, 69, 82, 95, 88, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 80, 79, 73, 78, 84, 69, 82, 95, 89, 0, 68, 69, 86, 73, 67, 69, 95, 73, 68, 95, 80, 79, 73, 78, 84, 69, 82, 95, 80, 82, 69, 83, 83, 69, 68, 0, 82, 69, 71, 73, 79, 78, 95, 78, 84, 83, 67, 0, 82, 69, 71, 73, 79, 78, 95, 80, 65, 76, 0, 77, 69, 77, 79, 82, 89, 95, 77, 65, 83, 75, 0, 77, 69, 77, 79, 82, 89, 95, 83, 65, 86, 69, 95, 82, 65, 77, 0, 77, 69, 77, 79, 82, 89, 95, 82, 84, 67, 0, 77, 69, 77, 79, 82, 89, 95, 83, 89, 83, 84, 69, 77, 95, 82, 65, 77, 0, 77, 69, 77, 79, 82, 89, 95, 86, 73, 68, 69, 79, 95, 82, 65, 77, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 69, 88, 80, 69, 82, 73, 77, 69, 78, 84, 65, 76, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 80, 82, 73, 86, 65, 84, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 82, 79, 84, 65, 84, 73, 79, 78, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 79, 86, 69, 82, 83, 67, 65, 78, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 67, 65, 78, 95, 68, 85, 80, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 77, 69, 83, 83, 65, 71, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 72, 85, 84, 68, 79, 87, 78, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 80, 69, 82, 70, 79, 82, 77, 65, 78, 67, 69, 95, 76, 69, 86, 69, 76, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 83, 89, 83, 84, 69, 77, 95, 68, 73, 82, 69, 67, 84, 79, 82, 89, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 80, 73, 88, 69, 76, 95, 70, 79, 82, 77, 65, 84, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 73, 78, 80, 85, 84, 95, 68, 69, 83, 67, 82, 73, 80, 84, 79, 82, 83, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 75, 69, 89, 66, 79, 65, 82, 68, 95, 67, 65, 76, 76, 66, 65, 67, 75, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 68, 73, 83, 75, 95, 67, 79, 78, 84, 82, 79, 76, 95, 73, 78, 84, 69, 82, 70, 65, 67, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 72, 87, 95, 82, 69, 78, 68, 69, 82, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 86, 65, 82, 73, 65, 66, 76, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 86, 65, 82, 73, 65, 66, 76, 69, 83, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 86, 65, 82, 73, 65, 66, 76, 69, 95, 85, 80, 68, 65, 84, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 83, 85, 80, 80, 79, 82, 84, 95, 78, 79, 95, 71, 65, 77, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 76, 73, 66, 82, 69, 84, 82, 79, 95, 80, 65, 84, 72, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 65, 85, 68, 73, 79, 95, 67, 65, 76, 76, 66, 65, 67, 75, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 70, 82, 65, 77, 69, 95, 84, 73, 77, 69, 95, 67, 65, 76, 76, 66, 65, 67, 75, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 82, 85, 77, 66, 76, 69, 95, 73, 78, 84, 69, 82, 70, 65, 67, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 73, 78, 80, 85, 84, 95, 68, 69, 86, 73, 67, 69, 95, 67, 65, 80, 65, 66, 73, 76, 73, 84, 73, 69, 83, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 83, 69, 78, 83, 79, 82, 95, 73, 78, 84, 69, 82, 70, 65, 67, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 67, 65, 77, 69, 82, 65, 95, 73, 78, 84, 69, 82, 70, 65, 67, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 76, 79, 71, 95, 73, 78, 84, 69, 82, 70, 65, 67, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 80, 69, 82, 70, 95, 73, 78, 84, 69, 82, 70, 65, 67, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 76, 79, 67, 65, 84, 73, 79, 78, 95, 73, 78, 84, 69, 82, 70, 65, 67, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 67, 79, 82, 69, 95, 65, 83, 83, 69, 84, 83, 95, 68, 73, 82, 69, 67, 84, 79, 82, 89, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 83, 65, 86, 69, 95, 68, 73, 82, 69, 67, 84, 79, 82, 89, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 83, 89, 83, 84, 69, 77, 95, 65, 86, 95, 73, 78, 70, 79, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 80, 82, 79, 67, 95, 65, 68, 68, 82, 69, 83, 83, 95, 67, 65, 76, 76, 66, 65, 67, 75, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 83, 85, 66, 83, 89, 83, 84, 69, 77, 95, 73, 78, 70, 79, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 67, 79, 78, 84, 82, 79, 76, 76, 69, 82, 95, 73, 78, 70, 79, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 77, 69, 77, 79, 82, 89, 95, 77, 65, 80, 83, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 83, 69, 84, 95, 71, 69, 79, 77, 69, 84, 82, 89, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 85, 83, 69, 82, 78, 65, 77, 69, 0, 69, 78, 86, 73, 82, 79, 78, 77, 69, 78, 84, 95, 71, 69, 84, 95, 76, 65, 78, 71, 85, 65, 71, 69, 0, 77, 69, 77, 68, 69, 83, 67, 95, 67, 79, 78, 83, 84, 0, 77, 69, 77, 68, 69, 83, 67, 95, 66, 73, 71, 69, 78, 68, 73, 65, 78, 0, 77, 69, 77, 68, 69, 83, 67, 95, 65, 76, 73, 71, 78, 95, 50, 0, 77, 69, 77, 68, 69, 83, 67, 95, 65, 76, 73, 71, 78, 95, 52, 0, 77, 69, 77, 68, 69, 83, 67, 95, 65, 76, 73, 71, 78, 95, 56, 0, 77, 69, 77, 68, 69, 83, 67, 95, 77, 73, 78, 83, 73, 90, 69, 95, 50, 0, 77, 69, 77, 68, 69, 83, 67, 95, 77, 73, 78, 83, 73, 90, 69, 95, 52, 0, 77, 69, 77, 68, 69, 83, 67, 95, 77, 73, 78, 83, 73, 90, 69, 95, 56, 0, 83, 73, 77, 68, 95, 83, 83, 69, 0, 83, 73, 77, 68, 95, 83, 83, 69, 50, 0, 83, 73, 77, 68, 95, 86, 77, 88, 0, 83, 73, 77, 68, 95, 86, 77, 88, 49, 50, 56, 0, 83, 73, 77, 68, 95, 65, 86, 88, 0, 83, 73, 77, 68, 95, 78, 69, 79, 78, 0, 83, 73, 77, 68, 95, 83, 83, 69, 51, 0, 83, 73, 77, 68, 95, 83, 83, 83, 69, 51, 0, 83, 73, 77, 68, 95, 77, 77, 88, 0, 83, 73, 77, 68, 95, 77, 77, 88, 69, 88, 84, 0, 83, 73, 77, 68, 95, 83, 83, 69, 52, 0, 83, 73, 77, 68, 95, 83, 83, 69, 52, 50, 0, 83, 73, 77, 68, 95, 65, 86, 88, 50, 0, 83, 73, 77, 68, 95, 86, 70, 80, 85, 0, 83, 73, 77, 68, 95, 80, 83, 0, 83, 73, 77, 68, 95, 65, 69, 83, 0, 83, 69, 78, 83, 79, 82, 95, 65, 67, 67, 69, 76, 69, 82, 79, 77, 69, 84, 69, 82, 95, 88, 0, 83, 69, 78, 83, 79, 82, 95, 65, 67, 67, 69, 76, 69, 82, 79, 77, 69, 84, 69, 82, 95, 89, 0, 83, 69, 78, 83, 79, 82, 95, 65, 67, 67, 69, 76, 69, 82, 79, 77, 69, 84, 69, 82, 95, 90, 0, 72, 87, 95, 70, 82, 65, 77, 69, 95, 66, 85, 70, 70, 69, 82, 95, 86, 65, 76, 73, 68, 0, 108, 97, 110, 103, 117, 97, 103, 101, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 68, 85, 77, 77, 89, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 76, 65, 83, 84, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 67, 72, 73, 78, 69, 83, 69, 95, 83, 73, 77, 80, 76, 73, 70, 73, 69, 68, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 67, 72, 73, 78, 69, 83, 69, 95, 84, 82, 65, 68, 73, 84, 73, 79, 78, 65, 76, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 75, 79, 82, 69, 65, 78, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 82, 85, 83, 83, 73, 65, 78, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 80, 79, 82, 84, 85, 71, 85, 69, 83, 69, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 68, 85, 84, 67, 72, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 73, 84, 65, 76, 73, 65, 78, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 71, 69, 82, 77, 65, 78, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 83, 80, 65, 78, 73, 83, 72, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 70, 82, 69, 78, 67, 72, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 74, 65, 80, 65, 78, 69, 83, 69, 0, 76, 65, 78, 71, 85, 65, 71, 69, 95, 69, 78, 71, 76, 73, 83, 72, 0, 107, 101, 121, 0, 75, 95, 68, 85, 77, 77, 89, 0, 75, 95, 76, 65, 83, 84, 0, 75, 95, 85, 78, 68, 79, 0, 75, 95, 69, 85, 82, 79, 0, 75, 95, 80, 79, 87, 69, 82, 0, 75, 95, 77, 69, 78, 85, 0, 75, 95, 66, 82, 69, 65, 75, 0, 75, 95, 83, 89, 83, 82, 69, 81, 0, 75, 95, 80, 82, 73, 78, 84, 0, 75, 95, 72, 69, 76, 80, 0, 75, 95, 67, 79, 77, 80, 79, 83, 69, 0, 75, 95, 77, 79, 68, 69, 0, 75, 95, 82, 83, 85, 80, 69, 82, 0, 75, 95, 76, 83, 85, 80, 69, 82, 0, 75, 95, 76, 77, 69, 84, 65, 0, 75, 95, 82, 77, 69, 84, 65, 0, 75, 95, 76, 65, 76, 84, 0, 75, 95, 82, 65, 76, 84, 0, 75, 95, 76, 67, 84, 82, 76, 0, 75, 95, 82, 67, 84, 82, 76, 0, 75, 95, 76, 83, 72, 73, 70, 84, 0, 75, 95, 82, 83, 72, 73, 70, 84, 0, 75, 95, 83, 67, 82, 79, 76, 76, 79, 67, 75, 0, 75, 95, 67, 65, 80, 83, 76, 79, 67, 75, 0, 75, 95, 78, 85, 77, 76, 79, 67, 75, 0, 75, 95, 70, 49, 53, 0, 75, 95, 70, 49, 52, 0, 75, 95, 70, 49, 51, 0, 75, 95, 70, 49, 50, 0, 75, 95, 70, 49, 49, 0, 75, 95, 70, 49, 48, 0, 75, 95, 70, 57, 0, 75, 95, 70, 56, 0, 75, 95, 70, 55, 0, 75, 95, 70, 54, 0, 75, 95, 70, 53, 0, 75, 95, 70, 52, 0, 75, 95, 70, 51, 0, 75, 95, 70, 50, 0, 75, 95, 70, 49, 0, 75, 95, 80, 65, 71, 69, 68, 79, 87, 78, 0, 75, 95, 80, 65, 71, 69, 85, 80, 0, 75, 95, 69, 78, 68, 0, 75, 95, 72, 79, 77, 69, 0, 75, 95, 73, 78, 83, 69, 82, 84, 0, 75, 95, 76, 69, 70, 84, 0, 75, 95, 82, 73, 71, 72, 84, 0, 75, 95, 68, 79, 87, 78, 0, 75, 95, 85, 80, 0, 75, 95, 75, 80, 95, 69, 81, 85, 65, 76, 83, 0, 75, 95, 75, 80, 95, 69, 78, 84, 69, 82, 0, 75, 95, 75, 80, 95, 80, 76, 85, 83, 0, 75, 95, 75, 80, 95, 77, 73, 78, 85, 83, 0, 75, 95, 75, 80, 95, 77, 85, 76, 84, 73, 80, 76, 89, 0, 75, 95, 75, 80, 95, 68, 73, 86, 73, 68, 69, 0, 75, 95, 75, 80, 95, 80, 69, 82, 73, 79, 68, 0, 75, 95, 75, 80, 57, 0, 75, 95, 75, 80, 56, 0, 75, 95, 75, 80, 55, 0, 75, 95, 75, 80, 54, 0, 75, 95, 75, 80, 53, 0, 75, 95, 75, 80, 52, 0, 75, 95, 75, 80, 51, 0, 75, 95, 75, 80, 50, 0, 75, 95, 75, 80, 49, 0, 75, 95, 75, 80, 48, 0, 75, 95, 68, 69, 76, 69, 84, 69, 0, 75, 95, 122, 0, 75, 95, 121, 0, 75, 95, 120, 0, 75, 95, 119, 0, 75, 95, 118, 0, 75, 95, 117, 0, 75, 95, 116, 0, 75, 95, 115, 0, 75, 95, 114, 0, 75, 95, 113, 0, 75, 95, 112, 0, 75, 95, 111, 0, 75, 95, 110, 0, 75, 95, 109, 0, 75, 95, 108, 0, 75, 95, 107, 0, 75, 95, 106, 0, 75, 95, 105, 0, 75, 95, 104, 0, 75, 95, 103, 0, 75, 95, 102, 0, 75, 95, 101, 0, 75, 95, 100, 0, 75, 95, 99, 0, 75, 95, 98, 0, 75, 95, 97, 0, 75, 95, 66, 65, 67, 75, 81, 85, 79, 84, 69, 0, 75, 95, 85, 78, 68, 69, 82, 83, 67, 79, 82, 69, 0, 75, 95, 67, 65, 82, 69, 84, 0, 75, 95, 82, 73, 71, 72, 84, 66, 82, 65, 67, 75, 69, 84, 0, 75, 95, 66, 65, 67, 75, 83, 76, 65, 83, 72, 0, 75, 95, 76, 69, 70, 84, 66, 82, 65, 67, 75, 69, 84, 0, 75, 95, 65, 84, 0, 75, 95, 81, 85, 69, 83, 84, 73, 79, 78, 0, 75, 95, 71, 82, 69, 65, 84, 69, 82, 0, 75, 95, 69, 81, 85, 65, 76, 83, 0, 75, 95, 76, 69, 83, 83, 0, 75, 95, 83, 69, 77, 73, 67, 79, 76, 79, 78, 0, 75, 95, 67, 79, 76, 79, 78, 0, 75, 95, 57, 0, 75, 95, 56, 0, 75, 95, 55, 0, 75, 95, 54, 0, 75, 95, 53, 0, 75, 95, 52, 0, 75, 95, 51, 0, 75, 95, 50, 0, 75, 95, 49, 0, 75, 95, 48, 0, 75, 95, 83, 76, 65, 83, 72, 0, 75, 95, 80, 69, 82, 73, 79, 68, 0, 75, 95, 77, 73, 78, 85, 83, 0, 75, 95, 67, 79, 77, 77, 65, 0, 75, 95, 80, 76, 85, 83, 0, 75, 95, 65, 83, 84, 69, 82, 73, 83, 75, 0, 75, 95, 82, 73, 71, 72, 84, 80, 65, 82, 69, 78, 0, 75, 95, 76, 69, 70, 84, 80, 65, 82, 69, 78, 0, 75, 95, 81, 85, 79, 84, 69, 0, 75, 95, 65, 77, 80, 69, 82, 83, 65, 78, 68, 0, 75, 95, 68, 79, 76, 76, 65, 82, 0, 75, 95, 72, 65, 83, 72, 0, 75, 95, 81, 85, 79, 84, 69, 68, 66, 76, 0, 75, 95, 69, 88, 67, 76, 65, 73, 77, 0, 75, 95, 83, 80, 65, 67, 69, 0, 75, 95, 69, 83, 67, 65, 80, 69, 0, 75, 95, 80, 65, 85, 83, 69, 0, 75, 95, 82, 69, 84, 85, 82, 78, 0, 75, 95, 67, 76, 69, 65, 82, 0, 75, 95, 84, 65, 66, 0, 75, 95, 66, 65, 67, 75, 83, 80, 65, 67, 69, 0, 75, 95, 70, 73, 82, 83, 84, 0, 75, 95, 85, 78, 75, 78, 79, 87, 78, 0, 109, 111, 100, 0, 77, 79, 68, 95, 68, 85, 77, 77, 89, 0, 77, 79, 68, 95, 83, 67, 82, 79, 76, 76, 79, 67, 75, 0, 77, 79, 68, 95, 67, 65, 80, 83, 76, 79, 67, 75, 0, 77, 79, 68, 95, 78, 85, 77, 76, 79, 67, 75, 0, 77, 79, 68, 95, 77, 69, 84, 65, 0, 77, 79, 68, 95, 65, 76, 84, 0, 77, 79, 68, 95, 67, 84, 82, 76, 0, 77, 79, 68, 95, 83, 72, 73, 70, 84, 0, 77, 79, 68, 95, 78, 79, 78, 69, 0, 108, 111, 103, 95, 108, 101, 118, 101, 108, 0, 76, 79, 71, 95, 68, 85, 77, 77, 89, 0, 76, 79, 71, 95, 69, 82, 82, 79, 82, 0, 76, 79, 71, 95, 87, 65, 82, 78, 0, 76, 79, 71, 95, 73, 78, 70, 79, 0, 76, 79, 71, 95, 68, 69, 66, 85, 71, 0, 115, 101, 110, 115, 111, 114, 95, 97, 99, 116, 105, 111, 110, 0, 83, 69, 78, 83, 79, 82, 95, 68, 85, 77, 77, 89, 0, 83, 69, 78, 83, 79, 82, 95, 65, 67, 67, 69, 76, 69, 82, 79, 77, 69, 84, 69, 82, 95, 68, 73, 83, 65, 66, 76, 69, 0, 83, 69, 78, 83, 79, 82, 95, 65, 67, 67, 69, 76, 69, 82, 79, 77, 69, 84, 69, 82, 95, 69, 78, 65, 66, 76, 69, 0, 99, 97, 109, 101, 114, 97, 95, 98, 117, 102, 102, 101, 114, 0, 67, 65, 77, 69, 82, 65, 95, 66, 85, 70, 70, 69, 82, 95, 68, 85, 77, 77, 89, 0, 67, 65, 77, 69, 82, 65, 95, 66, 85, 70, 70, 69, 82, 95, 82, 65, 87, 95, 70, 82, 65, 77, 69, 66, 85, 70, 70, 69, 82, 0, 67, 65, 77, 69, 82, 65, 95, 66, 85, 70, 70, 69, 82, 95, 79, 80, 69, 78, 71, 76, 95, 84, 69, 88, 84, 85, 82, 69, 0, 114, 117, 109, 98, 108, 101, 95, 101, 102, 102, 101, 99, 116, 0, 82, 85, 77, 66, 76, 69, 95, 68, 85, 77, 77, 89, 0, 82, 85, 77, 66, 76, 69, 95, 87, 69, 65, 75, 0, 82, 85, 77, 66, 76, 69, 95, 83, 84, 82, 79, 78, 71, 0, 104, 119, 95, 99, 111, 110, 116, 101, 120, 116, 95, 116, 121, 112, 101, 0, 72, 87, 95, 67, 79, 78, 84, 69, 88, 84, 95, 68, 85, 77, 77, 89, 0, 72, 87, 95, 67, 79, 78, 84, 69, 88, 84, 95, 79, 80, 69, 78, 71, 76, 69, 83, 95, 86, 69, 82, 83, 73, 79, 78, 0, 72, 87, 95, 67, 79, 78, 84, 69, 88, 84, 95, 79, 80, 69, 78, 71, 76, 69, 83, 51, 0, 72, 87, 95, 67, 79, 78, 84, 69, 88, 84, 95, 79, 80, 69, 78, 71, 76, 95, 67, 79, 82, 69, 0, 72, 87, 95, 67, 79, 78, 84, 69, 88, 84, 95, 79, 80, 69, 78, 71, 76, 69, 83, 50, 0, 72, 87, 95, 67, 79, 78, 84, 69, 88, 84, 95, 79, 80, 69, 78, 71, 76, 0, 72, 87, 95, 67, 79, 78, 84, 69, 88, 84, 95, 78, 79, 78, 69, 0, 112, 105, 120, 101, 108, 95, 102, 111, 114, 109, 97, 116, 0, 80, 73, 88, 69, 76, 95, 70, 79, 82, 77, 65, 84, 95, 85, 78, 75, 78, 79, 87, 78, 0, 80, 73, 88, 69, 76, 95, 70, 79, 82, 77, 65, 84, 95, 82, 71, 66, 53, 54, 53, 0, 80, 73, 88, 69, 76, 95, 70, 79, 82, 77, 65, 84, 95, 88, 82, 71, 66, 56, 56, 56, 56, 0, 80, 73, 88, 69, 76, 95, 70, 79, 82, 77, 65, 84, 95, 48, 82, 71, 66, 49, 53, 53, 53, 0, 105, 110, 105, 116, 0, 118, 105, 0, 100, 101, 105, 110, 105, 116, 0, 97, 112, 105, 95, 118, 101, 114, 115, 105, 111, 110, 0, 105, 105, 0, 114, 101, 115, 101, 116, 0, 114, 117, 110, 0, 117, 110, 108, 111, 97, 100, 95, 103, 97, 109, 101, 0, 103, 101, 116, 95, 114, 101, 103, 105, 111, 110, 0, 99, 104, 101, 97, 116, 95, 114, 101, 115, 101, 116, 0, 103, 101, 116, 95, 109, 101, 109, 111, 114, 121, 95, 115, 105, 122, 101, 0, 105, 105, 105, 0, 115, 101, 114, 105, 97, 108, 105, 122, 101, 95, 115, 105, 122, 101, 0, 115, 101, 116, 95, 99, 111, 110, 116, 114, 111, 108, 108, 101, 114, 95, 112, 111, 114, 116, 95, 100, 101, 118, 105, 99, 101, 0, 118, 105, 105, 105, 0, 49, 56, 114, 101, 116, 114, 111, 95, 112, 105, 120, 101, 108, 95, 102, 111, 114, 109, 97, 116, 0, 50, 49, 114, 101, 116, 114, 111, 95, 104, 119, 95, 99, 111, 110, 116, 101, 120, 116, 95, 116, 121, 112, 101, 0, 49, 57, 114, 101, 116, 114, 111, 95, 114, 117, 109, 98, 108, 101, 95, 101, 102, 102, 101, 99, 116, 0, 49, 57, 114, 101, 116, 114, 111, 95, 99, 97, 109, 101, 114, 97, 95, 98, 117, 102, 102, 101, 114, 0, 49, 57, 114, 101, 116, 114, 111, 95, 115, 101, 110, 115, 111, 114, 95, 97, 99, 116, 105, 111, 110, 0, 49, 53, 114, 101, 116, 114, 111, 95, 108, 111, 103, 95, 108, 101, 118, 101, 108, 0, 57, 114, 101, 116, 114, 111, 95, 109, 111, 100, 0, 57, 114, 101, 116, 114, 111, 95, 107, 101, 121, 0, 49, 52, 114, 101, 116, 114, 111, 95, 108, 97, 110, 103, 117, 97, 103, 101, 0, 237, 119, 248, 80, 48, 232, 77, 73, 78, 69, 128, 248, 80, 0, 222, 83, 84, 79, 82, 77, 128, 0, 142, 200, 131, 111, 128, 140, 203, 197, 38, 249, 189, 232, 227, 124, 200, 36, 134, 187, 183, 200, 128, 142, 1, 1, 191, 200, 129, 142, 200, 131, 111, 128, 140, 203, 112, 38, 249, 32, 0, 189, 241, 175, 204, 2, 0, 189, 247, 169, 10, 121, 15, 86, 15, 155, 142, 200, 168, 189, 248, 79, 142, 200, 175, 189, 248, 79, 142, 200, 249, 189, 248, 79, 204, 0, 1, 189, 248, 124, 142, 201, 0, 189, 248, 79, 204, 0, 1, 189, 248, 124, 142, 237, 171, 159, 196, 159, 198, 134, 5, 151, 217, 151, 218, 151, 219, 32, 36, 189, 232, 102, 16, 142, 200, 196, 150, 155, 174, 166, 48, 4, 175, 166, 142, 237, 167, 150, 155, 174, 134, 166, 5, 132, 3, 38, 2, 12, 217, 204, 0, 1, 189, 248, 124, 189, 231, 228, 142, 200, 196, 150, 155, 174, 134, 166, 132, 43, 5, 189, 225, 41, 32, 65, 220, 240, 131, 0, 1, 221, 240, 39, 20, 52, 8, 189, 241, 170, 189, 234, 207, 206, 238, 47, 189, 234, 157, 53, 8, 150, 15, 39, 36, 142, 200, 168, 206, 203, 235, 189, 248, 216, 142, 200, 175, 206, 203, 235, 189, 248, 216, 220, 240, 16, 38, 255, 68, 189, 241, 139, 15, 59, 16, 206, 203, 234, 126, 240, 28, 52, 8, 189, 234, 240, 189, 229, 30, 189, 226, 98, 189, 228, 184, 189, 227, 83, 53, 8, 189, 235, 67, 189, 236, 70, 189, 236, 149, 189, 230, 71, 37, 223, 150, 189, 16, 39, 255, 97, 150, 190, 16, 38, 255, 146, 126, 224, 165, 159, 194, 204, 127, 0, 221, 220, 151, 183, 134, 32, 151, 156, 142, 225, 231, 159, 157, 142, 201, 51, 159, 185, 134, 29, 151, 184, 15, 86, 206, 237, 119, 189, 246, 141, 52, 8, 189, 231, 17, 189, 246, 135, 150, 38, 133, 1, 38, 2, 10, 183, 189, 234, 240, 189, 234, 207, 189, 242, 137, 189, 229, 30, 189, 242, 165, 246, 200, 183, 39, 28, 142, 239, 38, 16, 190, 200, 220, 189, 234, 127, 142, 239, 93, 189, 234, 127, 142, 239, 148, 189, 234, 127, 53, 8, 10, 220, 32, 192, 53, 8, 15, 156, 134, 4, 151, 183, 134, 127, 151, 184, 150, 183, 39, 74, 214, 184, 39, 4, 10, 184, 32, 18, 214, 38, 196, 31, 38, 12, 74, 151, 183, 158, 194, 166, 134, 198, 3, 189, 233, 161, 52, 8, 189, 234, 240, 189, 242, 169, 206, 238, 32, 189, 234, 157, 16, 142, 224, 248, 206, 237, 167, 182, 200, 155, 238, 198, 189, 234, 168, 189, 229, 30, 189, 226, 98, 189, 228, 184, 53, 8, 189, 235, 67, 189, 230, 71, 32, 178, 57, 10, 184, 39, 78, 12, 237, 189, 245, 23, 132, 7, 139, 4, 151, 156, 222, 185, 134, 128, 167, 196, 220, 220, 139, 8, 167, 68, 111, 69, 231, 70, 111, 71, 189, 245, 23, 77, 43, 12, 129, 16, 44, 2, 139, 12, 129, 96, 47, 14, 32, 238, 129, 240, 47, 2, 128, 12, 129, 160, 44, 2, 32, 226, 167, 200, 17, 31, 137, 29, 138, 1, 167, 200, 16, 111, 66, 49, 200, 18, 16, 159, 185, 57, 0, 2, 7, 16, 0, 32, 24, 16, 1, 0, 5, 0, 3, 37, 7, 80, 0, 0, 1, 0, 0, 53, 0, 0, 0, 0, 4, 4, 8, 8, 13, 13, 238, 61, 238, 83, 238, 111, 238, 142, 52, 8, 134, 200, 31, 139, 150, 189, 16, 38, 0, 156, 150, 238, 16, 38, 0, 167, 150, 19, 16, 38, 0, 146, 150, 20, 39, 50, 150, 212, 145, 214, 39, 28, 145, 216, 39, 8, 150, 213, 39, 20, 150, 215, 38, 32, 150, 215, 139, 12, 129, 127, 34, 24, 151, 215, 150, 212, 151, 216, 32, 14, 150, 213, 139, 12, 129, 127, 34, 8, 151, 213, 150, 212, 151, 214, 12, 242, 150, 213, 39, 14, 128, 2, 151, 213, 214, 214, 189, 231, 181, 16, 159, 204, 159, 206, 150, 215, 39, 14, 128, 2, 151, 215, 214, 216, 189, 231, 181, 16, 159, 208, 159, 210, 220, 200, 211, 204, 211, 208, 221, 200, 220, 202, 211, 206, 211, 210, 221, 202, 150, 27, 39, 15, 43, 4, 10, 212, 32, 6, 12, 212, 32, 2, 52, 8, 189, 232, 76, 134, 208, 31, 139, 189, 242, 165, 198, 12, 16, 142, 200, 200, 142, 203, 137, 189, 234, 141, 53, 136, 134, 128, 151, 238, 189, 245, 23, 132, 3, 139, 3, 151, 239, 12, 246, 150, 238, 42, 25, 10, 239, 39, 13, 189, 233, 138, 151, 200, 15, 201, 215, 202, 15, 203, 53, 136, 4, 238, 134, 31, 151, 239, 53, 136, 214, 239, 193, 224, 47, 12, 150, 239, 128, 4, 151, 239, 79, 189, 233, 74, 53, 136, 15, 239, 15, 238, 189, 232, 55, 53, 136, 182, 200, 231, 39, 43, 52, 8, 134, 200, 31, 139, 150, 231, 39, 33, 220, 222, 211, 226, 221, 222, 151, 220, 220, 224, 211, 228, 221, 224, 151, 221, 53, 8, 189, 242, 165, 198, 8, 16, 190, 200, 220, 142, 239, 179, 189, 234, 127, 57, 142, 227, 161, 159, 163, 189, 245, 23, 142, 228, 72, 132, 6, 174, 134, 236, 129, 221, 220, 151, 222, 15, 223, 215, 224, 15, 225, 32, 88, 150, 191, 38, 25, 189, 245, 23, 132, 127, 139, 48, 151, 162, 189, 245, 23, 132, 63, 151, 230, 189, 245, 23, 139, 16, 151, 231, 32, 73, 150, 189, 38, 227, 198, 28, 206, 201, 51, 166, 196, 39, 8, 51, 200, 18, 90, 38, 246, 32, 52, 12, 237, 10, 191, 158, 222, 175, 68, 158, 224, 175, 70, 134, 64, 167, 196, 150, 192, 38, 16, 142, 228, 18, 159, 157, 189, 245, 23, 132, 127, 139, 64, 151, 156, 12, 192, 158, 232, 166, 128, 151, 162, 166, 128, 151, 230, 166, 128, 151, 231, 159, 232, 214, 230, 189, 231, 181, 16, 159, 226, 159, 228, 57, 206, 200, 196, 150, 155, 238, 198, 166, 196, 198, 3, 189, 233, 161, 142, 228, 38, 159, 157, 57, 10, 193, 39, 6, 134, 255, 151, 156, 32, 23, 189, 245, 23, 31, 137, 196, 3, 38, 2, 203, 1, 206, 200, 196, 150, 155, 238, 198, 166, 196, 189, 233, 161, 57, 228, 80, 228, 106, 228, 132, 228, 158, 127, 0, 40, 32, 48, 64, 40, 48, 40, 0, 16, 48, 16, 64, 24, 32, 80, 64, 48, 40, 48, 8, 96, 127, 56, 112, 128, 0, 64, 0, 48, 32, 16, 80, 32, 40, 64, 48, 62, 112, 24, 48, 96, 32, 24, 64, 48, 36, 80, 127, 6, 112, 0, 127, 64, 16, 96, 40, 56, 48, 40, 8, 64, 48, 40, 127, 32, 24, 48, 48, 8, 104, 64, 32, 80, 127, 56, 112, 0, 128, 64, 48, 96, 56, 24, 48, 48, 32, 24, 32, 56, 64, 40, 16, 96, 32, 0, 48, 64, 56, 80, 127, 28, 112, 134, 4, 206, 201, 11, 142, 200, 21, 183, 200, 143, 189, 242, 169, 166, 196, 39, 34, 106, 73, 39, 25, 236, 69, 227, 65, 237, 69, 236, 71, 227, 67, 237, 71, 49, 69, 189, 234, 109, 51, 74, 122, 200, 143, 38, 224, 57, 111, 196, 122, 200, 234, 182, 200, 189, 38, 238, 182, 200, 238, 38, 233, 166, 132, 39, 229, 111, 132, 124, 200, 182, 108, 196, 252, 200, 200, 237, 69, 252, 200, 202, 237, 71, 252, 201, 7, 237, 65, 252, 201, 9, 237, 67, 134, 24, 167, 73, 124, 200, 234, 32, 193, 134, 28, 183, 200, 143, 206, 201, 51, 166, 196, 38, 9, 51, 200, 18, 122, 200, 143, 38, 244, 57, 16, 43, 0, 156, 133, 64, 16, 38, 0, 164, 133, 32, 16, 38, 0, 169, 133, 16, 16, 38, 0, 212, 133, 1, 16, 38, 0, 216, 166, 65, 129, 4, 39, 86, 133, 1, 39, 49, 182, 200, 238, 38, 44, 182, 200, 189, 38, 39, 52, 8, 189, 241, 175, 150, 200, 160, 68, 214, 202, 224, 70, 189, 245, 147, 128, 16, 151, 131, 142, 226, 62, 230, 67, 166, 133, 214, 131, 189, 231, 181, 16, 175, 72, 175, 74, 53, 8, 236, 68, 227, 72, 237, 68, 236, 70, 227, 74, 237, 70, 189, 242, 165, 142, 226, 90, 166, 65, 72, 174, 134, 49, 68, 230, 66, 189, 234, 141, 126, 229, 42, 236, 68, 227, 72, 41, 26, 237, 68, 236, 70, 227, 74, 41, 18, 237, 70, 189, 242, 169, 49, 68, 142, 203, 167, 198, 4, 189, 234, 141, 126, 229, 42, 111, 196, 122, 200, 235, 126, 229, 42, 166, 70, 171, 200, 16, 167, 70, 161, 200, 17, 38, 2, 100, 196, 189, 242, 165, 49, 68, 189, 234, 109, 126, 229, 42, 166, 67, 129, 3, 38, 13, 166, 66, 161, 200, 16, 44, 6, 139, 8, 167, 66, 32, 27, 100, 196, 166, 200, 16, 167, 66, 134, 24, 167, 200, 16, 182, 200, 237, 38, 10, 182, 200, 192, 38, 5, 134, 127, 183, 200, 162, 126, 229, 150, 106, 200, 16, 38, 2, 100, 196, 126, 229, 150, 111, 196, 166, 65, 129, 4, 39, 21, 230, 67, 90, 39, 16, 52, 10, 134, 200, 31, 139, 166, 228, 189, 233, 161, 189, 233, 161, 53, 10, 126, 229, 42, 52, 8, 189, 241, 170, 189, 242, 169, 206, 203, 43, 134, 14, 183, 200, 143, 166, 196, 16, 39, 0, 166, 230, 68, 225, 65, 36, 13, 203, 3, 231, 68, 16, 174, 66, 142, 238, 186, 189, 234, 127, 77, 16, 42, 0, 131, 122, 200, 247, 16, 39, 0, 55, 182, 200, 38, 132, 1, 38, 3, 124, 200, 248, 182, 200, 248, 16, 142, 127, 0, 142, 239, 4, 189, 231, 106, 16, 142, 96, 128, 142, 239, 11, 189, 231, 106, 16, 142, 128, 80, 142, 239, 21, 189, 231, 106, 16, 142, 160, 128, 142, 239, 28, 189, 231, 106, 32, 80, 122, 200, 217, 127, 200, 235, 127, 200, 237, 182, 200, 121, 39, 43, 182, 200, 155, 68, 142, 200, 218, 246, 200, 217, 231, 134, 182, 200, 218, 38, 5, 182, 200, 219, 39, 26, 182, 200, 155, 139, 2, 132, 2, 183, 200, 155, 68, 142, 200, 218, 230, 134, 247, 200, 217, 39, 235, 182, 200, 217, 38, 13, 134, 1, 183, 200, 190, 32, 6, 230, 68, 225, 65, 37, 5, 111, 196, 122, 200, 236, 51, 69, 122, 200, 143, 16, 38, 255, 75, 189, 236, 201, 32, 5, 52, 8, 189, 241, 170, 189, 242, 165, 142, 128, 56, 191, 200, 144, 182, 200, 217, 39, 30, 183, 200, 143, 122, 200, 143, 39, 22, 182, 200, 145, 139, 6, 183, 200, 145, 198, 4, 16, 190, 200, 144, 142, 238, 235, 189, 234, 127, 32, 229, 53, 8, 150, 38, 132, 1, 72, 72, 72, 142, 238, 173, 206, 203, 167, 189, 246, 31, 214, 236, 38, 15, 150, 189, 38, 8, 214, 235, 38, 7, 214, 237, 38, 3, 28, 254, 57, 26, 1, 57, 52, 50, 142, 200, 200, 189, 242, 242, 166, 228, 151, 4, 31, 32, 189, 243, 18, 198, 12, 174, 97, 189, 244, 14, 53, 178, 52, 22, 142, 203, 43, 134, 14, 230, 132, 39, 7, 48, 5, 74, 38, 247, 32, 29, 166, 228, 132, 128, 76, 167, 132, 42, 2, 12, 189, 166, 228, 132, 127, 167, 4, 166, 97, 167, 1, 236, 98, 237, 2, 12, 236, 12, 243, 53, 150, 52, 54, 189, 246, 1, 167, 100, 29, 88, 73, 88, 73, 88, 73, 237, 98, 230, 100, 29, 88, 73, 88, 73, 88, 73, 237, 100, 53, 182, 52, 54, 141, 223, 236, 124, 88, 73, 237, 100, 236, 122, 88, 73, 237, 98, 53, 182, 134, 208, 31, 139, 189, 242, 114, 134, 200, 31, 139, 15, 156, 15, 159, 15, 162, 15, 165, 142, 201, 11, 111, 128, 140, 203, 113, 38, 249, 204, 0, 0, 221, 222, 221, 224, 221, 226, 221, 228, 151, 231, 151, 189, 151, 190, 151, 234, 151, 235, 151, 236, 151, 248, 198, 64, 215, 247, 151, 237, 151, 192, 142, 8, 0, 159, 240, 134, 7, 151, 191, 142, 227, 132, 159, 163, 204, 0, 0, 221, 200, 221, 202, 204, 0, 0, 151, 212, 221, 204, 221, 206, 151, 213, 151, 214, 221, 208, 221, 210, 151, 215, 151, 216, 150, 212, 142, 238, 235, 206, 203, 137, 189, 246, 31, 134, 127, 214, 212, 189, 231, 210, 16, 191, 201, 7, 191, 201, 9, 57, 52, 48, 52, 8, 189, 241, 170, 189, 242, 114, 53, 8, 134, 160, 151, 143, 150, 200, 39, 10, 43, 3, 74, 32, 1, 76, 151, 200, 15, 201, 150, 202, 39, 10, 43, 3, 74, 32, 1, 76, 151, 202, 15, 203, 150, 212, 39, 12, 129, 31, 46, 3, 74, 32, 1, 76, 132, 63, 151, 212, 189, 226, 242, 142, 203, 129, 198, 8, 166, 132, 139, 3, 167, 128, 90, 38, 247, 52, 8, 189, 241, 170, 189, 234, 207, 95, 134, 32, 189, 233, 11, 189, 232, 253, 53, 8, 150, 200, 16, 38, 255, 170, 150, 202, 16, 38, 255, 164, 150, 212, 16, 38, 255, 158, 10, 143, 16, 38, 255, 152, 189, 231, 228, 53, 176, 142, 237, 224, 16, 142, 203, 113, 206, 203, 129, 198, 8, 134, 22, 175, 161, 48, 8, 167, 192, 139, 15, 90, 38, 245, 57, 52, 30, 142, 203, 129, 134, 8, 108, 128, 74, 38, 251, 32, 2, 52, 30, 134, 208, 31, 139, 134, 9, 52, 2, 106, 228, 38, 7, 189, 243, 84, 53, 2, 53, 158, 189, 243, 84, 134, 3, 183, 200, 35, 166, 228, 74, 142, 203, 129, 230, 134, 196, 127, 225, 97, 35, 223, 224, 98, 47, 219, 215, 4, 142, 203, 113, 72, 174, 134, 189, 242, 169, 189, 242, 213, 32, 203, 52, 30, 134, 208, 31, 139, 134, 9, 52, 2, 106, 228, 38, 7, 189, 243, 84, 53, 2, 53, 158, 189, 243, 84, 134, 3, 183, 200, 35, 142, 200, 200, 189, 242, 242, 230, 228, 88, 88, 235, 98, 47, 223, 196, 127, 215, 4, 142, 203, 113, 166, 228, 74, 72, 174, 134, 189, 242, 169, 189, 242, 213, 32, 202, 52, 6, 189, 245, 23, 167, 228, 189, 245, 23, 129, 96, 46, 249, 129, 160, 45, 245, 167, 97, 53, 6, 57, 52, 118, 150, 237, 16, 39, 0, 147, 10, 237, 189, 245, 23, 132, 31, 151, 139, 129, 27, 35, 4, 128, 4, 32, 246, 198, 18, 61, 195, 201, 51, 31, 3, 166, 196, 132, 192, 38, 13, 12, 139, 150, 139, 129, 27, 47, 234, 15, 139, 79, 32, 229, 166, 228, 167, 65, 142, 226, 66, 72, 16, 174, 134, 16, 159, 137, 198, 32, 231, 196, 142, 226, 62, 166, 97, 230, 134, 215, 139, 142, 226, 58, 230, 134, 231, 200, 16, 167, 67, 142, 226, 82, 72, 16, 174, 134, 16, 175, 76, 142, 226, 74, 16, 174, 134, 16, 159, 135, 129, 6, 38, 2, 12, 244, 150, 136, 155, 138, 25, 167, 79, 150, 135, 153, 137, 25, 167, 78, 150, 139, 189, 234, 62, 189, 231, 181, 16, 175, 72, 175, 74, 12, 235, 150, 192, 39, 8, 134, 255, 151, 156, 134, 3, 151, 193, 53, 246, 52, 6, 189, 245, 23, 31, 137, 132, 48, 167, 97, 196, 15, 193, 4, 36, 2, 203, 4, 193, 12, 35, 2, 192, 4, 235, 97, 231, 97, 53, 134, 52, 6, 134, 127, 151, 4, 31, 32, 189, 242, 195, 189, 243, 84, 53, 134, 52, 6, 134, 127, 151, 4, 166, 164, 230, 34, 189, 242, 195, 189, 243, 84, 53, 134, 52, 22, 31, 32, 189, 242, 252, 230, 97, 189, 244, 14, 53, 150, 52, 22, 31, 33, 189, 242, 242, 230, 97, 174, 98, 189, 244, 14, 53, 150, 52, 86, 134, 127, 151, 4, 189, 243, 115, 53, 214, 52, 86, 31, 32, 189, 242, 252, 189, 244, 149, 53, 182, 189, 242, 169, 204, 252, 56, 253, 200, 42, 182, 200, 155, 16, 142, 237, 163, 16, 174, 166, 206, 237, 159, 238, 198, 141, 218, 57, 189, 242, 169, 204, 252, 56, 253, 200, 42, 16, 142, 127, 160, 206, 200, 168, 141, 199, 182, 200, 121, 39, 9, 16, 142, 127, 16, 206, 200, 175, 141, 185, 57, 189, 241, 146, 52, 8, 189, 242, 230, 189, 234, 180, 182, 200, 128, 189, 241, 180, 252, 200, 129, 253, 200, 31, 253, 200, 33, 189, 241, 248, 134, 200, 31, 139, 150, 156, 39, 8, 10, 156, 38, 4, 173, 159, 200, 157, 150, 159, 39, 8, 10, 159, 38, 4, 173, 159, 200, 160, 150, 162, 39, 8, 10, 162, 38, 4, 173, 159, 200, 163, 150, 165, 39, 8, 10, 165, 38, 4, 173, 159, 200, 166, 53, 136, 150, 234, 39, 18, 16, 142, 201, 11, 134, 4, 151, 143, 109, 164, 38, 7, 49, 42, 10, 143, 38, 246, 57, 150, 231, 39, 53, 52, 32, 166, 37, 230, 39, 31, 1, 204, 6, 22, 16, 158, 220, 189, 248, 255, 53, 32, 36, 32, 111, 164, 15, 231, 15, 162, 142, 237, 159, 150, 155, 174, 134, 204, 16, 0, 189, 248, 124, 134, 48, 198, 112, 158, 220, 189, 231, 132, 10, 234, 32, 198, 206, 201, 51, 134, 28, 151, 144, 166, 196, 132, 63, 38, 9, 51, 200, 18, 10, 144, 38, 243, 32, 170, 52, 32, 166, 37, 230, 39, 31, 1, 166, 68, 230, 70, 31, 2, 236, 76, 189, 248, 255, 53, 32, 36, 224, 166, 65, 132, 2, 39, 90, 142, 237, 159, 150, 155, 174, 134, 236, 78, 189, 248, 124, 12, 245, 166, 68, 230, 70, 31, 1, 166, 66, 198, 32, 189, 231, 132, 204, 1, 16, 237, 78, 150, 200, 160, 68, 214, 202, 224, 70, 189, 245, 147, 128, 16, 31, 137, 52, 32, 134, 63, 189, 231, 181, 16, 175, 72, 175, 74, 53, 32, 111, 164, 204, 4, 4, 237, 76, 166, 65, 230, 67, 90, 39, 6, 189, 233, 161, 189, 233, 161, 134, 4, 167, 65, 10, 234, 126, 235, 83, 134, 1, 167, 196, 111, 164, 142, 237, 159, 150, 155, 174, 134, 236, 78, 189, 248, 124, 166, 68, 230, 70, 31, 1, 166, 66, 198, 64, 189, 231, 132, 10, 235, 10, 234, 126, 235, 83, 150, 189, 38, 25, 150, 238, 38, 21, 16, 142, 201, 51, 134, 28, 151, 143, 166, 164, 132, 63, 38, 8, 49, 168, 18, 10, 143, 38, 243, 57, 52, 32, 150, 200, 214, 202, 31, 1, 166, 36, 230, 38, 16, 174, 44, 30, 32, 189, 248, 255, 53, 32, 36, 224, 111, 164, 15, 237, 150, 200, 214, 202, 31, 1, 166, 34, 138, 128, 198, 48, 189, 231, 132, 12, 243, 10, 235, 32, 206, 150, 189, 38, 25, 150, 238, 38, 21, 150, 231, 39, 17, 150, 200, 214, 202, 31, 1, 204, 6, 22, 16, 158, 220, 189, 248, 255, 37, 1, 57, 15, 231, 15, 162, 150, 200, 214, 202, 31, 1, 134, 8, 138, 128, 198, 48, 189, 231, 132, 12, 243, 57, 182, 200, 242, 39, 8, 127, 200, 242, 206, 237, 55, 32, 49, 182, 200, 243, 39, 8, 127, 200, 243, 206, 237, 77, 32, 36, 182, 200, 182, 39, 8, 127, 200, 182, 206, 237, 66, 32, 23, 182, 200, 244, 39, 11, 127, 200, 244, 127, 200, 246, 206, 237, 90, 32, 7, 182, 200, 246, 38, 240, 32, 3, 189, 242, 125, 246, 200, 0, 203, 16, 193, 160, 36, 7, 134, 0, 189, 242, 86, 32, 6, 204, 8, 0, 189, 242, 86, 246, 200, 2, 203, 32, 193, 240, 36, 7, 134, 2, 189, 242, 86, 32, 6, 204, 9, 0, 189, 242, 86, 57, 0, 16, 1, 0, 6, 31, 7, 6, 8, 15, 255, 2, 57, 3, 0, 6, 31, 7, 5, 9, 15, 255, 6, 31, 7, 7, 10, 16, 11, 0, 12, 56, 13, 0, 255, 0, 0, 1, 0, 2, 48, 3, 0, 4, 0, 5, 0, 6, 31, 7, 61, 8, 0, 9, 15, 10, 0, 11, 0, 12, 0, 13, 0, 255, 237, 143, 254, 182, 0, 25, 1, 25, 0, 25, 1, 50, 0, 25, 1, 25, 0, 25, 6, 25, 5, 25, 0, 128, 255, 238, 221, 204, 187, 170, 153, 136, 119, 119, 119, 119, 119, 119, 119, 119, 200, 168, 200, 175, 127, 160, 127, 16, 200, 249, 201, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 2, 1, 0, 0, 2, 3, 0, 0, 1, 3, 0, 0, 2, 2, 0, 0, 1, 1, 0, 0, 3, 3, 0, 0, 2, 2, 2, 0, 1, 1, 1, 0, 3, 3, 3, 0, 128, 200, 64, 63, 0, 32, 128, 16, 31, 63, 63, 0, 191, 191, 191, 192, 32, 72, 8, 248, 48, 168, 16, 208, 160, 191, 191, 0, 63, 63, 72, 32, 128, 0, 176, 72, 56, 251, 56, 128, 40, 48, 72, 128, 128, 69, 240, 40, 127, 63, 191, 165, 0, 208, 96, 32, 40, 184, 64, 21, 128, 64, 248, 64, 24, 250, 56, 224, 200, 77, 73, 78, 69, 32, 70, 73, 69, 76, 68, 128, 250, 56, 224, 216, 71, 65, 77, 69, 32, 79, 86, 69, 82, 128, 0, 16, 0, 255, 32, 160, 255, 192, 64, 255, 144, 32, 255, 112, 32, 255, 80, 80, 255, 208, 144, 1, 0, 32, 0, 255, 48, 176, 255, 176, 48, 255, 176, 208, 255, 48, 80, 255, 208, 80, 255, 80, 208, 255, 80, 48, 255, 208, 176, 1, 255, 0, 0, 0, 48, 0, 255, 16, 192, 255, 192, 16, 255, 192, 240, 255, 16, 64, 255, 240, 64, 255, 64, 240, 255, 64, 16, 255, 240, 192, 1, 255, 0, 0, 0, 240, 208, 255, 192, 64, 255, 32, 0, 255, 64, 64, 255, 0, 224, 255, 64, 192, 255, 224, 0, 255, 192, 192, 255, 0, 32, 1, 0, 63, 0, 255, 128, 0, 0, 63, 63, 255, 0, 128, 1, 255, 127, 32, 0, 192, 16, 255, 192, 208, 255, 32, 127, 0, 224, 192, 255, 0, 192, 255, 224, 48, 0, 192, 0, 255, 96, 205, 255, 160, 0, 0, 32, 208, 255, 60, 48, 255, 0, 130, 0, 48, 48, 255, 208, 80, 255, 32, 240, 1, 0, 63, 0, 255, 196, 8, 255, 216, 216, 255, 32, 0, 0, 0, 64, 255, 224, 0, 255, 40, 216, 255, 60, 8, 1, 0, 63, 0, 255, 196, 8, 1, 0, 4, 8, 255, 216, 216, 255, 32, 0, 1, 0, 63, 0, 255, 196, 248, 1, 0, 4, 248, 255, 216, 40, 255, 32, 0, 1, 0, 32, 0, 255, 0, 216, 255, 208, 168, 255, 240, 64, 255, 8, 24, 255, 24, 240, 255, 240, 184, 0, 16, 72, 255, 8, 0, 255, 232, 16, 255, 248, 0, 0, 8, 0, 255, 0, 6, 0, 16, 250, 255, 8, 0, 255, 0, 240, 0, 16, 24, 255, 240, 8, 1, 0, 32, 0, 255, 0, 40, 255, 208, 88, 255, 240, 192, 255, 8, 232, 255, 24, 16, 255, 240, 72, 0, 16, 184, 255, 8, 0, 255, 232, 240, 255, 248, 0, 255, 8, 0, 255, 0, 250, 0, 16, 6, 255, 8, 0, 255, 0, 16, 0, 16, 232, 255, 240, 248, 1, 255, 0, 216, 255, 232, 8, 255, 0, 64, 255, 24, 8, 255, 0, 216, 0, 8, 224, 255, 16, 0, 255, 0, 64, 255, 240, 0, 255, 0, 192, 1, 0, 24, 0, 255, 0, 32, 255, 200, 112, 255, 16, 160, 255, 0, 160, 255, 236, 164, 255, 57, 109, 255, 0, 32, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16, 206, 203, 234, 189, 241, 139, 204, 115, 33, 16, 179, 203, 254, 39, 92, 253, 203, 254, 124, 200, 59, 142, 203, 235, 189, 248, 79, 189, 241, 175, 220, 37, 16, 131, 1, 1, 38, 2, 215, 86, 87, 196, 3, 142, 240, 253, 230, 133, 215, 41, 198, 2, 215, 36, 206, 253, 13, 189, 246, 135, 189, 241, 146, 189, 242, 137, 189, 242, 169, 182, 200, 38, 206, 241, 12, 133, 32, 39, 2, 51, 76, 189, 243, 133, 142, 240, 233, 189, 243, 8, 134, 3, 189, 244, 52, 122, 200, 36, 38, 243, 182, 200, 37, 129, 1, 35, 176, 189, 241, 175, 134, 204, 151, 41, 204, 241, 1, 221, 57, 15, 37, 15, 38, 206, 0, 0, 142, 241, 1, 198, 11, 166, 192, 161, 128, 39, 13, 193, 1, 39, 4, 193, 5, 35, 5, 206, 224, 0, 32, 7, 90, 38, 234, 215, 57, 215, 58, 12, 86, 223, 55, 238, 196, 189, 241, 175, 204, 248, 72, 221, 42, 189, 246, 135, 189, 241, 146, 189, 242, 137, 189, 242, 169, 204, 192, 192, 254, 200, 57, 189, 243, 122, 182, 200, 59, 38, 12, 74, 206, 203, 235, 167, 70, 204, 104, 208, 189, 243, 122, 254, 200, 55, 51, 66, 189, 243, 133, 182, 200, 86, 38, 197, 190, 200, 37, 140, 0, 125, 35, 189, 110, 65, 64, 214, 0, 86, 129, 0, 0, 169, 126, 0, 57, 220, 142, 0, 0, 74, 114, 0, 0, 182, 224, 56, 14, 3, 103, 32, 71, 67, 69, 32, 49, 57, 56, 50, 128, 241, 96, 39, 207, 86, 69, 67, 84, 82, 69, 88, 128, 243, 96, 38, 207, 86, 69, 67, 84, 82, 69, 88, 128, 252, 96, 223, 233, 71, 67, 69, 128, 252, 56, 204, 209, 69, 78, 84, 69, 82, 84, 65, 73, 78, 73, 78, 71, 128, 252, 56, 188, 220, 78, 69, 87, 32, 73, 68, 69, 65, 83, 128, 0, 141, 92, 204, 159, 255, 221, 2, 204, 1, 0, 221, 0, 204, 152, 127, 151, 11, 215, 4, 189, 243, 84, 32, 62, 141, 73, 198, 122, 142, 200, 0, 189, 245, 63, 204, 200, 125, 221, 123, 12, 125, 39, 252, 134, 5, 151, 40, 204, 48, 117, 221, 61, 204, 1, 3, 221, 31, 204, 5, 7, 221, 33, 57, 141, 215, 141, 189, 126, 242, 114, 190, 200, 37, 48, 1, 191, 200, 37, 141, 14, 134, 32, 149, 13, 39, 252, 252, 200, 61, 221, 8, 126, 242, 230, 134, 208, 31, 139, 57, 134, 200, 31, 139, 57, 180, 200, 15, 183, 200, 15, 142, 200, 18, 166, 29, 167, 30, 134, 14, 151, 1, 204, 25, 1, 151, 0, 18, 215, 0, 15, 3, 204, 9, 1, 151, 0, 18, 150, 1, 67, 167, 29, 215, 0, 198, 255, 215, 3, 67, 170, 30, 67, 167, 31, 52, 2, 198, 1, 31, 152, 164, 228, 167, 128, 88, 38, 247, 53, 130, 122, 200, 35, 142, 200, 31, 166, 128, 38, 12, 140, 200, 35, 38, 247, 111, 132, 134, 1, 151, 0, 57, 151, 0, 15, 1, 10, 0, 198, 96, 92, 42, 253, 182, 200, 35, 43, 37, 134, 32, 12, 0, 149, 0, 39, 10, 198, 64, 215, 1, 149, 0, 38, 11, 32, 8, 198, 192, 215, 1, 149, 0, 39, 1, 95, 231, 27, 32, 197, 31, 152, 154, 1, 151, 1, 134, 32, 149, 0, 38, 6, 31, 152, 152, 1, 151, 1, 84, 241, 200, 26, 38, 232, 214, 1, 32, 224, 142, 200, 0, 231, 134, 151, 1, 134, 25, 151, 0, 134, 1, 151, 0, 150, 1, 215, 1, 198, 17, 215, 0, 198, 1, 215, 0, 57, 204, 14, 0, 141, 223, 74, 42, 251, 126, 245, 51, 142, 200, 0, 32, 2, 141, 213, 236, 193, 42, 250, 57, 142, 200, 0, 206, 200, 63, 134, 13, 230, 192, 225, 134, 39, 2, 141, 192, 74, 42, 245, 57, 134, 31, 32, 10, 134, 63, 32, 6, 134, 95, 32, 2, 134, 127, 151, 1, 183, 200, 39, 204, 5, 4, 151, 0, 215, 0, 215, 0, 198, 1, 215, 0, 57, 247, 200, 40, 236, 129, 141, 77, 134, 255, 151, 10, 246, 200, 40, 90, 38, 253, 15, 10, 57, 122, 200, 35, 141, 234, 182, 200, 35, 38, 246, 32, 118, 166, 128, 46, 114, 141, 221, 32, 248, 142, 249, 240, 141, 29, 189, 243, 107, 141, 32, 32, 98, 198, 127, 215, 4, 166, 132, 230, 2, 32, 22, 151, 1, 52, 6, 134, 127, 151, 4, 15, 0, 32, 16, 198, 255, 32, 2, 198, 127, 215, 4, 236, 129, 151, 1, 15, 0, 52, 6, 134, 206, 151, 12, 15, 10, 12, 0, 215, 1, 15, 5, 53, 6, 189, 245, 132, 231, 127, 170, 127, 198, 64, 129, 64, 35, 18, 129, 100, 35, 4, 134, 8, 32, 2, 134, 4, 213, 13, 39, 252, 74, 38, 253, 57, 213, 13, 39, 252, 57, 189, 241, 170, 32, 5, 182, 200, 36, 39, 22, 204, 0, 204, 215, 12, 151, 10, 204, 3, 2, 15, 1, 151, 0, 215, 0, 215, 0, 198, 1, 215, 0, 57, 204, 0, 204, 215, 12, 151, 10, 57, 236, 193, 253, 200, 42, 236, 193, 189, 242, 252, 189, 245, 117, 126, 244, 149, 141, 238, 166, 196, 38, 250, 57, 141, 236, 166, 196, 38, 250, 57, 174, 132, 52, 4, 198, 128, 51, 120, 54, 6, 53, 2, 129, 9, 35, 2, 134, 60, 139, 48, 198, 45, 54, 6, 54, 16, 32, 203, 166, 128, 32, 8, 215, 4, 32, 7, 236, 129, 215, 4, 183, 200, 35, 236, 132, 151, 1, 15, 0, 48, 2, 18, 12, 0, 215, 1, 204, 0, 0, 32, 31, 166, 128, 32, 8, 215, 4, 32, 7, 236, 129, 215, 4, 183, 200, 35, 236, 132, 151, 1, 15, 0, 48, 2, 18, 12, 0, 215, 1, 204, 255, 0, 151, 10, 215, 5, 204, 0, 64, 213, 13, 39, 252, 18, 151, 10, 182, 200, 35, 74, 42, 217, 126, 243, 79, 198, 255, 32, 6, 198, 127, 32, 2, 230, 128, 215, 4, 236, 1, 151, 1, 15, 0, 166, 132, 48, 3, 12, 0, 215, 1, 151, 10, 15, 5, 204, 0, 64, 213, 13, 39, 252, 18, 151, 10, 166, 132, 47, 224, 126, 243, 79, 74, 183, 200, 35, 236, 132, 151, 1, 15, 0, 48, 2, 12, 0, 215, 1, 182, 200, 41, 198, 64, 151, 10, 15, 5, 245, 208, 13, 39, 11, 15, 10, 182, 200, 35, 38, 219, 57, 182, 200, 41, 151, 10, 18, 213, 13, 39, 246, 182, 200, 35, 15, 10, 77, 38, 200, 126, 243, 79, 182, 200, 36, 52, 2, 127, 200, 36, 166, 128, 42, 4, 141, 187, 32, 248, 38, 5, 189, 243, 188, 32, 241, 74, 39, 5, 189, 243, 221, 32, 233, 53, 2, 183, 200, 36, 126, 243, 79, 255, 200, 44, 142, 249, 212, 204, 24, 131, 15, 1, 151, 11, 142, 249, 212, 215, 0, 10, 0, 204, 128, 129, 18, 12, 0, 215, 0, 151, 0, 125, 200, 0, 12, 0, 182, 200, 43, 151, 1, 204, 1, 0, 254, 200, 44, 151, 0, 32, 4, 166, 134, 151, 10, 166, 192, 42, 248, 134, 129, 151, 0, 0, 1, 134, 1, 151, 0, 140, 251, 180, 39, 44, 48, 136, 80, 31, 48, 179, 200, 44, 192, 2, 88, 33, 0, 134, 129, 18, 90, 38, 250, 151, 0, 246, 200, 42, 215, 1, 10, 0, 204, 129, 1, 18, 151, 0, 15, 1, 215, 0, 151], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 2534844);
  allocate([0, 198, 3, 32, 155, 134, 152, 151, 11, 126, 243, 84, 52, 20, 198, 2, 32, 3, 52, 20, 95, 190, 200, 123, 166, 1, 73, 73, 73, 73, 168, 2, 70, 105, 132, 105, 1, 105, 2, 90, 42, 238, 166, 132, 53, 148, 198, 13, 142, 200, 63, 141, 5, 134, 63, 167, 6, 57, 79, 32, 6, 142, 200, 0, 204, 0, 255, 111, 139, 131, 0, 1, 42, 249, 57, 134, 128, 167, 133, 90, 38, 251, 167, 132, 57, 198, 2, 32, 2, 198, 5, 142, 200, 46, 109, 133, 39, 2, 106, 133, 90, 42, 247, 57, 198, 3, 32, 9, 198, 2, 32, 5, 198, 1, 32, 1, 95, 90, 42, 253, 57, 142, 249, 220, 166, 134, 57, 77, 42, 4, 64, 40, 1, 74, 93, 42, 4, 80, 40, 1, 90, 57, 52, 16, 221, 52, 89, 198, 0, 89, 73, 89, 88, 215, 54, 220, 52, 141, 224, 151, 52, 209, 52, 35, 8, 12, 54, 30, 137, 32, 2, 68, 84, 129, 9, 34, 250, 221, 52, 214, 54, 142, 252, 36, 230, 133, 142, 252, 44, 166, 134, 155, 53, 139, 10, 197, 1, 38, 4, 235, 134, 32, 3, 90, 224, 134, 215, 54, 150, 54, 53, 144, 139, 16, 142, 252, 109, 95, 133, 32, 39, 2, 198, 128, 132, 31, 129, 16, 38, 1, 92, 166, 134, 57, 52, 16, 150, 54, 141, 230, 221, 55, 150, 54, 141, 222, 221, 57, 53, 144, 192, 16, 215, 54, 151, 59, 141, 232, 141, 84, 64, 52, 2, 141, 85, 53, 132, 183, 200, 54, 247, 200, 35, 52, 8, 189, 241, 175, 141, 210, 32, 24, 183, 200, 54, 52, 8, 189, 241, 175, 151, 35, 141, 196, 166, 128, 167, 192, 47, 6, 15, 35, 53, 136, 10, 35, 166, 128, 141, 38, 167, 196, 166, 132, 141, 26, 171, 196, 167, 192, 166, 31, 141, 18, 167, 196, 166, 128, 141, 18, 160, 196, 167, 192, 150, 35, 43, 212, 38, 220, 53, 136, 151, 59, 220, 55, 32, 4, 151, 59, 220, 57, 215, 60, 197, 1, 39, 4, 150, 59, 32, 10, 214, 59, 42, 3, 3, 60, 80, 61, 137, 0, 214, 60, 42, 1, 64, 57, 230, 198, 231, 134, 74, 42, 249, 57, 150, 86, 43, 40, 39, 249, 142, 252, 141, 159, 77, 134, 128, 151, 86, 236, 193, 221, 79, 236, 193, 221, 81, 223, 83, 189, 245, 51, 204, 31, 31, 221, 95, 204, 0, 0, 221, 99, 221, 101, 151, 85, 32, 57, 206, 200, 94, 198, 2, 166, 197, 129, 31, 39, 2, 108, 197, 90, 42, 245, 158, 81, 206, 200, 88, 134, 7, 108, 196, 161, 196, 44, 2, 111, 196, 230, 192, 196, 7, 230, 133, 231, 192, 76, 129, 9, 35, 235, 10, 87, 38, 107, 150, 85, 74, 42, 2, 134, 2, 151, 85, 230, 159, 200, 83, 206, 200, 94, 111, 198, 197, 64, 39, 25, 142, 249, 228, 166, 134, 148, 69, 151, 69, 150, 85, 139, 3, 166, 134, 154, 69, 151, 69, 196, 31, 215, 70, 32, 35, 142, 249, 234, 166, 134, 148, 69, 151, 69, 150, 85, 139, 3, 166, 134, 154, 69, 151, 69, 150, 85, 72, 139, 3, 51, 198, 196, 63, 88, 158, 77, 236, 133, 237, 196, 158, 83, 230, 128, 159, 83, 93, 43, 165, 230, 128, 42, 6, 189, 245, 51, 15, 86, 57, 159, 83, 196, 63, 215, 87, 16, 158, 79, 206, 200, 94, 142, 200, 66, 134, 2, 230, 192, 197, 1, 39, 7, 84, 230, 165, 196, 15, 32, 7, 84, 230, 165, 84, 84, 84, 84, 231, 134, 74, 42, 231, 206, 200, 103, 142, 200, 71, 236, 195, 109, 88, 42, 10, 96, 88, 224, 88, 130, 0, 96, 88, 32, 4, 235, 88, 137, 0, 237, 129, 140, 200, 77, 38, 229, 57, 32, 192, 64, 192, 80, 76, 65, 89, 69, 82, 128, 224, 192, 1, 192, 32, 71, 65, 77, 69, 128, 253, 200, 79, 77, 39, 2, 134, 1, 93, 39, 2, 198, 1, 253, 200, 121, 189, 241, 175, 204, 248, 80, 221, 42, 151, 60, 32, 103, 189, 241, 146, 79, 189, 241, 180, 189, 245, 90, 189, 242, 169, 182, 200, 121, 16, 142, 247, 148, 141, 90, 182, 200, 122, 16, 142, 247, 159, 141, 81, 189, 241, 175, 150, 60, 39, 6, 150, 15, 38, 61, 15, 60, 150, 47, 39, 158, 150, 46, 38, 204, 150, 21, 38, 150, 150, 18, 39, 15, 150, 121, 39, 11, 76, 145, 79, 35, 2, 134, 1, 151, 121, 32, 28, 150, 122, 39, 177, 214, 19, 39, 9, 76, 145, 80, 35, 13, 134, 1, 32, 9, 214, 20, 39, 160, 74, 38, 2, 150, 80, 151, 122, 134, 243, 151, 47, 67, 151, 46, 32, 144, 142, 200, 94, 52, 2, 141, 19, 166, 224, 39, 14, 141, 28, 31, 19, 236, 161, 189, 243, 122, 31, 35, 189, 243, 120, 57, 204, 32, 32, 237, 132, 237, 2, 167, 4, 204, 48, 128, 237, 5, 57, 206, 0, 0, 129, 99, 35, 8, 128, 100, 51, 201, 1, 0, 32, 244, 129, 9, 35, 7, 128, 10, 51, 200, 16, 32, 245, 51, 198, 31, 48, 52, 2, 52, 4, 198, 5, 79, 193, 1, 35, 16, 197, 1, 39, 4, 166, 228, 32, 6, 166, 224, 68, 68, 68, 68, 132, 15, 187, 200, 35, 127, 200, 35, 171, 133, 129, 47, 46, 2, 139, 16, 129, 57, 35, 5, 128, 10, 124, 200, 35, 167, 133, 90, 42, 207, 127, 200, 35, 95, 166, 133, 129, 48, 38, 9, 134, 32, 167, 133, 92, 193, 5, 45, 241, 57, 52, 80, 79, 230, 128, 43, 8, 225, 192, 39, 248, 34, 1, 76, 76, 53, 208, 141, 237, 129, 1, 38, 6, 166, 128, 167, 192, 42, 250, 57, 52, 32, 52, 54, 236, 100, 171, 196, 235, 65, 237, 100, 32, 16, 52, 32, 52, 54, 31, 48, 171, 100, 235, 101, 32, 240, 52, 32, 52, 54, 31, 65, 95, 58, 166, 4, 171, 132, 40, 2, 134, 127, 161, 2, 45, 21, 166, 4, 160, 132, 40, 2, 134, 128, 161, 2, 46, 9, 92, 193, 2, 37, 226, 26, 1, 32, 2, 28, 254, 53, 54, 53, 160, 150, 103, 42, 41, 132, 127, 151, 103, 142, 200, 88, 134, 4, 189, 246, 131, 84, 84, 84, 218, 88, 196, 7, 215, 84, 214, 88, 196, 56, 215, 83, 214, 88, 196, 7, 215, 93, 198, 2, 215, 92, 134, 127, 32, 13, 150, 119, 39, 106, 144, 91, 42, 5, 95, 215, 119, 32, 98, 151, 119, 68, 68, 214, 83, 39, 13, 151, 70, 214, 89, 43, 5, 39, 5, 31, 137, 83, 215, 70, 68, 129, 7, 35, 5, 129, 15, 39, 1, 76, 214, 90, 43, 6, 39, 2, 136, 15, 31, 137, 141, 55, 214, 93, 39, 43, 150, 92, 74, 42, 2, 134, 2, 151, 92, 189, 245, 126, 149, 93, 39, 240, 214, 92, 88, 80, 142, 200, 75, 48, 133, 189, 245, 23, 132, 15, 129, 5, 34, 3, 72, 139, 5, 167, 132, 150, 126, 167, 1, 150, 88, 67, 148, 69, 151, 69, 57, 150, 84, 142, 200, 69, 77, 39, 9, 48, 31, 68, 36, 248, 231, 132, 32, 244, 57, 1, 2, 4, 8, 16, 32, 64, 128, 247, 239, 223, 1, 2, 4, 254, 253, 251, 8, 16, 32, 127, 127, 128, 128, 0, 32, 80, 80, 32, 200, 32, 16, 16, 64, 32, 0, 0, 0, 0, 8, 48, 32, 112, 112, 16, 248, 48, 248, 112, 112, 0, 96, 0, 0, 0, 112, 112, 32, 240, 112, 240, 248, 248, 120, 136, 112, 8, 136, 128, 136, 136, 248, 240, 112, 240, 112, 248, 136, 136, 136, 136, 136, 248, 112, 128, 112, 32, 0, 0, 32, 8, 32, 0, 0, 0, 56, 16, 32, 68, 68, 0, 254, 255, 254, 0, 112, 80, 80, 120, 200, 80, 32, 32, 32, 168, 32, 0, 0, 0, 8, 72, 96, 136, 136, 48, 128, 64, 8, 136, 136, 96, 96, 16, 0, 64, 136, 136, 80, 72, 136, 72, 128, 128, 128, 136, 32, 8, 144, 128, 216, 200, 136, 136, 136, 136, 136, 168, 136, 136, 136, 136, 136, 8, 64, 128, 8, 80, 0, 0, 112, 12, 32, 112, 112, 0, 68, 16, 112, 0, 0, 108, 130, 255, 254, 0, 112, 80, 248, 160, 16, 80, 64, 64, 16, 112, 32, 0, 0, 0, 16, 72, 32, 8, 8, 80, 240, 128, 16, 136, 136, 96, 0, 32, 120, 32, 8, 168, 136, 72, 128, 72, 128, 128, 128, 136, 32, 8, 160, 128, 168, 168, 136, 136, 136, 136, 64, 32, 136, 136, 136, 80, 80, 16, 64, 64, 8, 136, 0, 112, 168, 10, 32, 136, 248, 96, 186, 56, 32, 0, 0, 146, 130, 255, 254, 0, 32, 0, 80, 112, 32, 96, 0, 64, 16, 168, 248, 0, 112, 0, 32, 72, 32, 112, 48, 144, 8, 240, 32, 112, 120, 0, 96, 64, 0, 16, 16, 184, 136, 112, 128, 72, 224, 224, 152, 248, 32, 8, 192, 128, 168, 152, 136, 240, 136, 240, 32, 32, 136, 80, 168, 32, 32, 32, 64, 32, 8, 0, 0, 254, 32, 8, 32, 136, 248, 240, 162, 56, 248, 130, 56, 146, 130, 255, 254, 0, 0, 0, 248, 112, 64, 168, 0, 64, 16, 168, 32, 64, 0, 0, 64, 72, 32, 128, 8, 248, 8, 136, 64, 136, 8, 96, 96, 32, 120, 32, 32, 176, 248, 72, 128, 72, 128, 128, 136, 136, 32, 8, 160, 128, 136, 136, 136, 128, 168, 160, 16, 32, 136, 80, 168, 80, 32, 64, 64, 16, 8, 0, 0, 254, 32, 120, 168, 136, 248, 240, 186, 124, 32, 68, 68, 108, 130, 255, 254, 0, 0, 0, 80, 40, 152, 144, 0, 32, 32, 0, 32, 64, 0, 0, 128, 72, 32, 128, 136, 16, 136, 136, 128, 136, 16, 96, 32, 16, 0, 64, 0, 128, 136, 72, 136, 72, 128, 128, 136, 136, 32, 136, 144, 136, 136, 136, 136, 128, 144, 144, 136, 32, 136, 32, 168, 136, 32, 128, 64, 8, 8, 0, 0, 72, 32, 240, 112, 112, 112, 96, 68, 108, 80, 56, 130, 0, 130, 255, 254, 0, 32, 0, 80, 248, 152, 104, 0, 16, 64, 0, 0, 128, 0, 128, 128, 48, 112, 248, 112, 16, 112, 112, 128, 112, 96, 0, 64, 0, 0, 0, 32, 120, 136, 240, 112, 240, 248, 128, 120, 136, 112, 112, 136, 248, 136, 136, 248, 128, 104, 136, 112, 32, 112, 32, 80, 136, 32, 248, 112, 8, 112, 0, 248, 0, 32, 96, 32, 0, 0, 0, 56, 130, 136, 0, 0, 0, 254, 255, 254, 0, 17, 65, 48, 33, 16, 32, 49, 0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 8, 16, 8, 16, 11, 8, 16, 13, 10, 8, 16, 14, 11, 9, 8, 16, 14, 12, 10, 9, 8, 16, 14, 13, 11, 10, 9, 8, 16, 15, 13, 12, 11, 10, 9, 8, 16, 15, 14, 12, 11, 10, 9, 9, 8, 16, 15, 14, 13, 12, 11, 10, 9, 9, 8, 0, 25, 50, 74, 98, 121, 142, 162, 181, 198, 213, 226, 237, 245, 251, 255, 255, 255, 251, 245, 237, 226, 213, 198, 181, 162, 142, 121, 98, 74, 50, 25, 3, 189, 3, 135, 3, 84, 3, 36, 2, 247, 2, 205, 2, 164, 2, 126, 2, 91, 2, 57, 2, 25, 1, 251, 1, 222, 1, 195, 1, 170, 1, 146, 1, 124, 1, 102, 1, 82, 1, 63, 1, 45, 1, 28, 1, 12, 0, 253, 0, 239, 0, 226, 0, 213, 0, 201, 0, 190, 0, 179, 0, 169, 0, 160, 0, 151, 0, 142, 0, 134, 0, 127, 0, 120, 0, 113, 0, 107, 0, 101, 0, 95, 0, 90, 0, 85, 0, 80, 0, 75, 0, 71, 0, 67, 0, 63, 0, 60, 0, 56, 0, 53, 0, 50, 0, 47, 0, 45, 0, 42, 0, 40, 0, 38, 0, 36, 0, 34, 0, 32, 0, 30, 0, 28, 0, 27, 0, 0, 254, 232, 254, 182, 147, 31, 12, 147, 31, 6, 152, 159, 36, 60, 17, 128, 253, 105, 253, 121, 33, 7, 33, 7, 33, 7, 33, 7, 33, 7, 33, 7, 33, 14, 153, 159, 36, 14, 149, 155, 32, 14, 33, 7, 33, 7, 33, 7, 33, 7, 33, 7, 33, 7, 157, 163, 40, 14, 160, 166, 43, 14, 34, 2, 40, 2, 45, 2, 40, 2, 34, 2, 40, 2, 45, 2, 40, 2, 34, 2, 40, 2, 45, 2, 40, 2, 46, 2, 45, 40, 33, 128, 239, 255, 254, 220, 186, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 255, 254, 255, 253, 195, 254, 182, 81, 36, 80, 6, 80, 6, 80, 12, 80, 6, 80, 6, 80, 4, 80, 4, 80, 4, 80, 24, 80, 4, 80, 4, 80, 4, 80, 12, 80, 12, 80, 36, 80, 6, 80, 6, 80, 12, 80, 6, 80, 6, 80, 4, 80, 4, 80, 4, 80, 24, 80, 4, 80, 4, 80, 4, 80, 12, 80, 24, 38, 128, 253, 186, 152, 118, 85, 68, 51, 34, 17, 0, 0, 0, 0, 0, 0, 0, 254, 40, 253, 121, 152, 28, 16, 63, 8, 152, 28, 4, 152, 28, 4, 152, 28, 16, 63, 8, 152, 28, 4, 152, 28, 4, 152, 28, 8, 147, 24, 8, 152, 28, 8, 156, 31, 8, 152, 28, 8, 147, 24, 8, 152, 28, 8, 147, 24, 8, 152, 28, 8, 156, 31, 8, 152, 28, 8, 147, 24, 8, 152, 28, 8, 147, 24, 8, 152, 28, 8, 156, 31, 8, 152, 28, 8, 147, 24, 8, 156, 31, 48, 26, 128, 255, 254, 220, 186, 152, 118, 84, 50, 16, 0, 0, 0, 0, 0, 0, 0, 254, 102, 254, 182, 12, 24, 17, 24, 12, 24, 17, 24, 12, 24, 17, 24, 12, 18, 12, 6, 17, 24, 157, 33, 24, 159, 35, 24, 161, 36, 24, 163, 38, 24, 159, 164, 40, 24, 7, 18, 7, 6, 0, 60, 24, 128, 222, 239, 254, 220, 186, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 254, 178, 254, 182, 24, 6, 26, 6, 28, 12, 24, 12, 26, 36, 35, 24, 23, 6, 24, 6, 26, 12, 23, 12, 24, 36, 36, 24, 164, 40, 12, 163, 38, 12, 161, 36, 12, 159, 35, 12, 157, 33, 24, 154, 31, 24, 23, 6, 24, 6, 26, 12, 23, 12, 24, 36, 36, 36, 24, 128, 255, 238, 221, 204, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 254, 232, 254, 182, 150, 154, 29, 30, 145, 149, 24, 30, 148, 152, 27, 30, 143, 148, 24, 20, 22, 10, 140, 145, 21, 20, 22, 10, 145, 149, 24, 50, 24, 128, 238, 255, 255, 238, 238, 221, 204, 187, 170, 153, 136, 136, 136, 136, 136, 136, 255, 22, 254, 182, 28, 6, 31, 6, 28, 6, 24, 6, 26, 6, 24, 6, 21, 6, 19, 6, 24, 6, 19, 6, 23, 6, 24, 30, 24, 128, 255, 255, 238, 238, 221, 221, 204, 204, 0, 0, 0, 0, 0, 0, 0, 0, 254, 40, 254, 182, 22, 15, 22, 5, 22, 5, 22, 5, 26, 15, 22, 15, 29, 15, 29, 5, 29, 5, 29, 5, 33, 15, 29, 50, 29, 128, 254, 40, 254, 182, 22, 6, 22, 2, 22, 2, 22, 2, 26, 6, 22, 6, 29, 6, 29, 2, 29, 2, 29, 2, 33, 6, 29, 50, 17, 128, 254, 40, 254, 182, 27, 15, 22, 5, 22, 5, 22, 5, 23, 48, 22, 5, 22, 5, 22, 5, 23, 48, 22, 128, 253, 105, 254, 182, 160, 35, 18, 160, 35, 12, 156, 32, 6, 158, 33, 18, 156, 32, 50, 19, 128, 253, 195, 254, 182, 22, 4, 22, 4, 22, 4, 22, 4, 26, 8, 28, 128, 166, 160, 32, 8, 189, 243, 190, 182, 200, 128, 132, 127, 183, 200, 128, 122, 200, 128, 166, 164, 71, 132, 248, 230, 160, 88, 88, 88, 88, 87, 196, 248, 125, 200, 128, 43, 223, 189, 243, 223, 182, 200, 128, 133, 15, 38, 224, 133, 32, 39, 205, 57, 75, 65, 82, 82, 83, 79, 70, 84, 56, 50, 76, 68, 77, 67, 66, 67, 74, 84, 56, 50, 76, 68, 77, 67, 66, 67, 74, 0, 0, 0, 0, 203, 242, 203, 242, 203, 245, 203, 248, 203, 251, 203, 251, 240], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 2545084);
  allocate([105, 108, 108, 101, 103, 97, 108, 32, 101, 120, 103, 116, 102, 114, 32, 114, 101, 103, 32, 37, 46, 49, 120, 10, 0, 117, 110, 107, 110, 111, 119, 110, 32, 112, 97, 103, 101, 45, 49, 32, 111, 112, 32, 99, 111, 100, 101, 58, 32, 37, 46, 50, 120, 10, 0, 117, 110, 107, 110, 111, 119, 110, 32, 112, 97, 103, 101, 45, 50, 32, 111, 112, 32, 99, 111, 100, 101, 58, 32, 37, 46, 50, 120, 10, 0, 117, 110, 107, 110, 111, 119, 110, 32, 112, 97, 103, 101, 45, 48, 32, 111, 112, 32, 99, 111, 100, 101, 58, 32, 37, 46, 50, 120, 10, 0, 86, 101, 99, 88, 0, 49, 46, 50, 0, 98, 105, 110, 124, 118, 101, 99], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 2588855);
  allocate([76, 101, 102, 116, 0, 85, 112, 0, 68, 111, 119, 110, 0, 82, 105, 103, 104, 116, 0, 50, 0, 49, 0, 51, 0, 52, 0, 117, 110, 100, 101, 102, 105, 110, 101, 100, 32, 112, 111, 115, 116, 45, 98, 121, 116, 101, 0, 118, 111, 105, 100, 0, 98, 111, 111, 108, 0, 99, 104, 97, 114, 0, 115, 105, 103, 110, 101, 100, 32, 99, 104, 97, 114, 0, 117, 110, 115, 105, 103, 110, 101, 100, 32, 99, 104, 97, 114, 0, 115, 104, 111, 114, 116, 0, 117, 110, 115, 105, 103, 110, 101, 100, 32, 115, 104, 111, 114, 116, 0, 105, 110, 116, 0, 117, 110, 115, 105, 103, 110, 101, 100, 32, 105, 110, 116, 0, 108, 111, 110, 103, 0, 117, 110, 115, 105, 103, 110, 101, 100, 32, 108, 111, 110, 103, 0, 102, 108, 111, 97, 116, 0, 100, 111, 117, 98, 108, 101, 0, 115, 116, 100, 58, 58, 115, 116, 114, 105, 110, 103, 0, 115, 116, 100, 58, 58, 98, 97, 115, 105, 99, 95, 115, 116, 114, 105, 110, 103, 60, 117, 110, 115, 105, 103, 110, 101, 100, 32, 99, 104, 97, 114, 62, 0, 115, 116, 100, 58, 58, 119, 115, 116, 114, 105, 110, 103, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 118, 97, 108, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 99, 104, 97, 114, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 115, 105, 103, 110, 101, 100, 32, 99, 104, 97, 114, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 117, 110, 115, 105, 103, 110, 101, 100, 32, 99, 104, 97, 114, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 115, 104, 111, 114, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 117, 110, 115, 105, 103, 110, 101, 100, 32, 115, 104, 111, 114, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 105, 110, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 117, 110, 115, 105, 103, 110, 101, 100, 32, 105, 110, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 108, 111, 110, 103, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 117, 110, 115, 105, 103, 110, 101, 100, 32, 108, 111, 110, 103, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 105, 110, 116, 56, 95, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 117, 105, 110, 116, 56, 95, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 105, 110, 116, 49, 54, 95, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 117, 105, 110, 116, 49, 54, 95, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 105, 110, 116, 51, 50, 95, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 117, 105, 110, 116, 51, 50, 95, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 102, 108, 111, 97, 116, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 100, 111, 117, 98, 108, 101, 62, 0, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 58, 58, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 60, 108, 111, 110, 103, 32, 100, 111, 117, 98, 108, 101, 62, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 101, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 100, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 102, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 109, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 108, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 106, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 105, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 116, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 115, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 104, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 97, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 49, 49, 109, 101, 109, 111, 114, 121, 95, 118, 105, 101, 119, 73, 99, 69, 69, 0, 78, 49, 48, 101, 109, 115, 99, 114, 105, 112, 116, 101, 110, 51, 118, 97, 108, 69, 0, 78, 83, 116, 51, 95, 95, 49, 49, 50, 98, 97, 115, 105, 99, 95, 115, 116, 114, 105, 110, 103, 73, 119, 78, 83, 95, 49, 49, 99, 104, 97, 114, 95, 116, 114, 97, 105, 116, 115, 73, 119, 69, 69, 78, 83, 95, 57, 97, 108, 108, 111, 99, 97, 116, 111, 114, 73, 119, 69, 69, 69, 69, 0, 78, 83, 116, 51, 95, 95, 49, 50, 49, 95, 95, 98, 97, 115, 105, 99, 95, 115, 116, 114, 105, 110, 103, 95, 99, 111, 109, 109, 111, 110, 73, 76, 98, 49, 69, 69, 69, 0, 78, 83, 116, 51, 95, 95, 49, 49, 50, 98, 97, 115, 105, 99, 95, 115, 116, 114, 105, 110, 103, 73, 104, 78, 83, 95, 49, 49, 99, 104, 97, 114, 95, 116, 114, 97, 105, 116, 115, 73, 104, 69, 69, 78, 83, 95, 57, 97, 108, 108, 111, 99, 97, 116, 111, 114, 73, 104, 69, 69, 69, 69, 0, 78, 83, 116, 51, 95, 95, 49, 49, 50, 98, 97, 115, 105, 99, 95, 115, 116, 114, 105, 110, 103, 73, 99, 78, 83, 95, 49, 49, 99, 104, 97, 114, 95, 116, 114, 97, 105, 116, 115, 73, 99, 69, 69, 78, 83, 95, 57, 97, 108, 108, 111, 99, 97, 116, 111, 114, 73, 99, 69, 69, 69, 69, 0, 83, 116, 57, 116, 121, 112, 101, 95, 105, 110, 102, 111, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 49, 54, 95, 95, 115, 104, 105, 109, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 49, 55, 95, 95, 99, 108, 97, 115, 115, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 49, 57, 95, 95, 112, 111, 105, 110, 116, 101, 114, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 49, 55, 95, 95, 112, 98, 97, 115, 101, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 50, 51, 95, 95, 102, 117, 110, 100, 97, 109, 101, 110, 116, 97, 108, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 118, 0, 80, 118, 0, 68, 110, 0, 98, 0, 99, 0, 104, 0, 97, 0, 115, 0, 116, 0, 105, 0, 106, 0, 108, 0, 109, 0, 102, 0, 100, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 49, 54, 95, 95, 101, 110, 117, 109, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 50, 48, 95, 95, 115, 105, 95, 99, 108, 97, 115, 115, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0, 78, 49, 48, 95, 95, 99, 120, 120, 97, 98, 105, 118, 49, 50, 49, 95, 95, 118, 109, 105, 95, 99, 108, 97, 115, 115, 95, 116, 121, 112, 101, 95, 105, 110, 102, 111, 69, 0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 2590013);
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
  var ___errno_state = 0;
  function ___setErrNo(value) {
    HEAP32[___errno_state >> 2] = value;
    return value;
  }
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
  function _fileno(stream) {
    stream = FS.getStreamFromPtr(stream);
    if (!stream)
      return -1;
    return stream.fd;
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
  Module["_strlen"] = _strlen;
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
  function _printf(format, varargs) {
    var stdout = HEAP32[_stdout >> 2];
    return _fprintf(stdout, format, varargs);
  }
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
  Module["_memset"] = _memset;
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
  function _abort() {
    Module["abort"]();
  }
  function _free() {}
  Module["_free"] = _free;
  function _malloc(bytes) {
    var ptr = Runtime.dynamicAlloc(bytes + 8);
    return ptr + 8 & 4294967288;
  }
  Module["_malloc"] = _malloc;
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
  function __embind_register_constant(name, type, value) {
    name = readLatin1String(name);
    whenDependentTypesAreResolved([], [type], (function(type) {
      type = type[0];
      Module[name] = type["fromWireType"](value);
      return [];
    }));
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
  function _emscripten_memcpy_big(dest, src, num) {
    HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
    return dest;
  }
  Module["_memcpy"] = _memcpy;
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
  function ___errno_location() {
    return ___errno_state;
  }
  function _input_poll() {
    Module.input_poll();
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
  ___errno_state = Runtime.staticAlloc(4);
  HEAP32[___errno_state >> 2] = 0;
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
  UnboundTypeError = Module["UnboundTypeError"] = extendError(Error, "UnboundTypeError");
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
  init_emval();
  STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);
  staticSealed = true;
  STACK_MAX = STACK_BASE + TOTAL_STACK;
  DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);
  assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");
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
    "__embind_register_enum": __embind_register_enum,
    "floatReadValueFromPointer": floatReadValueFromPointer,
    "simpleReadValueFromPointer": simpleReadValueFromPointer,
    "_send": _send,
    "__embind_register_memory_view": __embind_register_memory_view,
    "throwInternalError": throwInternalError,
    "get_first_emval": get_first_emval,
    "_embind_repr": _embind_repr,
    "___setErrNo": ___setErrNo,
    "__embind_register_integer": __embind_register_integer,
    "extendError": extendError,
    "_fwrite": _fwrite,
    "_write": _write,
    "__embind_register_void": __embind_register_void,
    "count_emval_handles": count_emval_handles,
    "getShiftFromSize": getShiftFromSize,
    "_fflush": _fflush,
    "embind_init_charCodes": embind_init_charCodes,
    "_input_poll": _input_poll,
    "_pwrite": _pwrite,
    "__reallyNegative": __reallyNegative,
    "_audio_sample": _audio_sample,
    "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing,
    "__emval_register": __emval_register,
    "_sbrk": _sbrk,
    "__embind_register_std_wstring": __embind_register_std_wstring,
    "_emscripten_memcpy_big": _emscripten_memcpy_big,
    "_fileno": _fileno,
    "__embind_register_bool": __embind_register_bool,
    "_sysconf": _sysconf,
    "enumReadValueFromPointer": enumReadValueFromPointer,
    "_video_refresh": _video_refresh,
    "__embind_register_std_string": __embind_register_std_string,
    "createNamedFunction": createNamedFunction,
    "__embind_register_emval": __embind_register_emval,
    "readLatin1String": readLatin1String,
    "_fprintf": _fprintf,
    "throwUnboundTypeError": throwUnboundTypeError,
    "_fputs": _fputs,
    "craftInvokerFunction": craftInvokerFunction,
    "__emval_decref": __emval_decref,
    "__embind_register_enum_value": __embind_register_enum_value,
    "_puts": _puts,
    "_mkport": _mkport,
    "__embind_register_float": __embind_register_float,
    "requireRegisteredType": requireRegisteredType,
    "makeLegalFunctionName": makeLegalFunctionName,
    "integerReadValueFromPointer": integerReadValueFromPointer,
    "heap32VectorToArray": heap32VectorToArray,
    "init_emval": init_emval,
    "whenDependentTypesAreResolved": whenDependentTypesAreResolved,
    "_emscripten_set_main_loop": _emscripten_set_main_loop,
    "___errno_location": ___errno_location,
    "new_": new_,
    "_fputc": _fputc,
    "_environment": _environment,
    "__embind_register_function": __embind_register_function,
    "_abort": _abort,
    "throwBindingError": throwBindingError,
    "ensureOverloadTable": ensureOverloadTable,
    "__embind_register_constant": __embind_register_constant,
    "_time": _time,
    "requireFunction": requireFunction,
    "runDestructors": runDestructors,
    "getTypeName": getTypeName,
    "__formatString": __formatString,
    "registerType": registerType,
    "exposePublicSymbol": exposePublicSymbol,
    "_printf": _printf,
    "replacePublicSymbol": replacePublicSymbol,
    "_input_state": _input_state,
    "STACKTOP": STACKTOP,
    "STACK_MAX": STACK_MAX,
    "tempDoublePtr": tempDoublePtr,
    "ABORT": ABORT
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
    var v = 0;
    var w = 0;
    var x = 0;
    var y = 0;
    var z = global.NaN,
        A = global.Infinity;
    var B = 0,
        C = 0,
        D = 0,
        E = 0,
        F = 0.0,
        G = 0,
        H = 0,
        I = 0,
        J = 0.0;
    var K = 0;
    var L = 0;
    var M = 0;
    var N = 0;
    var O = 0;
    var P = 0;
    var Q = 0;
    var R = 0;
    var S = 0;
    var T = 0;
    var U = global.Math.floor;
    var V = global.Math.abs;
    var W = global.Math.sqrt;
    var X = global.Math.pow;
    var Y = global.Math.cos;
    var Z = global.Math.sin;
    var _ = global.Math.tan;
    var $ = global.Math.acos;
    var aa = global.Math.asin;
    var ba = global.Math.atan;
    var ca = global.Math.atan2;
    var da = global.Math.exp;
    var ea = global.Math.log;
    var fa = global.Math.ceil;
    var ga = global.Math.imul;
    var ha = global.Math.min;
    var ia = global.Math.clz32;
    var ja = env.abort;
    var ka = env.assert;
    var la = env.invoke_iiii;
    var ma = env.jsCall_iiii;
    var na = env.invoke_viiiii;
    var oa = env.jsCall_viiiii;
    var pa = env.invoke_i;
    var qa = env.jsCall_i;
    var ra = env.invoke_vi;
    var sa = env.jsCall_vi;
    var ta = env.invoke_vii;
    var ua = env.jsCall_vii;
    var va = env.invoke_ii;
    var wa = env.jsCall_ii;
    var xa = env.invoke_viii;
    var ya = env.jsCall_viii;
    var za = env.invoke_v;
    var Aa = env.jsCall_v;
    var Ba = env.invoke_iiiii;
    var Ca = env.jsCall_iiiii;
    var Da = env.invoke_viiiiii;
    var Ea = env.jsCall_viiiiii;
    var Fa = env.invoke_iii;
    var Ga = env.jsCall_iii;
    var Ha = env.invoke_viiii;
    var Ia = env.jsCall_viiii;
    var Ja = env.__embind_register_enum;
    var Ka = env.floatReadValueFromPointer;
    var La = env.simpleReadValueFromPointer;
    var Ma = env._send;
    var Na = env.__embind_register_memory_view;
    var Oa = env.throwInternalError;
    var Pa = env.get_first_emval;
    var Qa = env._embind_repr;
    var Ra = env.___setErrNo;
    var Sa = env.__embind_register_integer;
    var Ta = env.extendError;
    var Ua = env._fwrite;
    var Va = env._write;
    var Wa = env.__embind_register_void;
    var Xa = env.count_emval_handles;
    var Ya = env.getShiftFromSize;
    var Za = env._fflush;
    var _a = env.embind_init_charCodes;
    var $a = env._input_poll;
    var ab = env._pwrite;
    var bb = env.__reallyNegative;
    var cb = env._audio_sample;
    var db = env._emscripten_set_main_loop_timing;
    var eb = env.__emval_register;
    var fb = env._sbrk;
    var gb = env.__embind_register_std_wstring;
    var hb = env._emscripten_memcpy_big;
    var ib = env._fileno;
    var jb = env.__embind_register_bool;
    var kb = env._sysconf;
    var lb = env.enumReadValueFromPointer;
    var mb = env._video_refresh;
    var nb = env.__embind_register_std_string;
    var ob = env.createNamedFunction;
    var pb = env.__embind_register_emval;
    var qb = env.readLatin1String;
    var rb = env._fprintf;
    var sb = env.throwUnboundTypeError;
    var tb = env._fputs;
    var ub = env.craftInvokerFunction;
    var vb = env.__emval_decref;
    var wb = env.__embind_register_enum_value;
    var xb = env._puts;
    var yb = env._mkport;
    var zb = env.__embind_register_float;
    var Ab = env.requireRegisteredType;
    var Bb = env.makeLegalFunctionName;
    var Cb = env.integerReadValueFromPointer;
    var Db = env.heap32VectorToArray;
    var Eb = env.init_emval;
    var Fb = env.whenDependentTypesAreResolved;
    var Gb = env._emscripten_set_main_loop;
    var Hb = env.___errno_location;
    var Ib = env.new_;
    var Jb = env._fputc;
    var Kb = env._environment;
    var Lb = env.__embind_register_function;
    var Mb = env._abort;
    var Nb = env.throwBindingError;
    var Ob = env.ensureOverloadTable;
    var Pb = env.__embind_register_constant;
    var Qb = env._time;
    var Rb = env.requireFunction;
    var Sb = env.runDestructors;
    var Tb = env.getTypeName;
    var Ub = env.__formatString;
    var Vb = env.registerType;
    var Wb = env.exposePublicSymbol;
    var Xb = env._printf;
    var Yb = env.replacePublicSymbol;
    var Zb = env._input_state;
    var _b = 0.0;
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
    function lc(a) {
      a = a | 0;
      var b = 0;
      b = r;
      r = r + a | 0;
      r = r + 15 & -16;
      return b | 0;
    }
    function mc() {
      return r | 0;
    }
    function nc(a) {
      a = a | 0;
      r = a;
    }
    function oc(a, b) {
      a = a | 0;
      b = b | 0;
      r = a;
      s = b;
    }
    function pc(a, b) {
      a = a | 0;
      b = b | 0;
      if (!v) {
        v = a;
        w = b;
      }
    }
    function qc(a) {
      a = a | 0;
      i[t >> 0] = i[a >> 0];
      i[t + 1 >> 0] = i[a + 1 >> 0];
      i[t + 2 >> 0] = i[a + 2 >> 0];
      i[t + 3 >> 0] = i[a + 3 >> 0];
    }
    function rc(a) {
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
    function sc(a) {
      a = a | 0;
      K = a;
    }
    function tc() {
      return K | 0;
    }
    function uc() {
      Wc(42);
      bd();
      Xc(45);
      Yc(42);
      Zc(42);
      _c(42);
      return ;
    }
    function vc(a) {
      a = a | 0;
      Pb(2534852, 432, 1);
      Pb(2534864, 432, 8);
      Pb(2534882, 432, 255);
      Pb(2534894, 432, 0);
      Pb(2534906, 432, 1);
      Pb(2534920, 432, 2);
      Pb(2534933, 432, 3);
      Pb(2534949, 432, 4);
      Pb(2534965, 432, 5);
      Pb(2534979, 432, 6);
      Pb(2534994, 432, 0);
      Pb(2535013, 432, 1);
      Pb(2535032, 432, 2);
      Pb(2535056, 432, 3);
      Pb(2535079, 432, 4);
      Pb(2535099, 432, 5);
      Pb(2535121, 432, 6);
      Pb(2535143, 432, 7);
      Pb(2535166, 432, 8);
      Pb(2535185, 432, 9);
      Pb(2535204, 432, 10);
      Pb(2535223, 432, 11);
      Pb(2535242, 432, 12);
      Pb(2535262, 432, 13);
      Pb(2535282, 432, 14);
      Pb(2535302, 432, 15);
      Pb(2535322, 432, 0);
      Pb(2535347, 432, 1);
      Pb(2535373, 432, 0);
      Pb(2535392, 432, 1);
      Pb(2535411, 432, 0);
      Pb(2535429, 432, 1);
      Pb(2535447, 432, 2);
      Pb(2535468, 432, 3);
      Pb(2535490, 432, 4);
      Pb(2535514, 432, 5);
      Pb(2535540, 432, 6);
      Pb(2535563, 432, 7);
      Pb(2535593, 432, 8);
      Pb(2535625, 432, 0);
      Pb(2535646, 432, 1);
      Pb(2535667, 432, 2);
      Pb(2535694, 432, 3);
      Pb(2535720, 432, 4);
      Pb(2535745, 432, 5);
      Pb(2535770, 432, 6);
      Pb(2535795, 432, 0);
      Pb(2535815, 432, 1);
      Pb(2535835, 432, 2);
      Pb(2535861, 432, 0);
      Pb(2535873, 432, 1);
      Pb(2535884, 432, 255);
      Pb(2535896, 432, 0);
      Pb(2535912, 432, 1);
      Pb(2535923, 432, 2);
      Pb(2535941, 432, 3);
      Pb(2535958, 432, 65536);
      Pb(2535983, 432, 131072);
      Pb(2536003, 432, 1);
      Pb(2536028, 432, 2);
      Pb(2536053, 432, 3);
      Pb(2536078, 432, 6);
      Pb(2536102, 432, 7);
      Pb(2536123, 432, 8);
      Pb(2536157, 432, 9);
      Pb(2536190, 432, 10);
      Pb(2536219, 432, 11);
      Pb(2536253, 432, 12);
      Pb(2536287, 432, 13);
      Pb(2536326, 432, 14);
      Pb(2536352, 432, 15);
      Pb(2536377, 432, 16);
      Pb(2536403, 432, 17);
      Pb(2536435, 432, 18);
      Pb(2536467, 432, 19);
      Pb(2536497, 432, 22);
      Pb(2536528, 432, 21);
      Pb(2536564, 432, 23);
      Pb(2536597, 432, 24);
      Pb(2536639, 432, 65561);
      Pb(2536672, 432, 65562);
      Pb(2536705, 432, 27);
      Pb(2536735, 432, 28);
      Pb(2536766, 432, 29);
      Pb(2536801, 432, 30);
      Pb(2536839, 432, 31);
      Pb(2536870, 432, 32);
      Pb(2536901, 432, 33);
      Pb(2536939, 432, 34);
      Pb(2536970, 432, 35);
      Pb(2537002, 432, 65572);
      Pb(2537030, 432, 37);
      Pb(2537055, 432, 38);
      Pb(2537080, 432, 39);
      Pb(2537105, 432, 1);
      Pb(2537119, 432, 2);
      Pb(2537137, 432, 65536);
      Pb(2537153, 432, 131072);
      Pb(2537169, 432, 196608);
      Pb(2537185, 432, 16777216);
      Pb(2537203, 432, 33554432);
      Pb(2537221, 432, 50331648);
      Pb(2537239, 432, 1);
      Pb(2537248, 432, 2);
      Pb(2537258, 432, 4);
      Pb(2537267, 432, 8);
      Pb(2537279, 432, 16);
      Pb(2537288, 432, 32);
      Pb(2537298, 432, 64);
      Pb(2537308, 432, 128);
      Pb(2537319, 432, 256);
      Pb(2537328, 432, 512);
      Pb(2537340, 432, 1024);
      Pb(2537350, 432, 2048);
      Pb(2537361, 432, 4096);
      Pb(2537371, 432, 8192);
      Pb(2537381, 432, 16384);
      Pb(2537389, 432, 32768);
      Pb(2537398, 432, 0);
      Pb(2537421, 432, 1);
      Pb(2537444, 432, 2);
      Pb(2537467, 360, -1);
      Ja(8, 2537489, 4, 0);
      wb(8, 2537498, 2147483647);
      wb(8, 2537513, 12);
      wb(8, 2537527, 11);
      wb(8, 2537555, 10);
      wb(8, 2537584, 9);
      wb(8, 2537600, 8);
      wb(8, 2537617, 7);
      wb(8, 2537637, 6);
      wb(8, 2537652, 5);
      wb(8, 2537669, 4);
      wb(8, 2537685, 3);
      wb(8, 2537702, 2);
      wb(8, 2537718, 1);
      wb(8, 2537736, 0);
      Ja(16, 2537753, 4, 0);
      wb(16, 2537757, 2147483647);
      wb(16, 2537765, 323);
      wb(16, 2537772, 322);
      wb(16, 2537779, 321);
      wb(16, 2537786, 320);
      wb(16, 2537794, 319);
      wb(16, 2537801, 318);
      wb(16, 2537809, 317);
      wb(16, 2537818, 316);
      wb(16, 2537826, 315);
      wb(16, 2537833, 314);
      wb(16, 2537843, 313);
      wb(16, 2537850, 312);
      wb(16, 2537859, 311);
      wb(16, 2537868, 310);
      wb(16, 2537876, 309);
      wb(16, 2537884, 308);
      wb(16, 2537891, 307);
      wb(16, 2537898, 306);
      wb(16, 2537906, 305);
      wb(16, 2537914, 304);
      wb(16, 2537923, 303);
      wb(16, 2537932, 302);
      wb(16, 2537944, 301);
      wb(16, 2537955, 300);
      wb(16, 2537965, 296);
      wb(16, 2537971, 295);
      wb(16, 2537977, 294);
      wb(16, 2537983, 293);
      wb(16, 2537989, 292);
      wb(16, 2537995, 291);
      wb(16, 2538001, 290);
      wb(16, 2538006, 289);
      wb(16, 2538011, 288);
      wb(16, 2538016, 287);
      wb(16, 2538021, 286);
      wb(16, 2538026, 285);
      wb(16, 2538031, 284);
      wb(16, 2538036, 283);
      wb(16, 2538041, 282);
      wb(16, 2538046, 281);
      wb(16, 2538057, 280);
      wb(16, 2538066, 279);
      wb(16, 2538072, 278);
      wb(16, 2538079, 277);
      wb(16, 2538088, 276);
      wb(16, 2538095, 275);
      wb(16, 2538103, 274);
      wb(16, 2538110, 273);
      wb(16, 2538115, 272);
      wb(16, 2538127, 271);
      wb(16, 2538138, 270);
      wb(16, 2538148, 269);
      wb(16, 2538159, 268);
      wb(16, 2538173, 267);
      wb(16, 2538185, 266);
      wb(16, 2538197, 265);
      wb(16, 2538203, 264);
      wb(16, 2538209, 263);
      wb(16, 2538215, 262);
      wb(16, 2538221, 261);
      wb(16, 2538227, 260);
      wb(16, 2538233, 259);
      wb(16, 2538239, 258);
      wb(16, 2538245, 257);
      wb(16, 2538251, 256);
      wb(16, 2538257, 127);
      wb(16, 2538266, 122);
      wb(16, 2538270, 121);
      wb(16, 2538274, 120);
      wb(16, 2538278, 119);
      wb(16, 2538282, 118);
      wb(16, 2538286, 117);
      wb(16, 2538290, 116);
      wb(16, 2538294, 115);
      wb(16, 2538298, 114);
      wb(16, 2538302, 113);
      wb(16, 2538306, 112);
      wb(16, 2538310, 111);
      wb(16, 2538314, 110);
      wb(16, 2538318, 109);
      wb(16, 2538322, 108);
      wb(16, 2538326, 107);
      wb(16, 2538330, 106);
      wb(16, 2538334, 105);
      wb(16, 2538338, 104);
      wb(16, 2538342, 103);
      wb(16, 2538346, 102);
      wb(16, 2538350, 101);
      wb(16, 2538354, 100);
      wb(16, 2538358, 99);
      wb(16, 2538362, 98);
      wb(16, 2538366, 97);
      wb(16, 2538370, 96);
      wb(16, 2538382, 95);
      wb(16, 2538395, 94);
      wb(16, 2538403, 93);
      wb(16, 2538418, 92);
      wb(16, 2538430, 91);
      wb(16, 2538444, 64);
      wb(16, 2538449, 63);
      wb(16, 2538460, 62);
      wb(16, 2538470, 61);
      wb(16, 2538479, 60);
      wb(16, 2538486, 59);
      wb(16, 2538498, 58);
      wb(16, 2538506, 57);
      wb(16, 2538510, 56);
      wb(16, 2538514, 55);
      wb(16, 2538518, 54);
      wb(16, 2538522, 53);
      wb(16, 2538526, 52);
      wb(16, 2538530, 51);
      wb(16, 2538534, 50);
      wb(16, 2538538, 49);
      wb(16, 2538542, 48);
      wb(16, 2538546, 47);
      wb(16, 2538554, 46);
      wb(16, 2538563, 45);
      wb(16, 2538571, 44);
      wb(16, 2538579, 43);
      wb(16, 2538586, 42);
      wb(16, 2538597, 41);
      wb(16, 2538610, 40);
      wb(16, 2538622, 39);
      wb(16, 2538630, 38);
      wb(16, 2538642, 36);
      wb(16, 2538651, 35);
      wb(16, 2538658, 34);
      wb(16, 2538669, 33);
      wb(16, 2538679, 32);
      wb(16, 2538687, 27);
      wb(16, 2538696, 19);
      wb(16, 2538704, 13);
      wb(16, 2538713, 12);
      wb(16, 2538721, 9);
      wb(16, 2538727, 8);
      wb(16, 2538739, 0);
      wb(16, 2538747, 0);
      Ja(24, 2538757, 4, 0);
      wb(24, 2538761, 2147483647);
      wb(24, 2538771, 64);
      wb(24, 2538785, 32);
      wb(24, 2538798, 16);
      wb(24, 2538810, 8);
      wb(24, 2538819, 4);
      wb(24, 2538827, 2);
      wb(24, 2538836, 1);
      wb(24, 2538846, 0);
      Ja(32, 2538855, 4, 0);
      wb(32, 2538865, 2147483647);
      wb(32, 2538875, 3);
      wb(32, 2538885, 2);
      wb(32, 2538894, 1);
      wb(32, 2538903, 0);
      Ja(40, 2538913, 4, 0);
      wb(40, 2538927, 2147483647);
      wb(40, 2538940, 1);
      wb(40, 2538969, 0);
      Ja(48, 2538997, 4, 0);
      wb(48, 2539011, 2147483647);
      wb(48, 2539031, 1);
      wb(48, 2539061, 0);
      Ja(56, 2539090, 4, 0);
      wb(56, 2539104, 2147483647);
      wb(56, 2539117, 1);
      wb(56, 2539129, 0);
      Ja(64, 2539143, 4, 0);
      wb(64, 2539159, 2147483647);
      wb(64, 2539176, 5);
      wb(64, 2539204, 4);
      wb(64, 2539225, 3);
      wb(64, 2539248, 2);
      wb(64, 2539269, 1);
      wb(64, 2539287, 0);
      Ja(72, 2539303, 4, 0);
      wb(72, 2539316, 2147483647);
      wb(72, 2539337, 2);
      wb(72, 2539357, 1);
      wb(72, 2539379, 0);
      Lb(2539401, 1, 528, 2539406, 51, 43);
      Lb(2539409, 1, 528, 2539406, 51, 44);
      Lb(2539416, 1, 532, 2539428, 42, 42);
      Lb(2539431, 1, 528, 2539406, 51, 45);
      Lb(2539437, 1, 528, 2539406, 51, 46);
      Lb(2539441, 1, 528, 2539406, 51, 47);
      Lb(2539453, 1, 532, 2539428, 42, 43);
      Lb(2539464, 1, 528, 2539406, 51, 48);
      Lb(2539476, 2, 536, 2539492, 43, 43);
      Lb(2539496, 1, 532, 2539428, 42, 44);
      Lb(2539511, 3, 544, 2539538, 42, 43);
      return ;
    }
    function wc(a) {
      a = a | 0;
      gc[a & 63]();
      return ;
    }
    function xc(a) {
      a = a | 0;
      return bc[a & 63]() | 0;
    }
    function yc(a, b) {
      a = a | 0;
      b = b | 0;
      return ec[a & 63](b) | 0;
    }
    function zc(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      dc[a & 63](b, c);
      return ;
    }
    function Ac() {
      vc(0);
      return ;
    }
    function Bc() {
      return 40;
    }
    function Cc(a) {
      a = a | 0;
      var b = 0,
          c = 0;
      b = k[219] | 0;
      i[a >> 0] = b;
      i[a + 1 >> 0] = b >> 8;
      i[a + 2 >> 0] = b >> 16;
      i[a + 3 >> 0] = b >> 24;
      b = a + 4 | 0;
      c = k[220] | 0;
      i[b >> 0] = c;
      i[b + 1 >> 0] = c >> 8;
      i[b + 2 >> 0] = c >> 16;
      i[b + 3 >> 0] = c >> 24;
      b = a + 8 | 0;
      c = k[221] | 0;
      i[b >> 0] = c;
      i[b + 1 >> 0] = c >> 8;
      i[b + 2 >> 0] = c >> 16;
      i[b + 3 >> 0] = c >> 24;
      b = a + 12 | 0;
      c = k[222] | 0;
      i[b >> 0] = c;
      i[b + 1 >> 0] = c >> 8;
      i[b + 2 >> 0] = c >> 16;
      i[b + 3 >> 0] = c >> 24;
      b = a + 16 | 0;
      c = k[223] | 0;
      i[b >> 0] = c;
      i[b + 1 >> 0] = c >> 8;
      i[b + 2 >> 0] = c >> 16;
      i[b + 3 >> 0] = c >> 24;
      b = a + 20 | 0;
      c = k[224] | 0;
      i[b >> 0] = c;
      i[b + 1 >> 0] = c >> 8;
      i[b + 2 >> 0] = c >> 16;
      i[b + 3 >> 0] = c >> 24;
      b = a + 24 | 0;
      c = k[225] | 0;
      i[b >> 0] = c;
      i[b + 1 >> 0] = c >> 8;
      i[b + 2 >> 0] = c >> 16;
      i[b + 3 >> 0] = c >> 24;
      b = a + 28 | 0;
      c = k[226] | 0;
      i[b >> 0] = c;
      i[b + 1 >> 0] = c >> 8;
      i[b + 2 >> 0] = c >> 16;
      i[b + 3 >> 0] = c >> 24;
      b = a + 32 | 0;
      c = k[227] | 0;
      i[b >> 0] = c;
      i[b + 1 >> 0] = c >> 8;
      i[b + 2 >> 0] = c >> 16;
      i[b + 3 >> 0] = c >> 24;
      a = a + 36 | 0;
      b = k[228] | 0;
      i[a >> 0] = b;
      i[a + 1 >> 0] = b >> 8;
      i[a + 2 >> 0] = b >> 16;
      i[a + 3 >> 0] = b >> 24;
      return ;
    }
    function Dc(a) {
      a = a | 0;
      var b = 0;
      k[219] = l[a >> 0] | l[a + 1 >> 0] << 8 | l[a + 2 >> 0] << 16 | l[a + 3 >> 0] << 24;
      b = a + 4 | 0;
      k[220] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + 8 | 0;
      k[221] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + 12 | 0;
      k[222] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + 16 | 0;
      k[223] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + 20 | 0;
      k[224] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + 24 | 0;
      k[225] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + 28 | 0;
      k[226] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + 32 | 0;
      k[227] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      a = a + 36 | 0;
      k[228] = l[a >> 0] | l[a + 1 >> 0] << 8 | l[a + 2 >> 0] << 16 | l[a + 3 >> 0] << 24;
      return ;
    }
    function Ec() {
      var a = 0;
      k[219] = 0;
      k[220] = 0;
      k[221] = 0;
      k[222] = 0;
      k[224] = 0;
      k[225] = 0;
      k[226] = 0;
      k[227] = 80;
      k[228] = 0;
      a = (ec[k[556 >> 2] & 63](65534) | 0) & 255;
      a = (ec[k[556 >> 2] & 63](65535) | 0) & 255 | a << 8;
      k[223] = a;
      return ;
    }
    function Fc(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
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
          s = 0;
      s = r;
      r = r + 80 | 0;
      e = s + 64 | 0;
      i = s + 32 | 0;
      h = s + 8 | 0;
      j = s + 16 | 0;
      g = s + 56 | 0;
      n = s;
      m = s + 24 | 0;
      l = s + 48 | 0;
      c = s + 40 | 0;
      q = s + 68 | 0;
      k[q >> 2] = 0;
      do
        if (!b)
          f = 0;
        else {
          b = k[227] | 0;
          f = k[228] | 0;
          if (b & 64) {
            if ((f | 0) != 1) {
              f = 0;
              break;
            }
            k[228] = 0;
            f = 0;
            break;
          }
          if ((f | 0) == 2)
            f = 7;
          else {
            k[227] = b & -129;
            b = k[223] | 0;
            f = (k[222] | 0) + -1 | 0;
            k[222] = f;
            dc[k[560 >> 2] & 63](f & 65535, b & 255);
            f = (k[222] | 0) + -1 | 0;
            k[222] = f;
            dc[k[560 >> 2] & 63](f & 65535, b >>> 8 & 255);
            b = k[227] | 0;
            f = (k[222] | 0) + -1 | 0;
            k[222] = f;
            dc[k[560 >> 2] & 63](f & 65535, b & 255);
            k[q >> 2] = 3;
            b = k[227] | 0;
            f = 10;
          }
          k[227] = b | 80;
          p = (ec[k[556 >> 2] & 63](65526) | 0) & 255;
          p = (ec[k[556 >> 2] & 63](65527) | 0) & 255 | p << 8;
          k[223] = p;
          k[228] = 0;
          k[q >> 2] = f;
        }
 while (0);
      do
        if (!a) {
          b = k[228] | 0;
          o = 16;
        } else {
          a = k[227] | 0;
          b = k[228] | 0;
          if (a & 16) {
            if ((b | 0) != 1) {
              o = 16;
              break;
            }
            k[228] = 0;
            p = f;
            break;
          }
          if ((b | 0) == 2)
            b = f;
          else {
            k[227] = a | 128;
            rd(255, 888, k[221] | 0, q);
            a = k[227] | 0;
            b = k[q >> 2] | 0;
          }
          k[227] = a | 16;
          p = (ec[k[556 >> 2] & 63](65528) | 0) & 255;
          p = (ec[k[556 >> 2] & 63](65529) | 0) & 255 | p << 8;
          k[223] = p;
          k[228] = 0;
          p = b + 7 | 0;
          k[q >> 2] = p;
        }
 while (0);
      if ((o | 0) == 16)
        if (!b)
          p = f;
        else {
          q = f + 1 | 0;
          r = s;
          return q | 0;
        }
      b = (ec[k[556 >> 2] & 63](k[223] & 65535) | 0) & 255;
      f = k[223] | 0;
      a = f + 1 | 0;
      k[223] = a;
      a: do
        switch (b | 0) {
          case 68:
            {
              m = k[224] | 0;
              o = m >>> 1;
              n = (o | -128) ^ 127;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = k[227] & -14 | m & 1 | (n >>> 1 & n) << 2;
              k[224] = o & 127;
              k[q >> 2] = p + 2;
              break;
            }
          case 84:
            {
              m = k[225] | 0;
              o = m >>> 1;
              n = (o | -128) ^ 127;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = k[227] & -14 | m & 1 | (n >>> 1 & n) << 2;
              k[225] = o & 127;
              k[q >> 2] = p + 2;
              break;
            }
          case 100:
            {
              o = (sd(q) | 0) & 65535;
              m = (ec[k[556 >> 2] & 63](o) | 0) & 255;
              p = m >>> 1;
              n = ~p;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = k[227] & -14 | m & 1 | (n >>> 1 & n) << 2;
              dc[k[560 >> 2] & 63](o, p & 255);
              k[q >> 2] = (k[q >> 2] | 0) + 6;
              break;
            }
          case 116:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              l = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              o = l >>> 1;
              m = ~o;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = k[227] & -14 | l & 1 | (m >>> 1 & m) << 2;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 7;
              break;
            }
          case 86:
            {
              l = k[225] | 0;
              m = k[227] | 0;
              o = m << 7 & 128 | l >>> 1 & 127;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = m & -14 | l & 1 | m << 3 & 8 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 102:
            {
              o = (sd(q) | 0) & 65535;
              l = (ec[k[556 >> 2] & 63](o) | 0) & 255;
              m = k[227] | 0;
              p = m << 7 & 128 | l >>> 1;
              n = ~p;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = m & -14 | l & 1 | m << 3 & 8 | (n >>> 1 & n) << 2;
              dc[k[560 >> 2] & 63](o, p & 255);
              k[q >> 2] = (k[q >> 2] | 0) + 6;
              break;
            }
          case 118:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              j = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              l = k[227] | 0;
              o = l << 7 & 128 | j >>> 1;
              m = ~o;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = l & -14 | j & 1 | l << 3 & 8 | (m >>> 1 & m) << 2;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 7;
              break;
            }
          case 8:
            {
              n = k[226] << 8;
              l = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = l | n & 65280;
              l = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              o = l << 1;
              m = ~o;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = k[227] & -48 | l >>> 7 | l << 2 & 32 | l >>> 3 & 8 | (o ^ l) >>> 6 & 2 | (m >>> 1 & m) << 2;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 6;
              break;
            }
          case 72:
            {
              m = k[224] | 0;
              o = m << 1;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = m >>> 3 & 8 | m << 2 & 32 | m >>> 7 & 1 | k[227] & -48 | (o ^ m) >>> 6 & 2 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 120:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              l = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              o = l << 1;
              m = ~o;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = k[227] & -48 | l >>> 7 | l << 2 & 32 | l >>> 3 & 8 | (o ^ l) >>> 6 & 2 | (m >>> 1 & m) << 2;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 7;
              break;
            }
          case 12:
            {
              n = k[226] << 8;
              l = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = l | n & 65280;
              l = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              o = l + 1 | 0;
              m = -2 - l | 0;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = o >>> 4 & 8 | k[227] & -15 | ((o ^ l) & (l ^ 128)) >>> 6 & 2 | (m >>> 1 & m) << 2;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 6;
              break;
            }
          case 13:
            {
              n = k[226] << 8;
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = (ec[k[556 >> 2] & 63](o | n & 65280) | 0) & 255;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = n >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 6;
              break;
            }
          case 15:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              k[227] = k[227] & -16 | 4;
              dc[k[560 >> 2] & 63](n | o & 65280, 0);
              k[q >> 2] = p + 6;
              break;
            }
          case 79:
            {
              k[227] = k[227] & -16 | 4;
              k[224] = 0;
              k[q >> 2] = p + 2;
              break;
            }
          case 95:
            {
              k[227] = k[227] & -16 | 4;
              k[225] = 0;
              k[q >> 2] = p + 2;
              break;
            }
          case 111:
            {
              p = sd(q) | 0;
              k[227] = k[227] & -16 | 4;
              dc[k[560 >> 2] & 63](p & 65535, 0);
              k[q >> 2] = (k[q >> 2] | 0) + 6;
              break;
            }
          case 240:
            {
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              j = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | j << 8;
              k[223] = (k[223] | 0) + 2;
              i = k[225] | 0;
              j = ~((ec[k[556 >> 2] & 63](j) | 0) & 255);
              n = i + j | 0;
              o = n + 1 | 0;
              m = i << 4;
              l = j << 4;
              n = -2 - n | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (o >>> 4 & 8 | k[227] & -48 | ((o ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              k[225] = o;
              k[q >> 2] = p + 5;
              break;
            }
          case 225:
            {
              l = sd(q) | 0;
              j = k[225] | 0;
              l = ~((ec[k[556 >> 2] & 63](l & 65535) | 0) & 255);
              p = j + l | 0;
              m = p + 1 | 0;
              o = j << 4;
              n = l << 4;
              p = -2 - p | 0;
              p = p & 15 & p >>> 4;
              p = p >>> 2 & p;
              k[227] = (m >>> 4 & 8 | k[227] & -48 | ((m ^ j) & (j ^ 128 ^ l)) >>> 6 & 2 | ((m ^ 128) & (j | l) | j & l) >>> 7 & 1 | ((m << 4 ^ 128) & (n | o) | n & o) >>> 2 & 32 | (p >>> 1 & p) << 2) ^ 1;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 241:
            {
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              j = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | j << 8;
              k[223] = (k[223] | 0) + 2;
              i = k[225] | 0;
              j = ~((ec[k[556 >> 2] & 63](j) | 0) & 255);
              o = i + j | 0;
              l = o + 1 | 0;
              n = i << 4;
              m = j << 4;
              o = -2 - o | 0;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = (l >>> 4 & 8 | k[227] & -48 | ((l ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((l ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((l << 4 ^ 128) & (m | n) | m & n) >>> 2 & 32 | (o >>> 1 & o) << 2) ^ 1;
              k[q >> 2] = p + 5;
              break;
            }
          case 130:
            {
              i = k[224] | 0;
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              j = ~j;
              h = k[227] | 0;
              o = i + j + (h & 1 ^ 1) | 0;
              m = i << 4;
              l = j << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (o >>> 4 & 8 | h & -48 | ((o ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 0:
            {
              n = k[226] << 8;
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = j | n & 65280;
              j = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              l = ~j;
              o = 0 - j | 0;
              m = j + -1 | 0;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = (o >>> 4 & 8 | k[227] & -48 | (j & o) >>> 6 & 2 | ((o ^ 128) & l) >>> 7 & 1 | ((o << 4 ^ 128) & l << 4) >>> 2 & 32 | (m >>> 1 & m) << 2) ^ 1;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 6;
              break;
            }
          case 115:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              m = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              o = ~m;
              m = m >>> 4 & m;
              m = m >>> 2 & m;
              k[227] = k[227] & -16 | o >>> 4 & 8 | (m >>> 1 & m) << 2 | 1;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 7;
              break;
            }
          case 64:
            {
              l = k[224] | 0;
              m = ~l;
              o = 0 - l | 0;
              n = l + -1 | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (k[227] & -48 | o >>> 4 & 8 | (l & o) >>> 6 & 2 | ((o ^ 128) & m) >>> 7 & 1 | ((o << 4 ^ 128) & m << 4) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 4:
            {
              n = k[226] << 8;
              l = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = l | n & 65280;
              l = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              o = l >>> 1;
              m = ~o;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = k[227] & -14 | l & 1 | (m >>> 1 & m) << 2;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 6;
              break;
            }
          case 6:
            {
              n = k[226] << 8;
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = j | n & 65280;
              j = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              l = k[227] | 0;
              o = l << 7 & 128 | j >>> 1;
              m = ~o;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = l & -14 | j & 1 | l << 3 & 8 | (m >>> 1 & m) << 2;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 6;
              break;
            }
          case 88:
            {
              m = k[225] | 0;
              o = m << 1;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = m >>> 3 & 8 | m << 2 & 32 | m >>> 7 & 1 | k[227] & -48 | (o ^ m) >>> 6 & 2 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 104:
            {
              o = (sd(q) | 0) & 65535;
              m = (ec[k[556 >> 2] & 63](o) | 0) & 255;
              p = m << 1;
              n = ~p;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = k[227] & -48 | m >>> 7 | m << 2 & 32 | m >>> 3 & 8 | (p ^ m) >>> 6 & 2 | (n >>> 1 & n) << 2;
              dc[k[560 >> 2] & 63](o, p & 255);
              k[q >> 2] = (k[q >> 2] | 0) + 6;
              break;
            }
          case 89:
            {
              m = k[225] | 0;
              j = k[227] | 0;
              l = m << 1;
              o = j & 1 | l;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = m >>> 7 & 1 | m >>> 3 & 8 | j & -16 | (l ^ m) >>> 6 & 2 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 105:
            {
              o = (sd(q) | 0) & 65535;
              m = (ec[k[556 >> 2] & 63](o) | 0) & 255;
              j = k[227] | 0;
              l = m << 1;
              p = j & 1 | l;
              n = ~p;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = j & -16 | m >>> 7 | m >>> 3 & 8 | (l ^ m) >>> 6 & 2 | (n >>> 1 & n) << 2;
              dc[k[560 >> 2] & 63](o, p & 255);
              k[q >> 2] = (k[q >> 2] | 0) + 6;
              break;
            }
          case 92:
            {
              m = k[225] | 0;
              o = m + 1 | 0;
              n = -2 - m | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | ((o ^ m) & (m ^ 128)) >>> 6 & 2 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 77:
            {
              n = k[224] | 0;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 2;
              break;
            }
          case 93:
            {
              n = k[225] | 0;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 2;
              break;
            }
          case 109:
            {
              o = sd(q) | 0;
              o = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
              p = ~o;
              p = p & 15 & p >>> 4;
              p = p >>> 2 & p;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (p >>> 1 & p) << 2;
              k[q >> 2] = (k[q >> 2] | 0) + 6;
              break;
            }
          case 125:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              n = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = n >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 7;
              break;
            }
          case 127:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              k[227] = k[227] & -16 | 4;
              dc[k[560 >> 2] & 63](o, 0);
              k[q >> 2] = p + 7;
              break;
            }
          case 145:
            {
              j = k[226] << 8;
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              i = k[224] | 0;
              j = ~((ec[k[556 >> 2] & 63](o | j & 65280) | 0) & 255);
              o = i + j | 0;
              l = o + 1 | 0;
              n = i << 4;
              m = j << 4;
              o = -2 - o | 0;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = (l >>> 4 & 8 | k[227] & -48 | ((l ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((l ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((l << 4 ^ 128) & (m | n) | m & n) >>> 2 & 32 | (o >>> 1 & o) << 2) ^ 1;
              k[q >> 2] = p + 4;
              break;
            }
          case 161:
            {
              l = sd(q) | 0;
              j = k[224] | 0;
              l = ~((ec[k[556 >> 2] & 63](l & 65535) | 0) & 255);
              p = j + l | 0;
              m = p + 1 | 0;
              o = j << 4;
              n = l << 4;
              p = -2 - p | 0;
              p = p & 15 & p >>> 4;
              p = p >>> 2 & p;
              k[227] = (m >>> 4 & 8 | k[227] & -48 | ((m ^ j) & (j ^ 128 ^ l)) >>> 6 & 2 | ((m ^ 128) & (j | l) | j & l) >>> 7 & 1 | ((m << 4 ^ 128) & (n | o) | n & o) >>> 2 & 32 | (p >>> 1 & p) << 2) ^ 1;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 132:
            {
              o = k[224] | 0;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = n & o;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 228:
            {
              p = sd(q) | 0;
              p = k[225] & ((ec[k[556 >> 2] & 63](p & 65535) | 0) & 255);
              o = ~p;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = p >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[225] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 149:
            {
              n = k[226] << 8;
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = k[224] & ((ec[k[556 >> 2] & 63](o | n & 65280) | 0) & 255);
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = n >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 4;
              break;
            }
          case 151:
            {
              n = k[226] << 8;
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              dc[k[560 >> 2] & 63](o | n & 65280, k[224] & 255);
              n = k[224] | 0;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 4;
              break;
            }
          case 183:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              dc[k[560 >> 2] & 63](n, k[224] & 255);
              n = k[224] | 0;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 5;
              break;
            }
          case 215:
            {
              n = k[226] << 8;
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              dc[k[560 >> 2] & 63](o | n & 65280, k[225] & 255);
              n = k[225] | 0;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 4;
              break;
            }
          case 231:
            {
              o = sd(q) | 0;
              dc[k[560 >> 2] & 63](o & 65535, k[225] & 255);
              o = k[225] | 0;
              p = ~o;
              p = p & 15 & p >>> 4;
              p = p >>> 2 & p;
              k[227] = k[227] & -15 | o >>> 4 & 8 | (p >>> 1 & p) << 2;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 152:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = k[224] ^ (ec[k[556 >> 2] & 63](n | o & 65280) | 0) & 255;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 168:
            {
              p = sd(q) | 0;
              p = k[224] ^ (ec[k[556 >> 2] & 63](p & 65535) | 0) & 255;
              o = ~p;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = p >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[224] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 203:
            {
              j = k[225] | 0;
              i = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = i + j | 0;
              m = j << 4;
              l = i << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -48 | ((o ^ j) & (j ^ 128 ^ i)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 251:
            {
              i = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              i = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | i << 8;
              k[223] = (k[223] | 0) + 2;
              j = k[225] | 0;
              i = (ec[k[556 >> 2] & 63](i) | 0) & 255;
              o = i + j | 0;
              m = j << 4;
              l = i << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -48 | ((o ^ j) & (j ^ 128 ^ i)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 5;
              break;
            }
          case 147:
            {
              o = k[226] << 8;
              l = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = l | o;
              l = k[224] | 0;
              m = k[225] & 255 | l << 8;
              j = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
              j = ~((ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | j << 8);
              m = m + j | 0;
              o = m + 1 | 0;
              n = o >>> 8;
              m = -2 - m | 0;
              m = m & 255 & m >>> 8;
              m = m >>> 4 & m;
              m = m >>> 2 & m;
              j = j >>> 8;
              k[227] = (o >>> 12 & 8 | k[227] & -16 | ((n ^ l) & (l ^ 128 ^ j)) >>> 6 & 2 | ((n ^ 128) & (j | l) | j & l) >>> 7 & 1 | (m & 1 & m >>> 1) << 2) ^ 1;
              k[224] = n;
              k[225] = o;
              k[q >> 2] = p + 6;
              break;
            }
          case 156:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = n | o;
              n = k[219] | 0;
              m = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
              m = ~((ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | m << 8);
              o = n + m | 0;
              j = o + 1 | 0;
              l = j >>> 8;
              o = -2 - o | 0;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              n = n >>> 8;
              m = m >>> 8;
              k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
              k[q >> 2] = p + 6;
              break;
            }
          case 222:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = n | o;
              n = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | n << 8;
              k[221] = o;
              o = ~o;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 5;
              break;
            }
          case 255:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              n = k[221] | 0;
              dc[k[560 >> 2] & 63](o, n >>> 8 & 255);
              dc[k[560 >> 2] & 63](o + 1 & 65535, n & 255);
              n = k[221] | 0;
              o = ~n;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 12 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 6;
              break;
            }
          case 221:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = n | o;
              n = k[225] | 0;
              dc[k[560 >> 2] & 63](o & 65535, k[224] & 255);
              dc[k[560 >> 2] & 63](o + 1 & 65535, n & 255);
              n = k[224] | 0;
              o = ~(k[225] & 255 | n << 8);
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 5;
              break;
            }
          case 39:
          case 38:
            {
              o = (k[227] | 0) >>> 2;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1 + ((((n | -129) ^ 128) + 1 | n) & ((o ^ b) & 1) + -1);
              k[q >> 2] = p + 3;
              break;
            }
          case 45:
          case 44:
            {
              o = k[227] | 0;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1 + ((((n | -129) ^ 128) + 1 | n) & ((o >>> 1 ^ b ^ o >>> 3) & 1) + -1);
              k[q >> 2] = p + 3;
              break;
            }
          case 52:
            {
              p = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              rd(p, 888, k[221] | 0, q);
              k[q >> 2] = (k[q >> 2] | 0) + 5;
              break;
            }
          case 53:
            {
              p = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              td(p, 888, 884, q);
              k[q >> 2] = (k[q >> 2] | 0) + 5;
              break;
            }
          case 54:
            {
              p = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              rd(p, 884, k[222] | 0, q);
              k[q >> 2] = (k[q >> 2] | 0) + 5;
              break;
            }
          case 80:
            {
              l = k[225] | 0;
              m = ~l;
              o = 0 - l | 0;
              n = l + -1 | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (k[227] & -48 | o >>> 4 & 8 | (l & o) >>> 6 & 2 | ((o ^ 128) & m) >>> 7 & 1 | ((o << 4 ^ 128) & m << 4) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 96:
            {
              o = (sd(q) | 0) & 65535;
              l = (ec[k[556 >> 2] & 63](o) | 0) & 255;
              m = ~l;
              p = 0 - l | 0;
              n = l + -1 | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (p >>> 4 & 8 | k[227] & -48 | (l & p) >>> 6 & 2 | ((p ^ 128) & m) >>> 7 & 1 | ((p << 4 ^ 128) & m << 4) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              dc[k[560 >> 2] & 63](o, p & 255);
              k[q >> 2] = (k[q >> 2] | 0) + 6;
              break;
            }
          case 112:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              j = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              l = ~j;
              o = 0 - j | 0;
              m = j + -1 | 0;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = (o >>> 4 & 8 | k[227] & -48 | (j & o) >>> 6 & 2 | ((o ^ 128) & l) >>> 7 & 1 | ((o << 4 ^ 128) & l << 4) >>> 2 & 32 | (m >>> 1 & m) << 2) ^ 1;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 7;
              break;
            }
          case 83:
            {
              n = k[225] | 0;
              o = ~n;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -16 | (n >>> 1 & n) << 2 | 1;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 99:
            {
              o = (sd(q) | 0) & 65535;
              n = (ec[k[556 >> 2] & 63](o) | 0) & 255;
              p = ~n;
              n = n >>> 4 & n;
              n = n >>> 2 & n;
              k[227] = k[227] & -16 | p >>> 4 & 8 | (n >>> 1 & n) << 2 | 1;
              dc[k[560 >> 2] & 63](o, p & 255);
              k[q >> 2] = (k[q >> 2] | 0) + 6;
              break;
            }
          case 70:
            {
              l = k[224] | 0;
              m = k[227] | 0;
              o = m << 7 & 128 | l >>> 1 & 127;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = m & -14 | l & 1 | m << 3 & 8 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 7:
            {
              n = k[226] << 8;
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = j | n & 65280;
              j = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              l = j & 128;
              o = j >>> 1 | l;
              m = ~o;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = k[227] & -14 | j & 1 | l >>> 4 | (m >>> 1 & m) << 2;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 6;
              break;
            }
          case 87:
            {
              m = k[225] | 0;
              l = m & 128;
              o = m >>> 1 & 127 | l;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = l >>> 4 | m & 1 | k[227] & -14 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 103:
            {
              o = (sd(q) | 0) & 65535;
              l = (ec[k[556 >> 2] & 63](o) | 0) & 255;
              m = l & 128;
              p = l >>> 1 | m;
              n = ~p;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = k[227] & -14 | l & 1 | m >>> 4 | (n >>> 1 & n) << 2;
              dc[k[560 >> 2] & 63](o, p & 255);
              k[q >> 2] = (k[q >> 2] | 0) + 6;
              break;
            }
          case 119:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              j = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              l = j & 128;
              o = j >>> 1 | l;
              m = ~o;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = k[227] & -14 | j & 1 | l >>> 4 | (m >>> 1 & m) << 2;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 7;
              break;
            }
          case 9:
            {
              n = k[226] << 8;
              l = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = l | n & 65280;
              l = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              i = k[227] | 0;
              j = l << 1;
              o = i & 1 | j;
              m = ~o;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = i & -16 | l >>> 7 | l >>> 3 & 8 | (j ^ l) >>> 6 & 2 | (m >>> 1 & m) << 2;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 6;
              break;
            }
          case 73:
            {
              m = k[224] | 0;
              j = k[227] | 0;
              l = m << 1;
              o = j & 1 | l;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = m >>> 7 & 1 | m >>> 3 & 8 | j & -16 | (l ^ m) >>> 6 & 2 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 121:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              l = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              i = k[227] | 0;
              j = l << 1;
              o = i & 1 | j;
              m = ~o;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = i & -16 | l >>> 7 | l >>> 3 & 8 | (j ^ l) >>> 6 & 2 | (m >>> 1 & m) << 2;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 7;
              break;
            }
          case 106:
            {
              o = (sd(q) | 0) & 65535;
              m = (ec[k[556 >> 2] & 63](o) | 0) & 255;
              p = m + 255 | 0;
              n = -256 - m | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = p >>> 4 & 8 | k[227] & -15 | ((p ^ 128) & m) >>> 6 & 2 | (n >>> 1 & n) << 2;
              dc[k[560 >> 2] & 63](o, p & 255);
              k[q >> 2] = (k[q >> 2] | 0) + 6;
              break;
            }
          case 76:
            {
              m = k[224] | 0;
              o = m + 1 | 0;
              n = -2 - m | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | ((o ^ m) & (m ^ 128)) >>> 6 & 2 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 108:
            {
              o = (sd(q) | 0) & 65535;
              m = (ec[k[556 >> 2] & 63](o) | 0) & 255;
              p = m + 1 | 0;
              n = -2 - m | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = p >>> 4 & 8 | k[227] & -15 | ((p ^ m) & (m ^ 128)) >>> 6 & 2 | (n >>> 1 & n) << 2;
              dc[k[560 >> 2] & 63](o, p & 255);
              k[q >> 2] = (k[q >> 2] | 0) + 6;
              break;
            }
          case 14:
            {
              o = k[226] << 8 | (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = o;
              k[q >> 2] = p + 3;
              break;
            }
          case 110:
            {
              p = sd(q) | 0;
              k[223] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 3;
              break;
            }
          case 192:
            {
              i = k[225] | 0;
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              j = ~j;
              n = i + j | 0;
              o = n + 1 | 0;
              m = i << 4;
              l = j << 4;
              n = -2 - n | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (o >>> 4 & 8 | k[227] & -48 | ((o ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 208:
            {
              j = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              i = k[225] | 0;
              j = ~((ec[k[556 >> 2] & 63](n | j & 65280) | 0) & 255);
              n = i + j | 0;
              o = n + 1 | 0;
              m = i << 4;
              l = j << 4;
              n = -2 - n | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (o >>> 4 & 8 | k[227] & -48 | ((o ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              k[225] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 224:
            {
              l = sd(q) | 0;
              j = k[225] | 0;
              l = ~((ec[k[556 >> 2] & 63](l & 65535) | 0) & 255);
              o = j + l | 0;
              p = o + 1 | 0;
              n = j << 4;
              m = l << 4;
              o = -2 - o | 0;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = (p >>> 4 & 8 | k[227] & -48 | ((p ^ j) & (j ^ 128 ^ l)) >>> 6 & 2 | ((p ^ 128) & (j | l) | j & l) >>> 7 & 1 | ((p << 4 ^ 128) & (m | n) | m & n) >>> 2 & 32 | (o >>> 1 & o) << 2) ^ 1;
              k[225] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 129:
            {
              i = k[224] | 0;
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              j = ~j;
              o = i + j | 0;
              l = o + 1 | 0;
              n = i << 4;
              m = j << 4;
              o = -2 - o | 0;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = (l >>> 4 & 8 | k[227] & -48 | ((l ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((l ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((l << 4 ^ 128) & (m | n) | m & n) >>> 2 & 32 | (o >>> 1 & o) << 2) ^ 1;
              k[q >> 2] = p + 2;
              break;
            }
          case 209:
            {
              j = k[226] << 8;
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              i = k[225] | 0;
              j = ~((ec[k[556 >> 2] & 63](o | j & 65280) | 0) & 255);
              o = i + j | 0;
              l = o + 1 | 0;
              n = i << 4;
              m = j << 4;
              o = -2 - o | 0;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = (l >>> 4 & 8 | k[227] & -48 | ((l ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((l ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((l << 4 ^ 128) & (m | n) | m & n) >>> 2 & 32 | (o >>> 1 & o) << 2) ^ 1;
              k[q >> 2] = p + 4;
              break;
            }
          case 162:
            {
              l = sd(q) | 0;
              j = k[224] | 0;
              l = ~((ec[k[556 >> 2] & 63](l & 65535) | 0) & 255);
              i = k[227] | 0;
              p = j + l + (i & 1 ^ 1) | 0;
              n = j << 4;
              m = l << 4;
              o = ~p;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = (p >>> 4 & 8 | i & -48 | ((p ^ j) & (j ^ 128 ^ l)) >>> 6 & 2 | ((p ^ 128) & (j | l) | j & l) >>> 7 & 1 | ((p << 4 ^ 128) & (m | n) | m & n) >>> 2 & 32 | (o >>> 1 & o) << 2) ^ 1;
              k[224] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 148:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = k[224] & ((ec[k[556 >> 2] & 63](n | o & 65280) | 0) & 255);
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 212:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = k[225] & ((ec[k[556 >> 2] & 63](n | o & 65280) | 0) & 255);
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 244:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              o = k[225] & ((ec[k[556 >> 2] & 63](o) | 0) & 255);
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 5;
              break;
            }
          case 133:
            {
              n = k[224] | 0;
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = o & n;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = n >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 2;
              break;
            }
          case 245:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              n = k[225] & ((ec[k[556 >> 2] & 63](n) | 0) & 255);
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = n >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 5;
              break;
            }
          case 134:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              k[224] = n;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 2;
              break;
            }
          case 150:
            {
              n = k[226] << 8;
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = (ec[k[556 >> 2] & 63](o | n & 65280) | 0) & 255;
              k[224] = n;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = n >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 4;
              break;
            }
          case 166:
            {
              o = sd(q) | 0;
              o = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
              k[224] = o;
              p = ~o;
              p = p & 15 & p >>> 4;
              p = p >>> 2 & p;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (p >>> 1 & p) << 2;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 184:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              o = k[224] ^ (ec[k[556 >> 2] & 63](o) | 0) & 255;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 5;
              break;
            }
          case 232:
            {
              p = sd(q) | 0;
              p = k[225] ^ (ec[k[556 >> 2] & 63](p & 65535) | 0) & 255;
              o = ~p;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = p >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[225] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 249:
            {
              i = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              i = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | i << 8;
              k[223] = (k[223] | 0) + 2;
              j = k[225] | 0;
              i = (ec[k[556 >> 2] & 63](i) | 0) & 255;
              h = k[227] | 0;
              o = i + j + (h & 1) | 0;
              m = j << 4;
              l = i << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | h & -48 | ((o ^ j) & (j ^ 128 ^ i)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 5;
              break;
            }
          case 138:
            {
              o = k[224] | 0;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = n | o;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 171:
            {
              j = sd(q) | 0;
              l = k[224] | 0;
              j = (ec[k[556 >> 2] & 63](j & 65535) | 0) & 255;
              p = j + l | 0;
              n = l << 4;
              m = j << 4;
              o = ~p;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = p >>> 4 & 8 | k[227] & -48 | ((p ^ l) & (l ^ 128 ^ j)) >>> 6 & 2 | ((p ^ 128) & (j | l) | j & l) >>> 7 & 1 | ((p << 4 ^ 128) & (m | n) | m & n) >>> 2 & 32 | (o >>> 1 & o) << 2;
              k[224] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 187:
            {
              i = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              i = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | i << 8;
              k[223] = (k[223] | 0) + 2;
              j = k[224] | 0;
              i = (ec[k[556 >> 2] & 63](i) | 0) & 255;
              o = i + j | 0;
              m = j << 4;
              l = i << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -48 | ((o ^ j) & (j ^ 128 ^ i)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 5;
              break;
            }
          case 163:
            {
              p = sd(q) | 0;
              m = k[224] | 0;
              n = k[225] & 255 | m << 8;
              l = (ec[k[556 >> 2] & 63](p & 65535) | 0) & 255;
              l = ~((ec[k[556 >> 2] & 63](p + 1 & 65535) | 0) & 255 | l << 8);
              n = n + l | 0;
              p = n + 1 | 0;
              o = p >>> 8;
              n = -2 - n | 0;
              n = n & 255 & n >>> 8;
              n = n >>> 4 & n;
              n = n >>> 2 & n;
              l = l >>> 8;
              k[227] = (p >>> 12 & 8 | k[227] & -16 | ((o ^ m) & (m ^ 128 ^ l)) >>> 6 & 2 | ((o ^ 128) & (l | m) | l & m) >>> 7 & 1 | (n & 1 & n >>> 1) << 2) ^ 1;
              k[224] = o;
              k[225] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 6;
              break;
            }
          case 188:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              n = k[219] | 0;
              m = (ec[k[556 >> 2] & 63](o) | 0) & 255;
              m = ~((ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | m << 8);
              o = n + m | 0;
              j = o + 1 | 0;
              l = j >>> 8;
              o = -2 - o | 0;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              n = n >>> 8;
              m = m >>> 8;
              k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
              k[q >> 2] = p + 7;
              break;
            }
          case 190:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              n = (ec[k[556 >> 2] & 63](o) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | n << 8;
              k[219] = o;
              o = ~o;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 6;
              break;
            }
          case 175:
            {
              p = sd(q) | 0;
              o = k[219] | 0;
              dc[k[560 >> 2] & 63](p & 65535, o >>> 8 & 255);
              dc[k[560 >> 2] & 63](p + 1 & 65535, o & 255);
              o = k[219] | 0;
              p = ~o;
              p = p & 255 & p >>> 8;
              p = p >>> 4 & p;
              p = p >>> 2 & p;
              k[227] = k[227] & -15 | o >>> 12 & 8 | (p & 1 & p >>> 1) << 2;
              k[q >> 2] = (k[q >> 2] | 0) + 5;
              break;
            }
          case 223:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = n | o;
              n = k[221] | 0;
              dc[k[560 >> 2] & 63](o & 65535, n >>> 8 & 255);
              dc[k[560 >> 2] & 63](o + 1 & 65535, n & 255);
              n = k[221] | 0;
              o = ~n;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 12 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 5;
              break;
            }
          case 211:
            {
              n = k[226] << 8;
              l = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = l | n;
              l = k[224] | 0;
              o = k[225] & 255 | l << 8;
              j = (ec[k[556 >> 2] & 63](n & 65535) | 0) & 255;
              o = ((ec[k[556 >> 2] & 63](n + 1 & 65535) | 0) & 255 | j << 8) + o | 0;
              n = o >>> 8;
              m = ~o;
              m = m & 255 & m >>> 8;
              m = m >>> 4 & m;
              m = m >>> 2 & m;
              k[227] = o >>> 12 & 8 | k[227] & -16 | ((n ^ l) & (l ^ 128 ^ j)) >>> 6 & 2 | ((n ^ 128) & (j | l) | j & l) >>> 7 & 1 | (m & 1 & m >>> 1) << 2;
              k[224] = n;
              k[225] = o;
              k[q >> 2] = p + 6;
              break;
            }
          case 252:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              n = (ec[k[556 >> 2] & 63](o) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | n << 8;
              k[224] = n;
              k[225] = o;
              o = ~o;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 6;
              break;
            }
          case 41:
          case 40:
            {
              o = (k[227] | 0) >>> 1;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1 + ((((n | -129) ^ 128) + 1 | n) & ((o ^ b) & 1) + -1);
              k[q >> 2] = p + 3;
              break;
            }
          case 43:
          case 42:
            {
              o = (k[227] | 0) >>> 3;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1 + ((((n | -129) ^ 128) + 1 | n) & ((o ^ b) & 1) + -1);
              k[q >> 2] = p + 3;
              break;
            }
          case 173:
            {
              p = sd(q) | 0;
              o = k[223] | 0;
              n = (k[222] | 0) + -1 | 0;
              k[222] = n;
              dc[k[560 >> 2] & 63](n & 65535, o & 255);
              n = (k[222] | 0) + -1 | 0;
              k[222] = n;
              dc[k[560 >> 2] & 63](n & 65535, o >>> 8 & 255);
              k[223] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 7;
              break;
            }
          case 189:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              n = (k[223] | 0) + 2 | 0;
              k[223] = n;
              m = (k[222] | 0) + -1 | 0;
              k[222] = m;
              dc[k[560 >> 2] & 63](m & 65535, n & 255);
              m = (k[222] | 0) + -1 | 0;
              k[222] = m;
              dc[k[560 >> 2] & 63](m & 65535, n >>> 8 & 255);
              k[223] = o;
              k[q >> 2] = p + 8;
              break;
            }
          case 48:
            {
              p = sd(q) | 0;
              k[219] = p;
              p = ~p;
              p = p & 255 & p >>> 8;
              p = p >>> 4 & p;
              p = p >>> 2 & p;
              k[227] = (p & 1 & p >>> 1) << 2 | k[227] & -5;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 49:
            {
              p = sd(q) | 0;
              k[220] = p;
              p = ~p;
              p = p & 255 & p >>> 8;
              p = p >>> 4 & p;
              p = p >>> 2 & p;
              k[227] = (p & 1 & p >>> 1) << 2 | k[227] & -5;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 50:
            {
              p = sd(q) | 0;
              k[222] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 51:
            {
              p = sd(q) | 0;
              k[221] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 58:
            {
              k[219] = (k[219] | 0) + (k[225] & 255);
              k[q >> 2] = p + 3;
              break;
            }
          case 26:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              k[227] = k[227] | o;
              k[q >> 2] = p + 3;
              break;
            }
          case 28:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              k[227] = k[227] & o;
              k[q >> 2] = p + 3;
              break;
            }
          case 29:
            {
              m = k[225] | 0;
              o = ((m | -129) ^ 128) + 1 | 0;
              m = o | m & 255;
              n = o >>> 8;
              k[224] = n;
              k[225] = m;
              n = ~(m & 255 | n << 8);
              n = n & 255 & n >>> 8;
              n = n >>> 4 & n;
              n = n >>> 2 & n;
              k[227] = (n & 1 & n >>> 1) << 2 | (o >>> 12 & 8 | k[227] & -13);
              k[q >> 2] = p + 2;
              break;
            }
          case 30:
            {
              d = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              e = (k[223] | 0) + 1 | 0;
              k[223] = e;
              f = d & 15;
              do
                switch (f | 0) {
                  case 11:
                    {
                      a = k[226] | 65280;
                      break;
                    }
                  case 5:
                    {
                      a = e;
                      break;
                    }
                  case 0:
                    {
                      a = k[225] & 255 | k[224] << 8;
                      break;
                    }
                  case 1:
                    {
                      a = k[219] | 0;
                      break;
                    }
                  case 2:
                    {
                      a = k[220] | 0;
                      break;
                    }
                  case 3:
                    {
                      a = k[221] | 0;
                      break;
                    }
                  case 4:
                    {
                      a = k[222] | 0;
                      break;
                    }
                  case 8:
                    {
                      a = k[224] | 65280;
                      break;
                    }
                  case 9:
                    {
                      a = k[225] | 65280;
                      break;
                    }
                  case 10:
                    {
                      a = k[227] | 65280;
                      break;
                    }
                  default:
                    {
                      k[c >> 2] = f;
                      Xb(2588863, c | 0) | 0;
                      a = 65535;
                    }
                }
 while (0);
              d = d >>> 4;
              do
                switch (d | 0) {
                  case 0:
                    {
                      e = k[225] & 255 | k[224] << 8;
                      break;
                    }
                  case 1:
                    {
                      e = k[219] | 0;
                      break;
                    }
                  case 2:
                    {
                      e = k[220] | 0;
                      break;
                    }
                  case 3:
                    {
                      e = k[221] | 0;
                      break;
                    }
                  case 4:
                    {
                      e = k[222] | 0;
                      break;
                    }
                  case 5:
                    {
                      e = k[223] | 0;
                      break;
                    }
                  case 8:
                    {
                      e = k[224] | 65280;
                      break;
                    }
                  case 9:
                    {
                      e = k[225] | 65280;
                      break;
                    }
                  case 10:
                    {
                      e = k[227] | 65280;
                      break;
                    }
                  case 11:
                    {
                      e = k[226] | 65280;
                      break;
                    }
                  default:
                    {
                      k[l >> 2] = d;
                      Xb(2588863, l | 0) | 0;
                      e = 65535;
                    }
                }
 while (0);
              do
                switch (f | 0) {
                  case 8:
                    {
                      k[224] = e;
                      break;
                    }
                  case 9:
                    {
                      k[225] = e;
                      break;
                    }
                  case 10:
                    {
                      k[227] = e;
                      break;
                    }
                  case 11:
                    {
                      k[226] = e;
                      break;
                    }
                  case 0:
                    {
                      k[224] = e >>> 8;
                      k[225] = e;
                      break;
                    }
                  case 1:
                    {
                      k[219] = e;
                      break;
                    }
                  case 2:
                    {
                      k[220] = e;
                      break;
                    }
                  case 3:
                    {
                      k[221] = e;
                      break;
                    }
                  case 4:
                    {
                      k[222] = e;
                      break;
                    }
                  case 5:
                    {
                      k[223] = e;
                      break;
                    }
                  default:
                    {
                      k[m >> 2] = f;
                      Xb(2588863, m | 0) | 0;
                    }
                }
 while (0);
              do
                switch (d | 0) {
                  case 0:
                    {
                      k[224] = a >>> 8;
                      k[225] = a;
                      break;
                    }
                  case 1:
                    {
                      k[219] = a;
                      break;
                    }
                  case 2:
                    {
                      k[220] = a;
                      break;
                    }
                  case 3:
                    {
                      k[221] = a;
                      break;
                    }
                  case 4:
                    {
                      k[222] = a;
                      break;
                    }
                  case 5:
                    {
                      k[223] = a;
                      break;
                    }
                  case 8:
                    {
                      k[224] = a;
                      break;
                    }
                  case 9:
                    {
                      k[225] = a;
                      break;
                    }
                  case 10:
                    {
                      k[227] = a;
                      break;
                    }
                  case 11:
                    {
                      k[226] = a;
                      break;
                    }
                  default:
                    {
                      k[n >> 2] = d;
                      Xb(2588863, n | 0) | 0;
                    }
                }
 while (0);
              k[q >> 2] = p + 8;
              break;
            }
          case 31:
            {
              e = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              c = (k[223] | 0) + 1 | 0;
              k[223] = c;
              d = e & 15;
              e = e >>> 4;
              do
                switch (e | 0) {
                  case 0:
                    {
                      c = k[225] & 255 | k[224] << 8;
                      break;
                    }
                  case 1:
                    {
                      c = k[219] | 0;
                      break;
                    }
                  case 2:
                    {
                      c = k[220] | 0;
                      break;
                    }
                  case 3:
                    {
                      c = k[221] | 0;
                      break;
                    }
                  case 10:
                    {
                      c = k[227] | 65280;
                      break;
                    }
                  case 11:
                    {
                      c = k[226] | 65280;
                      break;
                    }
                  case 5:
                    break;
                  case 4:
                    {
                      c = k[222] | 0;
                      break;
                    }
                  case 8:
                    {
                      c = k[224] | 65280;
                      break;
                    }
                  case 9:
                    {
                      c = k[225] | 65280;
                      break;
                    }
                  default:
                    {
                      k[g >> 2] = e;
                      Xb(2588863, g | 0) | 0;
                      c = 65535;
                    }
                }
 while (0);
              do
                switch (d | 0) {
                  case 0:
                    {
                      k[224] = c >>> 8;
                      k[225] = c;
                      break;
                    }
                  case 1:
                    {
                      k[219] = c;
                      break;
                    }
                  case 2:
                    {
                      k[220] = c;
                      break;
                    }
                  case 3:
                    {
                      k[221] = c;
                      break;
                    }
                  case 4:
                    {
                      k[222] = c;
                      break;
                    }
                  case 5:
                    {
                      k[223] = c;
                      break;
                    }
                  case 8:
                    {
                      k[224] = c;
                      break;
                    }
                  case 9:
                    {
                      k[225] = c;
                      break;
                    }
                  case 10:
                    {
                      k[227] = c;
                      break;
                    }
                  case 11:
                    {
                      k[226] = c;
                      break;
                    }
                  default:
                    {
                      k[j >> 2] = d;
                      Xb(2588863, j | 0) | 0;
                    }
                }
 while (0);
              k[q >> 2] = p + 6;
              break;
            }
          case 3:
            {
              n = k[226] << 8;
              m = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = m | n & 65280;
              m = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              o = ~m;
              m = m >>> 4 & m;
              m = m >>> 2 & m;
              k[227] = k[227] & -16 | o >>> 4 & 8 | (m >>> 1 & m) << 2 | 1;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 6;
              break;
            }
          case 67:
            {
              n = k[224] | 0;
              o = ~n;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -16 | (n >>> 1 & n) << 2 | 1;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 71:
            {
              m = k[224] | 0;
              l = m & 128;
              o = m >>> 1 & 127 | l;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = l >>> 4 | m & 1 | k[227] & -14 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 10:
            {
              n = k[226] << 8;
              l = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = l | n & 65280;
              l = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              o = l + 255 | 0;
              m = -256 - l | 0;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = o >>> 4 & 8 | k[227] & -15 | ((o ^ 128) & l) >>> 6 & 2 | (m >>> 1 & m) << 2;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 6;
              break;
            }
          case 74:
            {
              m = k[224] | 0;
              o = m + 255 | 0;
              n = -256 - m | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | ((o ^ 128) & m) >>> 6 & 2 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 90:
            {
              m = k[225] | 0;
              o = m + 255 | 0;
              n = -256 - m | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | ((o ^ 128) & m) >>> 6 & 2 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 122:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              l = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              o = l + 255 | 0;
              m = -256 - l | 0;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = o >>> 4 & 8 | k[227] & -15 | ((o ^ 128) & l) >>> 6 & 2 | (m >>> 1 & m) << 2;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 7;
              break;
            }
          case 124:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              l = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              o = l + 1 | 0;
              m = -2 - l | 0;
              m = m & 15 & m >>> 4;
              m = m >>> 2 & m;
              k[227] = o >>> 4 & 8 | k[227] & -15 | ((o ^ l) & (l ^ 128)) >>> 6 & 2 | (m >>> 1 & m) << 2;
              dc[k[560 >> 2] & 63](n, o & 255);
              k[q >> 2] = p + 7;
              break;
            }
          case 126:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 128:
            {
              i = k[224] | 0;
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              j = ~j;
              n = i + j | 0;
              o = n + 1 | 0;
              m = i << 4;
              l = j << 4;
              n = -2 - n | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (o >>> 4 & 8 | k[227] & -48 | ((o ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 144:
            {
              j = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              i = k[224] | 0;
              j = ~((ec[k[556 >> 2] & 63](n | j & 65280) | 0) & 255);
              n = i + j | 0;
              o = n + 1 | 0;
              m = i << 4;
              l = j << 4;
              n = -2 - n | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (o >>> 4 & 8 | k[227] & -48 | ((o ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              k[224] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 160:
            {
              l = sd(q) | 0;
              j = k[224] | 0;
              l = ~((ec[k[556 >> 2] & 63](l & 65535) | 0) & 255);
              o = j + l | 0;
              p = o + 1 | 0;
              n = j << 4;
              m = l << 4;
              o = -2 - o | 0;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = (p >>> 4 & 8 | k[227] & -48 | ((p ^ j) & (j ^ 128 ^ l)) >>> 6 & 2 | ((p ^ 128) & (j | l) | j & l) >>> 7 & 1 | ((p << 4 ^ 128) & (m | n) | m & n) >>> 2 & 32 | (o >>> 1 & o) << 2) ^ 1;
              k[224] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 176:
            {
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              j = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | j << 8;
              k[223] = (k[223] | 0) + 2;
              i = k[224] | 0;
              j = ~((ec[k[556 >> 2] & 63](j) | 0) & 255);
              n = i + j | 0;
              o = n + 1 | 0;
              m = i << 4;
              l = j << 4;
              n = -2 - n | 0;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (o >>> 4 & 8 | k[227] & -48 | ((o ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              k[224] = o;
              k[q >> 2] = p + 5;
              break;
            }
          case 177:
            {
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              j = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | j << 8;
              k[223] = (k[223] | 0) + 2;
              i = k[224] | 0;
              j = ~((ec[k[556 >> 2] & 63](j) | 0) & 255);
              o = i + j | 0;
              l = o + 1 | 0;
              n = i << 4;
              m = j << 4;
              o = -2 - o | 0;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = (l >>> 4 & 8 | k[227] & -48 | ((l ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((l ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((l << 4 ^ 128) & (m | n) | m & n) >>> 2 & 32 | (o >>> 1 & o) << 2) ^ 1;
              k[q >> 2] = p + 5;
              break;
            }
          case 193:
            {
              i = k[225] | 0;
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              j = ~j;
              o = i + j | 0;
              l = o + 1 | 0;
              n = i << 4;
              m = j << 4;
              o = -2 - o | 0;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = (l >>> 4 & 8 | k[227] & -48 | ((l ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((l ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((l << 4 ^ 128) & (m | n) | m & n) >>> 2 & 32 | (o >>> 1 & o) << 2) ^ 1;
              k[q >> 2] = p + 2;
              break;
            }
          case 226:
            {
              l = sd(q) | 0;
              j = k[225] | 0;
              l = ~((ec[k[556 >> 2] & 63](l & 65535) | 0) & 255);
              i = k[227] | 0;
              p = j + l + (i & 1 ^ 1) | 0;
              n = j << 4;
              m = l << 4;
              o = ~p;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = (p >>> 4 & 8 | i & -48 | ((p ^ j) & (j ^ 128 ^ l)) >>> 6 & 2 | ((p ^ 128) & (j | l) | j & l) >>> 7 & 1 | ((p << 4 ^ 128) & (m | n) | m & n) >>> 2 & 32 | (o >>> 1 & o) << 2) ^ 1;
              k[225] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 242:
            {
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              j = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | j << 8;
              k[223] = (k[223] | 0) + 2;
              i = k[225] | 0;
              j = ~((ec[k[556 >> 2] & 63](j) | 0) & 255);
              h = k[227] | 0;
              o = i + j + (h & 1 ^ 1) | 0;
              m = i << 4;
              l = j << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (o >>> 4 & 8 | h & -48 | ((o ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              k[225] = o;
              k[q >> 2] = p + 5;
              break;
            }
          case 180:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              o = k[224] & ((ec[k[556 >> 2] & 63](o) | 0) & 255);
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 5;
              break;
            }
          case 213:
            {
              n = k[226] << 8;
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = k[225] & ((ec[k[556 >> 2] & 63](o | n & 65280) | 0) & 255);
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = n >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 4;
              break;
            }
          case 229:
            {
              o = sd(q) | 0;
              o = k[225] & ((ec[k[556 >> 2] & 63](o & 65535) | 0) & 255);
              p = ~o;
              p = p & 15 & p >>> 4;
              p = p >>> 2 & p;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (p >>> 1 & p) << 2;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 198:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              k[225] = n;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 2;
              break;
            }
          case 214:
            {
              n = k[226] << 8;
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = (ec[k[556 >> 2] & 63](o | n & 65280) | 0) & 255;
              k[225] = n;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = n >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 4;
              break;
            }
          case 230:
            {
              o = sd(q) | 0;
              o = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
              k[225] = o;
              p = ~o;
              p = p & 15 & p >>> 4;
              p = p >>> 2 & p;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (p >>> 1 & p) << 2;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 246:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              n = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              k[225] = n;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = n >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 5;
              break;
            }
          case 167:
            {
              o = sd(q) | 0;
              dc[k[560 >> 2] & 63](o & 65535, k[224] & 255);
              o = k[224] | 0;
              p = ~o;
              p = p & 15 & p >>> 4;
              p = p >>> 2 & p;
              k[227] = k[227] & -15 | o >>> 4 & 8 | (p >>> 1 & p) << 2;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 136:
            {
              o = k[224] | 0;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = n ^ o;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 216:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = k[225] ^ (ec[k[556 >> 2] & 63](n | o & 65280) | 0) & 255;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 153:
            {
              i = k[226] << 8;
              h = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              j = k[224] | 0;
              i = (ec[k[556 >> 2] & 63](h | i & 65280) | 0) & 255;
              h = k[227] | 0;
              o = i + j + (h & 1) | 0;
              m = j << 4;
              l = i << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | h & -48 | ((o ^ j) & (j ^ 128 ^ i)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 201:
            {
              j = k[225] | 0;
              i = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              h = k[227] | 0;
              o = i + j + (h & 1) | 0;
              m = j << 4;
              l = i << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | h & -48 | ((o ^ j) & (j ^ 128 ^ i)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 218:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = k[225] | (ec[k[556 >> 2] & 63](n | o & 65280) | 0) & 255;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 234:
            {
              p = sd(q) | 0;
              p = k[225] | (ec[k[556 >> 2] & 63](p & 65535) | 0) & 255;
              o = ~p;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = p >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[225] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 219:
            {
              i = k[226] << 8;
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              j = k[225] | 0;
              i = (ec[k[556 >> 2] & 63](o | i & 65280) | 0) & 255;
              o = i + j | 0;
              m = j << 4;
              l = i << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -48 | ((o ^ j) & (j ^ 128 ^ i)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 235:
            {
              j = sd(q) | 0;
              l = k[225] | 0;
              j = (ec[k[556 >> 2] & 63](j & 65535) | 0) & 255;
              p = j + l | 0;
              n = l << 4;
              m = j << 4;
              o = ~p;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = p >>> 4 & 8 | k[227] & -48 | ((p ^ l) & (l ^ 128 ^ j)) >>> 6 & 2 | ((p ^ 128) & (j | l) | j & l) >>> 7 & 1 | ((p << 4 ^ 128) & (m | n) | m & n) >>> 2 & 32 | (o >>> 1 & o) << 2;
              k[225] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 172:
            {
              p = sd(q) | 0;
              o = k[219] | 0;
              n = (ec[k[556 >> 2] & 63](p & 65535) | 0) & 255;
              n = ~((ec[k[556 >> 2] & 63](p + 1 & 65535) | 0) & 255 | n << 8);
              p = o + n | 0;
              l = p + 1 | 0;
              m = l >>> 8;
              p = -2 - p | 0;
              p = p & 255 & p >>> 8;
              p = p >>> 4 & p;
              p = p >>> 2 & p;
              o = o >>> 8;
              n = n >>> 8;
              k[227] = (l >>> 12 & 8 | k[227] & -16 | ((m ^ o) & (o ^ 128 ^ n)) >>> 6 & 2 | ((m ^ 128) & (n | o) | n & o) >>> 7 & 1 | (p & 1 & p >>> 1) << 2) ^ 1;
              k[q >> 2] = (k[q >> 2] | 0) + 6;
              break;
            }
          case 158:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = n | o;
              n = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | n << 8;
              k[219] = o;
              o = ~o;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 5;
              break;
            }
          case 174:
            {
              p = sd(q) | 0;
              o = (ec[k[556 >> 2] & 63](p & 65535) | 0) & 255;
              p = (ec[k[556 >> 2] & 63](p + 1 & 65535) | 0) & 255 | o << 8;
              k[219] = p;
              p = ~p;
              p = p & 255 & p >>> 8;
              p = p >>> 4 & p;
              p = p >>> 2 & p;
              k[227] = k[227] & -15 | o >>> 4 & 8 | (p & 1 & p >>> 1) << 2;
              k[q >> 2] = (k[q >> 2] | 0) + 5;
              break;
            }
          case 206:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              k[221] = o;
              o = ~o;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 3;
              break;
            }
          case 254:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              n = (ec[k[556 >> 2] & 63](o) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | n << 8;
              k[221] = o;
              o = ~o;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 6;
              break;
            }
          case 239:
            {
              p = sd(q) | 0;
              o = k[221] | 0;
              dc[k[560 >> 2] & 63](p & 65535, o >>> 8 & 255);
              dc[k[560 >> 2] & 63](p + 1 & 65535, o & 255);
              o = k[221] | 0;
              p = ~o;
              p = p & 255 & p >>> 8;
              p = p >>> 4 & p;
              p = p >>> 2 & p;
              k[227] = k[227] & -15 | o >>> 12 & 8 | (p & 1 & p >>> 1) << 2;
              k[q >> 2] = (k[q >> 2] | 0) + 5;
              break;
            }
          case 195:
            {
              l = k[224] | 0;
              o = k[225] & 255 | l << 8;
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | j << 8;
              k[223] = (k[223] | 0) + 2;
              o = n + o | 0;
              n = o >>> 8;
              m = ~o;
              m = m & 255 & m >>> 8;
              m = m >>> 4 & m;
              m = m >>> 2 & m;
              k[227] = o >>> 12 & 8 | k[227] & -16 | ((n ^ l) & (l ^ 128 ^ j)) >>> 6 & 2 | ((n ^ 128) & (j | l) | j & l) >>> 7 & 1 | (m & 1 & m >>> 1) << 2;
              k[224] = n;
              k[225] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 243:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              l = k[224] | 0;
              o = k[225] & 255 | l << 8;
              j = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              o = ((ec[k[556 >> 2] & 63](n + 1 & 65535) | 0) & 255 | j << 8) + o | 0;
              n = o >>> 8;
              m = ~o;
              m = m & 255 & m >>> 8;
              m = m >>> 4 & m;
              m = m >>> 2 & m;
              k[227] = o >>> 12 & 8 | k[227] & -16 | ((n ^ l) & (l ^ 128 ^ j)) >>> 6 & 2 | ((n ^ 128) & (j | l) | j & l) >>> 7 & 1 | (m & 1 & m >>> 1) << 2;
              k[224] = n;
              k[225] = o;
              k[q >> 2] = p + 7;
              break;
            }
          case 204:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              k[224] = n;
              k[225] = o;
              o = ~o;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 3;
              break;
            }
          case 220:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = n | o;
              n = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | n << 8;
              k[224] = n;
              k[225] = o;
              o = ~o;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 5;
              break;
            }
          case 236:
            {
              p = sd(q) | 0;
              o = (ec[k[556 >> 2] & 63](p & 65535) | 0) & 255;
              p = (ec[k[556 >> 2] & 63](p + 1 & 65535) | 0) & 255 | o << 8;
              k[224] = o;
              k[225] = p;
              p = ~p;
              p = p & 255 & p >>> 8;
              p = p >>> 4 & p;
              p = p >>> 2 & p;
              k[227] = k[227] & -15 | o >>> 4 & 8 | (p & 1 & p >>> 1) << 2;
              k[q >> 2] = (k[q >> 2] | 0) + 5;
              break;
            }
          case 61:
            {
              n = ga(k[225] & 255, k[224] & 255) | 0;
              k[224] = n >>> 8;
              k[225] = n;
              o = ~n;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = n >>> 7 & 1 | k[227] & -6 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 11;
              break;
            }
          case 33:
          case 32:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1 + ((((o | -129) ^ 128) + 1 | o) & (b & 1) + -1);
              k[q >> 2] = p + 3;
              break;
            }
          case 35:
          case 34:
            {
              o = k[227] | 0;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1 + ((((n | -129) ^ 128) + 1 | n) & (((o >>> 2 | o) ^ b) & 1) + -1);
              k[q >> 2] = p + 3;
              break;
            }
          case 37:
          case 36:
            {
              o = k[227] | 0;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1 + ((((n | -129) ^ 128) + 1 | n) & ((o ^ b) & 1) + -1);
              k[q >> 2] = p + 3;
              break;
            }
          case 47:
          case 46:
            {
              o = k[227] | 0;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1 + ((((n | -129) ^ 128) + 1 | n) & (((o >>> 3 ^ o >>> 1 | o >>> 2) ^ b) & 1) + -1);
              k[q >> 2] = p + 3;
              break;
            }
          case 22:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2 + o;
              k[q >> 2] = p + 5;
              break;
            }
          case 141:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (k[223] | 0) + 1 | 0;
              k[223] = n;
              m = (k[222] | 0) + -1 | 0;
              k[222] = m;
              dc[k[560 >> 2] & 63](m & 65535, n & 255);
              m = (k[222] | 0) + -1 | 0;
              k[222] = m;
              dc[k[560 >> 2] & 63](m & 65535, n >>> 8 & 255);
              k[223] = (k[223] | 0) + (((o | -129) ^ 128) + 1 | o);
              k[q >> 2] = p + 7;
              break;
            }
          case 157:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              m = (k[223] | 0) + 1 | 0;
              k[223] = m;
              l = (k[222] | 0) + -1 | 0;
              k[222] = l;
              dc[k[560 >> 2] & 63](l & 65535, m & 255);
              l = (k[222] | 0) + -1 | 0;
              k[222] = l;
              dc[k[560 >> 2] & 63](l & 65535, m >>> 8 & 255);
              k[223] = n | o;
              k[q >> 2] = p + 7;
              break;
            }
          case 55:
            {
              p = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              td(p, 884, 888, q);
              k[q >> 2] = (k[q >> 2] | 0) + 5;
              break;
            }
          case 60:
            {
              p = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              k[227] = k[227] & p | 128;
              rd(255, 888, k[221] | 0, q);
              k[228] = 2;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 16:
            {
              c = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              d = k[223] | 0;
              e = d + 1 | 0;
              k[223] = e;
              do
                switch (c | 0) {
                  case 179:
                    {
                      j = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      j = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | j << 8;
                      k[223] = (k[223] | 0) + 2;
                      n = k[224] | 0;
                      o = k[225] & 255 | n << 8;
                      m = (ec[k[556 >> 2] & 63](j) | 0) & 255;
                      m = ~((ec[k[556 >> 2] & 63](j + 1 & 65535) | 0) & 255 | m << 8);
                      o = o + m | 0;
                      j = o + 1 | 0;
                      l = j >>> 8;
                      o = -2 - o | 0;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      m = m >>> 8;
                      k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
                      k[q >> 2] = p + 8;
                      break a;
                    }
                  case 140:
                    {
                      n = k[220] | 0;
                      m = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      m = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | m << 8;
                      k[223] = (k[223] | 0) + 2;
                      m = ~m;
                      o = n + m | 0;
                      j = o + 1 | 0;
                      l = j >>> 8;
                      o = -2 - o | 0;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      n = n >>> 8;
                      m = m >>> 8;
                      k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
                      k[q >> 2] = p + 5;
                      break a;
                    }
                  case 222:
                    {
                      o = k[226] << 8;
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      k[223] = (k[223] | 0) + 1;
                      o = n | o;
                      n = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
                      o = (ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | n << 8;
                      k[222] = o;
                      o = ~o;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
                      k[q >> 2] = p + 6;
                      break a;
                    }
                  case 238:
                    {
                      p = sd(q) | 0;
                      o = (ec[k[556 >> 2] & 63](p & 65535) | 0) & 255;
                      p = (ec[k[556 >> 2] & 63](p + 1 & 65535) | 0) & 255 | o << 8;
                      k[222] = p;
                      p = ~p;
                      p = p & 255 & p >>> 8;
                      p = p >>> 4 & p;
                      p = p >>> 2 & p;
                      k[227] = k[227] & -15 | o >>> 4 & 8 | (p & 1 & p >>> 1) << 2;
                      k[q >> 2] = (k[q >> 2] | 0) + 6;
                      break a;
                    }
                  case 254:
                    {
                      o = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      o = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | o << 8;
                      k[223] = (k[223] | 0) + 2;
                      n = (ec[k[556 >> 2] & 63](o) | 0) & 255;
                      o = (ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | n << 8;
                      k[222] = o;
                      o = ~o;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
                      k[q >> 2] = p + 7;
                      break a;
                    }
                  case 33:
                  case 32:
                    {
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      n = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | n << 8;
                      o = c & 1;
                      k[223] = (k[223] | 0) + 2 + (n & o + -1);
                      k[q >> 2] = 6 - o + p;
                      break a;
                    }
                  case 35:
                  case 34:
                    {
                      o = k[227] | 0;
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      n = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | n << 8;
                      o = ((o >>> 2 | o) ^ c) & 1;
                      k[223] = (k[223] | 0) + 2 + (n & o + -1);
                      k[q >> 2] = 6 - o + p;
                      break a;
                    }
                  case 163:
                    {
                      l = sd(q) | 0;
                      o = k[224] | 0;
                      p = k[225] & 255 | o << 8;
                      n = (ec[k[556 >> 2] & 63](l & 65535) | 0) & 255;
                      n = ~((ec[k[556 >> 2] & 63](l + 1 & 65535) | 0) & 255 | n << 8);
                      p = p + n | 0;
                      l = p + 1 | 0;
                      m = l >>> 8;
                      p = -2 - p | 0;
                      p = p & 255 & p >>> 8;
                      p = p >>> 4 & p;
                      p = p >>> 2 & p;
                      n = n >>> 8;
                      k[227] = (l >>> 12 & 8 | k[227] & -16 | ((m ^ o) & (o ^ 128 ^ n)) >>> 6 & 2 | ((m ^ 128) & (n | o) | n & o) >>> 7 & 1 | (p & 1 & p >>> 1) << 2) ^ 1;
                      k[q >> 2] = (k[q >> 2] | 0) + 7;
                      break a;
                    }
                  case 172:
                    {
                      p = sd(q) | 0;
                      o = k[220] | 0;
                      n = (ec[k[556 >> 2] & 63](p & 65535) | 0) & 255;
                      n = ~((ec[k[556 >> 2] & 63](p + 1 & 65535) | 0) & 255 | n << 8);
                      p = o + n | 0;
                      l = p + 1 | 0;
                      m = l >>> 8;
                      p = -2 - p | 0;
                      p = p & 255 & p >>> 8;
                      p = p >>> 4 & p;
                      p = p >>> 2 & p;
                      o = o >>> 8;
                      n = n >>> 8;
                      k[227] = (l >>> 12 & 8 | k[227] & -16 | ((m ^ o) & (o ^ 128 ^ n)) >>> 6 & 2 | ((m ^ 128) & (n | o) | n & o) >>> 7 & 1 | (p & 1 & p >>> 1) << 2) ^ 1;
                      k[q >> 2] = (k[q >> 2] | 0) + 7;
                      break a;
                    }
                  case 188:
                    {
                      o = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      o = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | o << 8;
                      k[223] = (k[223] | 0) + 2;
                      n = k[220] | 0;
                      m = (ec[k[556 >> 2] & 63](o) | 0) & 255;
                      m = ~((ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | m << 8);
                      o = n + m | 0;
                      j = o + 1 | 0;
                      l = j >>> 8;
                      o = -2 - o | 0;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      n = n >>> 8;
                      m = m >>> 8;
                      k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
                      k[q >> 2] = p + 8;
                      break a;
                    }
                  case 41:
                  case 40:
                    {
                      o = (k[227] | 0) >>> 1;
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      n = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | n << 8;
                      o = (o ^ c) & 1;
                      k[223] = (k[223] | 0) + 2 + (n & o + -1);
                      k[q >> 2] = 6 - o + p;
                      break a;
                    }
                  case 43:
                  case 42:
                    {
                      o = (k[227] | 0) >>> 3;
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      n = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | n << 8;
                      o = (o ^ c) & 1;
                      k[223] = (k[223] | 0) + 2 + (n & o + -1);
                      k[q >> 2] = 6 - o + p;
                      break a;
                    }
                  case 47:
                  case 46:
                    {
                      o = k[227] | 0;
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      n = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | n << 8;
                      o = ((o >>> 3 ^ o >>> 1 | o >>> 2) ^ c) & 1;
                      k[223] = (k[223] | 0) + 2 + (n & o + -1);
                      k[q >> 2] = 6 - o + p;
                      break a;
                    }
                  case 131:
                    {
                      n = k[224] | 0;
                      o = k[225] & 255 | n << 8;
                      m = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      m = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | m << 8;
                      k[223] = (k[223] | 0) + 2;
                      m = ~m;
                      o = o + m | 0;
                      j = o + 1 | 0;
                      l = j >>> 8;
                      o = -2 - o | 0;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      m = m >>> 8;
                      k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
                      k[q >> 2] = p + 5;
                      break a;
                    }
                  case 159:
                    {
                      o = k[226] << 8;
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      k[223] = (k[223] | 0) + 1;
                      o = n | o;
                      n = k[220] | 0;
                      dc[k[560 >> 2] & 63](o & 65535, n >>> 8 & 255);
                      dc[k[560 >> 2] & 63](o + 1 & 65535, n & 255);
                      n = k[220] | 0;
                      o = ~n;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      k[227] = k[227] & -15 | n >>> 12 & 8 | (o & 1 & o >>> 1) << 2;
                      k[q >> 2] = p + 6;
                      break a;
                    }
                  case 175:
                    {
                      p = sd(q) | 0;
                      o = k[220] | 0;
                      dc[k[560 >> 2] & 63](p & 65535, o >>> 8 & 255);
                      dc[k[560 >> 2] & 63](p + 1 & 65535, o & 255);
                      o = k[220] | 0;
                      p = ~o;
                      p = p & 255 & p >>> 8;
                      p = p >>> 4 & p;
                      p = p >>> 2 & p;
                      k[227] = k[227] & -15 | o >>> 12 & 8 | (p & 1 & p >>> 1) << 2;
                      k[q >> 2] = (k[q >> 2] | 0) + 6;
                      break a;
                    }
                  case 239:
                    {
                      p = sd(q) | 0;
                      o = k[222] | 0;
                      dc[k[560 >> 2] & 63](p & 65535, o >>> 8 & 255);
                      dc[k[560 >> 2] & 63](p + 1 & 65535, o & 255);
                      o = k[222] | 0;
                      p = ~o;
                      p = p & 255 & p >>> 8;
                      p = p >>> 4 & p;
                      p = p >>> 2 & p;
                      k[227] = k[227] & -15 | o >>> 12 & 8 | (p & 1 & p >>> 1) << 2;
                      k[q >> 2] = (k[q >> 2] | 0) + 6;
                      break a;
                    }
                  case 37:
                  case 36:
                    {
                      o = k[227] | 0;
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      n = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | n << 8;
                      o = (o ^ c) & 1;
                      k[223] = (k[223] | 0) + 2 + (n & o + -1);
                      k[q >> 2] = 6 - o + p;
                      break a;
                    }
                  case 39:
                  case 38:
                    {
                      o = (k[227] | 0) >>> 2;
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      n = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | n << 8;
                      o = (o ^ c) & 1;
                      k[223] = (k[223] | 0) + 2 + (n & o + -1);
                      k[q >> 2] = 6 - o + p;
                      break a;
                    }
                  case 45:
                  case 44:
                    {
                      o = k[227] | 0;
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      n = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | n << 8;
                      o = (o >>> 1 ^ c ^ o >>> 3) & 1;
                      k[223] = (k[223] | 0) + 2 + (n & o + -1);
                      k[q >> 2] = 6 - o + p;
                      break a;
                    }
                  case 147:
                    {
                      j = k[226] << 8;
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      k[223] = (k[223] | 0) + 1;
                      j = n | j;
                      n = k[224] | 0;
                      o = k[225] & 255 | n << 8;
                      m = (ec[k[556 >> 2] & 63](j & 65535) | 0) & 255;
                      m = ~((ec[k[556 >> 2] & 63](j + 1 & 65535) | 0) & 255 | m << 8);
                      o = o + m | 0;
                      j = o + 1 | 0;
                      l = j >>> 8;
                      o = -2 - o | 0;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      m = m >>> 8;
                      k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
                      k[q >> 2] = p + 7;
                      break a;
                    }
                  case 156:
                    {
                      o = k[226] << 8;
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      k[223] = (k[223] | 0) + 1;
                      o = n | o;
                      n = k[220] | 0;
                      m = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
                      m = ~((ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | m << 8);
                      o = n + m | 0;
                      j = o + 1 | 0;
                      l = j >>> 8;
                      o = -2 - o | 0;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      n = n >>> 8;
                      m = m >>> 8;
                      k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
                      k[q >> 2] = p + 7;
                      break a;
                    }
                  case 142:
                    {
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      o = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | n << 8;
                      k[223] = (k[223] | 0) + 2;
                      k[220] = o;
                      o = ~o;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
                      k[q >> 2] = p + 4;
                      break a;
                    }
                  case 158:
                    {
                      o = k[226] << 8;
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      k[223] = (k[223] | 0) + 1;
                      o = n | o;
                      n = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
                      o = (ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | n << 8;
                      k[220] = o;
                      o = ~o;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
                      k[q >> 2] = p + 6;
                      break a;
                    }
                  case 174:
                    {
                      p = sd(q) | 0;
                      o = (ec[k[556 >> 2] & 63](p & 65535) | 0) & 255;
                      p = (ec[k[556 >> 2] & 63](p + 1 & 65535) | 0) & 255 | o << 8;
                      k[220] = p;
                      p = ~p;
                      p = p & 255 & p >>> 8;
                      p = p >>> 4 & p;
                      p = p >>> 2 & p;
                      k[227] = k[227] & -15 | o >>> 4 & 8 | (p & 1 & p >>> 1) << 2;
                      k[q >> 2] = (k[q >> 2] | 0) + 6;
                      break a;
                    }
                  case 190:
                    {
                      o = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      o = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | o << 8;
                      k[223] = (k[223] | 0) + 2;
                      n = (ec[k[556 >> 2] & 63](o) | 0) & 255;
                      o = (ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | n << 8;
                      k[220] = o;
                      o = ~o;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
                      k[q >> 2] = p + 7;
                      break a;
                    }
                  case 191:
                    {
                      o = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      o = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | o << 8;
                      k[223] = (k[223] | 0) + 2;
                      n = k[220] | 0;
                      dc[k[560 >> 2] & 63](o, n >>> 8 & 255);
                      dc[k[560 >> 2] & 63](o + 1 & 65535, n & 255);
                      n = k[220] | 0;
                      o = ~n;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      k[227] = k[227] & -15 | n >>> 12 & 8 | (o & 1 & o >>> 1) << 2;
                      k[q >> 2] = p + 7;
                      break a;
                    }
                  case 206:
                    {
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      o = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | n << 8;
                      k[223] = (k[223] | 0) + 2;
                      k[222] = o;
                      o = ~o;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
                      k[q >> 2] = p + 4;
                      break a;
                    }
                  case 223:
                    {
                      o = k[226] << 8;
                      n = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      k[223] = (k[223] | 0) + 1;
                      o = n | o;
                      n = k[222] | 0;
                      dc[k[560 >> 2] & 63](o & 65535, n >>> 8 & 255);
                      dc[k[560 >> 2] & 63](o + 1 & 65535, n & 255);
                      n = k[222] | 0;
                      o = ~n;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      k[227] = k[227] & -15 | n >>> 12 & 8 | (o & 1 & o >>> 1) << 2;
                      k[q >> 2] = p + 6;
                      break a;
                    }
                  case 255:
                    {
                      o = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
                      o = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | o << 8;
                      k[223] = (k[223] | 0) + 2;
                      n = k[222] | 0;
                      dc[k[560 >> 2] & 63](o, n >>> 8 & 255);
                      dc[k[560 >> 2] & 63](o + 1 & 65535, n & 255);
                      n = k[222] | 0;
                      o = ~n;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      k[227] = k[227] & -15 | n >>> 12 & 8 | (o & 1 & o >>> 1) << 2;
                      k[q >> 2] = p + 7;
                      break a;
                    }
                  case 63:
                    {
                      k[227] = k[227] | 128;
                      rd(255, 888, k[221] | 0, q);
                      p = (ec[k[556 >> 2] & 63](65524) | 0) & 255;
                      p = (ec[k[556 >> 2] & 63](65525) | 0) & 255 | p << 8;
                      k[223] = p;
                      k[q >> 2] = (k[q >> 2] | 0) + 8;
                      break a;
                    }
                  default:
                    {
                      k[h >> 2] = c;
                      Xb(2588888, h | 0) | 0;
                      break a;
                    }
                }
 while (0);
            }
          case 146:
            {
              j = k[226] << 8;
              h = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              i = k[224] | 0;
              j = ~((ec[k[556 >> 2] & 63](h | j & 65280) | 0) & 255);
              h = k[227] | 0;
              o = i + j + (h & 1 ^ 1) | 0;
              m = i << 4;
              l = j << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (o >>> 4 & 8 | h & -48 | ((o ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              k[224] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 178:
            {
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              j = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | j << 8;
              k[223] = (k[223] | 0) + 2;
              i = k[224] | 0;
              j = ~((ec[k[556 >> 2] & 63](j) | 0) & 255);
              h = k[227] | 0;
              o = i + j + (h & 1 ^ 1) | 0;
              m = i << 4;
              l = j << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (o >>> 4 & 8 | h & -48 | ((o ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              k[224] = o;
              k[q >> 2] = p + 5;
              break;
            }
          case 194:
            {
              i = k[225] | 0;
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              j = ~j;
              h = k[227] | 0;
              o = i + j + (h & 1 ^ 1) | 0;
              m = i << 4;
              l = j << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (o >>> 4 & 8 | h & -48 | ((o ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 210:
            {
              j = k[226] << 8;
              h = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              i = k[225] | 0;
              j = ~((ec[k[556 >> 2] & 63](h | j & 65280) | 0) & 255);
              h = k[227] | 0;
              o = i + j + (h & 1 ^ 1) | 0;
              m = i << 4;
              l = j << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (o >>> 4 & 8 | h & -48 | ((o ^ i) & (i ^ 128 ^ j)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2) ^ 1;
              k[225] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 164:
            {
              p = sd(q) | 0;
              p = k[224] & ((ec[k[556 >> 2] & 63](p & 65535) | 0) & 255);
              o = ~p;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = p >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[224] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 196:
            {
              o = k[225] | 0;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = n & o;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 165:
            {
              o = sd(q) | 0;
              o = k[224] & ((ec[k[556 >> 2] & 63](o & 65535) | 0) & 255);
              p = ~o;
              p = p & 15 & p >>> 4;
              p = p >>> 2 & p;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (p >>> 1 & p) << 2;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 181:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              n = k[224] & ((ec[k[556 >> 2] & 63](n) | 0) & 255);
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = n >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 5;
              break;
            }
          case 197:
            {
              n = k[225] | 0;
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              n = o & n;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = n >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 2;
              break;
            }
          case 182:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              n = (ec[k[556 >> 2] & 63](n) | 0) & 255;
              k[224] = n;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = n >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 5;
              break;
            }
          case 247:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              n = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              dc[k[560 >> 2] & 63](n, k[225] & 255);
              n = k[225] | 0;
              o = ~n;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o >>> 1 & o) << 2;
              k[q >> 2] = p + 5;
              break;
            }
          case 200:
            {
              o = k[225] | 0;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = n ^ o;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 248:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              o = k[225] ^ (ec[k[556 >> 2] & 63](o) | 0) & 255;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 5;
              break;
            }
          case 137:
            {
              j = k[224] | 0;
              i = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              h = k[227] | 0;
              o = i + j + (h & 1) | 0;
              m = j << 4;
              l = i << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | h & -48 | ((o ^ j) & (j ^ 128 ^ i)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 169:
            {
              j = sd(q) | 0;
              l = k[224] | 0;
              j = (ec[k[556 >> 2] & 63](j & 65535) | 0) & 255;
              i = k[227] | 0;
              p = j + l + (i & 1) | 0;
              n = l << 4;
              m = j << 4;
              o = ~p;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = p >>> 4 & 8 | i & -48 | ((p ^ l) & (l ^ 128 ^ j)) >>> 6 & 2 | ((p ^ 128) & (j | l) | j & l) >>> 7 & 1 | ((p << 4 ^ 128) & (m | n) | m & n) >>> 2 & 32 | (o >>> 1 & o) << 2;
              k[224] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 185:
            {
              i = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              i = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | i << 8;
              k[223] = (k[223] | 0) + 2;
              j = k[224] | 0;
              i = (ec[k[556 >> 2] & 63](i) | 0) & 255;
              h = k[227] | 0;
              o = i + j + (h & 1) | 0;
              m = j << 4;
              l = i << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | h & -48 | ((o ^ j) & (j ^ 128 ^ i)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 5;
              break;
            }
          case 217:
            {
              i = k[226] << 8;
              h = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              j = k[225] | 0;
              i = (ec[k[556 >> 2] & 63](h | i & 65280) | 0) & 255;
              h = k[227] | 0;
              o = i + j + (h & 1) | 0;
              m = j << 4;
              l = i << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | h & -48 | ((o ^ j) & (j ^ 128 ^ i)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 233:
            {
              j = sd(q) | 0;
              l = k[225] | 0;
              j = (ec[k[556 >> 2] & 63](j & 65535) | 0) & 255;
              i = k[227] | 0;
              p = j + l + (i & 1) | 0;
              n = l << 4;
              m = j << 4;
              o = ~p;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = p >>> 4 & 8 | i & -48 | ((p ^ l) & (l ^ 128 ^ j)) >>> 6 & 2 | ((p ^ 128) & (j | l) | j & l) >>> 7 & 1 | ((p << 4 ^ 128) & (m | n) | m & n) >>> 2 & 32 | (o >>> 1 & o) << 2;
              k[225] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 154:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = k[224] | (ec[k[556 >> 2] & 63](n | o & 65280) | 0) & 255;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 170:
            {
              p = sd(q) | 0;
              p = k[224] | (ec[k[556 >> 2] & 63](p & 65535) | 0) & 255;
              o = ~p;
              o = o & 15 & o >>> 4;
              o = o >>> 2 & o;
              k[227] = p >>> 4 & 8 | k[227] & -15 | (o >>> 1 & o) << 2;
              k[224] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 4;
              break;
            }
          case 186:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              o = k[224] | (ec[k[556 >> 2] & 63](o) | 0) & 255;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 5;
              break;
            }
          case 202:
            {
              o = k[225] | 0;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = n | o;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 250:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              o = k[225] | (ec[k[556 >> 2] & 63](o) | 0) & 255;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -15 | (n >>> 1 & n) << 2;
              k[225] = o;
              k[q >> 2] = p + 5;
              break;
            }
          case 139:
            {
              j = k[224] | 0;
              i = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = i + j | 0;
              m = j << 4;
              l = i << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -48 | ((o ^ j) & (j ^ 128 ^ i)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 2;
              break;
            }
          case 155:
            {
              i = k[226] << 8;
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              j = k[224] | 0;
              i = (ec[k[556 >> 2] & 63](o | i & 65280) | 0) & 255;
              o = i + j | 0;
              m = j << 4;
              l = i << 4;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = o >>> 4 & 8 | k[227] & -48 | ((o ^ j) & (j ^ 128 ^ i)) >>> 6 & 2 | ((o ^ 128) & (i | j) | i & j) >>> 7 & 1 | ((o << 4 ^ 128) & (l | m) | l & m) >>> 2 & 32 | (n >>> 1 & n) << 2;
              k[224] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 131:
            {
              l = k[224] | 0;
              m = k[225] & 255 | l << 8;
              j = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              j = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | j << 8;
              k[223] = (k[223] | 0) + 2;
              j = ~j;
              m = m + j | 0;
              o = m + 1 | 0;
              n = o >>> 8;
              m = -2 - m | 0;
              m = m & 255 & m >>> 8;
              m = m >>> 4 & m;
              m = m >>> 2 & m;
              j = j >>> 8;
              k[227] = (o >>> 12 & 8 | k[227] & -16 | ((n ^ l) & (l ^ 128 ^ j)) >>> 6 & 2 | ((n ^ 128) & (j | l) | j & l) >>> 7 & 1 | (m & 1 & m >>> 1) << 2) ^ 1;
              k[224] = n;
              k[225] = o;
              k[q >> 2] = p + 4;
              break;
            }
          case 179:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              l = k[224] | 0;
              m = k[225] & 255 | l << 8;
              j = (ec[k[556 >> 2] & 63](o) | 0) & 255;
              j = ~((ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | j << 8);
              m = m + j | 0;
              o = m + 1 | 0;
              n = o >>> 8;
              m = -2 - m | 0;
              m = m & 255 & m >>> 8;
              m = m >>> 4 & m;
              m = m >>> 2 & m;
              j = j >>> 8;
              k[227] = (o >>> 12 & 8 | k[227] & -16 | ((n ^ l) & (l ^ 128 ^ j)) >>> 6 & 2 | ((n ^ 128) & (j | l) | j & l) >>> 7 & 1 | (m & 1 & m >>> 1) << 2) ^ 1;
              k[224] = n;
              k[225] = o;
              k[q >> 2] = p + 7;
              break;
            }
          case 140:
            {
              n = k[219] | 0;
              m = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              m = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | m << 8;
              k[223] = (k[223] | 0) + 2;
              m = ~m;
              o = n + m | 0;
              j = o + 1 | 0;
              l = j >>> 8;
              o = -2 - o | 0;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              n = n >>> 8;
              m = m >>> 8;
              k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
              k[q >> 2] = p + 4;
              break;
            }
          case 142:
            {
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | n << 8;
              k[223] = (k[223] | 0) + 2;
              k[219] = o;
              o = ~o;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 3;
              break;
            }
          case 238:
            {
              p = sd(q) | 0;
              o = (ec[k[556 >> 2] & 63](p & 65535) | 0) & 255;
              p = (ec[k[556 >> 2] & 63](p + 1 & 65535) | 0) & 255 | o << 8;
              k[221] = p;
              p = ~p;
              p = p & 255 & p >>> 8;
              p = p >>> 4 & p;
              p = p >>> 2 & p;
              k[227] = k[227] & -15 | o >>> 4 & 8 | (p & 1 & p >>> 1) << 2;
              k[q >> 2] = (k[q >> 2] | 0) + 5;
              break;
            }
          case 159:
            {
              o = k[226] << 8;
              n = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              o = n | o;
              n = k[219] | 0;
              dc[k[560 >> 2] & 63](o & 65535, n >>> 8 & 255);
              dc[k[560 >> 2] & 63](o + 1 & 65535, n & 255);
              n = k[219] | 0;
              o = ~n;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 12 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 5;
              break;
            }
          case 191:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              n = k[219] | 0;
              dc[k[560 >> 2] & 63](o, n >>> 8 & 255);
              dc[k[560 >> 2] & 63](o + 1 & 65535, n & 255);
              n = k[219] | 0;
              o = ~n;
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 12 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 6;
              break;
            }
          case 227:
            {
              o = sd(q) | 0;
              m = k[224] | 0;
              p = k[225] & 255 | m << 8;
              l = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
              p = ((ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | l << 8) + p | 0;
              o = p >>> 8;
              n = ~p;
              n = n & 255 & n >>> 8;
              n = n >>> 4 & n;
              n = n >>> 2 & n;
              k[227] = p >>> 12 & 8 | k[227] & -16 | ((o ^ m) & (m ^ 128 ^ l)) >>> 6 & 2 | ((o ^ 128) & (l | m) | l & m) >>> 7 & 1 | (n & 1 & n >>> 1) << 2;
              k[224] = o;
              k[225] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 6;
              break;
            }
          case 237:
            {
              p = sd(q) | 0;
              o = k[225] | 0;
              dc[k[560 >> 2] & 63](p & 65535, k[224] & 255);
              dc[k[560 >> 2] & 63](p + 1 & 65535, o & 255);
              o = k[224] | 0;
              p = ~(k[225] & 255 | o << 8);
              p = p & 255 & p >>> 8;
              p = p >>> 4 & p;
              p = p >>> 2 & p;
              k[227] = k[227] & -15 | o >>> 4 & 8 | (p & 1 & p >>> 1) << 2;
              k[q >> 2] = (k[q >> 2] | 0) + 5;
              break;
            }
          case 253:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              k[223] = (k[223] | 0) + 2;
              n = k[225] | 0;
              dc[k[560 >> 2] & 63](o, k[224] & 255);
              dc[k[560 >> 2] & 63](o + 1 & 65535, n & 255);
              n = k[224] | 0;
              o = ~(k[225] & 255 | n << 8);
              o = o & 255 & o >>> 8;
              o = o >>> 4 & o;
              o = o >>> 2 & o;
              k[227] = k[227] & -15 | n >>> 4 & 8 | (o & 1 & o >>> 1) << 2;
              k[q >> 2] = p + 6;
              break;
            }
          case 18:
            {
              k[q >> 2] = p + 2;
              break;
            }
          case 23:
            {
              o = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              o = (ec[k[556 >> 2] & 63](f + 2 & 65535) | 0) & 255 | o << 8;
              n = (k[223] | 0) + 2 | 0;
              k[223] = n;
              m = (k[222] | 0) + -1 | 0;
              k[222] = m;
              dc[k[560 >> 2] & 63](m & 65535, n & 255);
              m = (k[222] | 0) + -1 | 0;
              k[222] = m;
              dc[k[560 >> 2] & 63](m & 65535, n >>> 8 & 255);
              k[223] = (k[223] | 0) + o;
              k[q >> 2] = p + 9;
              break;
            }
          case 57:
            {
              o = (ec[k[556 >> 2] & 63](k[222] & 65535) | 0) & 255;
              n = (k[222] | 0) + 1 | 0;
              k[222] = n;
              n = (ec[k[556 >> 2] & 63](n & 65535) | 0) & 255;
              k[222] = (k[222] | 0) + 1;
              k[223] = n | o << 8;
              k[q >> 2] = p + 5;
              break;
            }
          case 59:
            {
              if (!(k[227] & 128)) {
                o = (ec[k[556 >> 2] & 63](k[222] & 65535) | 0) & 255;
                c = (k[222] | 0) + 1 | 0;
                k[222] = c;
                k[227] = o;
                c = (ec[k[556 >> 2] & 63](c & 65535) | 0) & 255;
                o = (k[222] | 0) + 1 | 0;
                k[222] = o;
                o = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
                k[222] = (k[222] | 0) + 1;
                k[223] = o | c << 8;
                c = p + 3 | 0;
                k[q >> 2] = c;
              } else {
                td(255, 888, 884, q);
                c = k[q >> 2] | 0;
              }
              k[q >> 2] = c + 3;
              break;
            }
          case 19:
            {
              k[228] = 1;
              k[q >> 2] = p + 2;
              break;
            }
          case 63:
            {
              k[227] = k[227] | 128;
              rd(255, 888, k[221] | 0, q);
              k[227] = k[227] | 80;
              p = (ec[k[556 >> 2] & 63](65530) | 0) & 255;
              p = (ec[k[556 >> 2] & 63](65531) | 0) & 255 | p << 8;
              k[223] = p;
              k[q >> 2] = (k[q >> 2] | 0) + 7;
              break;
            }
          case 25:
            {
              b = k[224] | 0;
              d = (b & 14) >>> 0 > 9;
              if (!d ? (k[227] & 32 | 0) == 0 : 0)
                f = 0;
              else
                f = 6;
              a = b & 240;
              e = f | 96;
              if (a >>> 0 <= 144) {
                c = k[227] | 0;
                if (!(c & 1))
                  e = a >>> 0 > 128 & d ? e : f;
                else
                  o = 309;
              } else {
                c = k[227] | 0;
                o = 309;
              }
              o = e + b | 0;
              k[224] = o;
              n = ~o;
              n = n & 15 & n >>> 4;
              n = n >>> 2 & n;
              k[227] = (n >>> 1 & n) << 2 | (o >>> 4 & 8 | c & -16) | ((o ^ 128) & (e | b) | e & b) >>> 7 & 1;
              k[q >> 2] = p + 2;
              break;
            }
          case 17:
            {
              e = (ec[k[556 >> 2] & 63](a & 65535) | 0) & 255;
              d = k[223] | 0;
              c = d + 1 | 0;
              k[223] = c;
              do
                switch (e | 0) {
                  case 179:
                    {
                      o = (ec[k[556 >> 2] & 63](c & 65535) | 0) & 255;
                      o = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | o << 8;
                      k[223] = (k[223] | 0) + 2;
                      n = k[221] | 0;
                      m = (ec[k[556 >> 2] & 63](o) | 0) & 255;
                      m = ~((ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | m << 8);
                      o = n + m | 0;
                      j = o + 1 | 0;
                      l = j >>> 8;
                      o = -2 - o | 0;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      n = n >>> 8;
                      m = m >>> 8;
                      k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
                      k[q >> 2] = p + 8;
                      break a;
                    }
                  case 156:
                    {
                      o = k[226] << 8;
                      n = (ec[k[556 >> 2] & 63](c & 65535) | 0) & 255;
                      k[223] = (k[223] | 0) + 1;
                      o = n | o;
                      n = k[222] | 0;
                      m = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
                      m = ~((ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | m << 8);
                      o = n + m | 0;
                      j = o + 1 | 0;
                      l = j >>> 8;
                      o = -2 - o | 0;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      n = n >>> 8;
                      m = m >>> 8;
                      k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
                      k[q >> 2] = p + 7;
                      break a;
                    }
                  case 172:
                    {
                      p = sd(q) | 0;
                      o = k[222] | 0;
                      n = (ec[k[556 >> 2] & 63](p & 65535) | 0) & 255;
                      n = ~((ec[k[556 >> 2] & 63](p + 1 & 65535) | 0) & 255 | n << 8);
                      p = o + n | 0;
                      l = p + 1 | 0;
                      m = l >>> 8;
                      p = -2 - p | 0;
                      p = p & 255 & p >>> 8;
                      p = p >>> 4 & p;
                      p = p >>> 2 & p;
                      o = o >>> 8;
                      n = n >>> 8;
                      k[227] = (l >>> 12 & 8 | k[227] & -16 | ((m ^ o) & (o ^ 128 ^ n)) >>> 6 & 2 | ((m ^ 128) & (n | o) | n & o) >>> 7 & 1 | (p & 1 & p >>> 1) << 2) ^ 1;
                      k[q >> 2] = (k[q >> 2] | 0) + 7;
                      break a;
                    }
                  case 131:
                    {
                      n = k[221] | 0;
                      m = (ec[k[556 >> 2] & 63](c & 65535) | 0) & 255;
                      m = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | m << 8;
                      k[223] = (k[223] | 0) + 2;
                      m = ~m;
                      o = n + m | 0;
                      j = o + 1 | 0;
                      l = j >>> 8;
                      o = -2 - o | 0;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      n = n >>> 8;
                      m = m >>> 8;
                      k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
                      k[q >> 2] = p + 5;
                      break a;
                    }
                  case 63:
                    {
                      k[227] = k[227] | 128;
                      rd(255, 888, k[221] | 0, q);
                      p = (ec[k[556 >> 2] & 63](65522) | 0) & 255;
                      p = (ec[k[556 >> 2] & 63](65523) | 0) & 255 | p << 8;
                      k[223] = p;
                      k[q >> 2] = (k[q >> 2] | 0) + 8;
                      break a;
                    }
                  case 147:
                    {
                      o = k[226] << 8;
                      n = (ec[k[556 >> 2] & 63](c & 65535) | 0) & 255;
                      k[223] = (k[223] | 0) + 1;
                      o = n | o;
                      n = k[221] | 0;
                      m = (ec[k[556 >> 2] & 63](o & 65535) | 0) & 255;
                      m = ~((ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | m << 8);
                      o = n + m | 0;
                      j = o + 1 | 0;
                      l = j >>> 8;
                      o = -2 - o | 0;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      n = n >>> 8;
                      m = m >>> 8;
                      k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
                      k[q >> 2] = p + 7;
                      break a;
                    }
                  case 163:
                    {
                      p = sd(q) | 0;
                      o = k[221] | 0;
                      n = (ec[k[556 >> 2] & 63](p & 65535) | 0) & 255;
                      n = ~((ec[k[556 >> 2] & 63](p + 1 & 65535) | 0) & 255 | n << 8);
                      p = o + n | 0;
                      l = p + 1 | 0;
                      m = l >>> 8;
                      p = -2 - p | 0;
                      p = p & 255 & p >>> 8;
                      p = p >>> 4 & p;
                      p = p >>> 2 & p;
                      o = o >>> 8;
                      n = n >>> 8;
                      k[227] = (l >>> 12 & 8 | k[227] & -16 | ((m ^ o) & (o ^ 128 ^ n)) >>> 6 & 2 | ((m ^ 128) & (n | o) | n & o) >>> 7 & 1 | (p & 1 & p >>> 1) << 2) ^ 1;
                      k[q >> 2] = (k[q >> 2] | 0) + 7;
                      break a;
                    }
                  case 140:
                    {
                      n = k[222] | 0;
                      m = (ec[k[556 >> 2] & 63](c & 65535) | 0) & 255;
                      m = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | m << 8;
                      k[223] = (k[223] | 0) + 2;
                      m = ~m;
                      o = n + m | 0;
                      j = o + 1 | 0;
                      l = j >>> 8;
                      o = -2 - o | 0;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      n = n >>> 8;
                      m = m >>> 8;
                      k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
                      k[q >> 2] = p + 5;
                      break a;
                    }
                  case 188:
                    {
                      o = (ec[k[556 >> 2] & 63](c & 65535) | 0) & 255;
                      o = (ec[k[556 >> 2] & 63](d + 2 & 65535) | 0) & 255 | o << 8;
                      k[223] = (k[223] | 0) + 2;
                      n = k[222] | 0;
                      m = (ec[k[556 >> 2] & 63](o) | 0) & 255;
                      m = ~((ec[k[556 >> 2] & 63](o + 1 & 65535) | 0) & 255 | m << 8);
                      o = n + m | 0;
                      j = o + 1 | 0;
                      l = j >>> 8;
                      o = -2 - o | 0;
                      o = o & 255 & o >>> 8;
                      o = o >>> 4 & o;
                      o = o >>> 2 & o;
                      n = n >>> 8;
                      m = m >>> 8;
                      k[227] = (j >>> 12 & 8 | k[227] & -16 | ((l ^ n) & (n ^ 128 ^ m)) >>> 6 & 2 | ((l ^ 128) & (m | n) | m & n) >>> 7 & 1 | (o & 1 & o >>> 1) << 2) ^ 1;
                      k[q >> 2] = p + 8;
                      break a;
                    }
                  default:
                    {
                      k[i >> 2] = e;
                      Xb(2588918, i | 0) | 0;
                      break a;
                    }
                }
 while (0);
            }
          default:
            {
              k[e >> 2] = b;
              Xb(2588948, e | 0) | 0;
            }
        }
 while (0);
      q = k[q >> 2] | 0;
      r = s;
      return q | 0;
    }
    function Gc() {
      return 276;
    }
    function Hc(a) {
      a = a | 0;
      var b = 0,
          c = 0,
          d = 0;
      b = a;
      c = 648;
      d = b + 128 | 0;
      do {
        i[b >> 0] = i[c >> 0] | 0;
        b = b + 1 | 0;
        c = c + 1 | 0;
      } while ((b | 0) < (d | 0));
      b = a + 128 | 0;
      c = 804;
      d = b + 64 | 0;
      do {
        i[b >> 0] = i[c >> 0] | 0;
        b = b + 1 | 0;
        c = c + 1 | 0;
      } while ((b | 0) < (d | 0));
      d = a + 192 | 0;
      c = k[141] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 196 | 0;
      c = k[142] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 200 | 0;
      c = k[144] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 204 | 0;
      c = k[145] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 208 | 0;
      c = k[146] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 212 | 0;
      c = k[147] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 216 | 0;
      c = k[148] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 220 | 0;
      c = k[143] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 224 | 0;
      c = k[149] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 228 | 0;
      c = k[150] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 232 | 0;
      c = k[151] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 236 | 0;
      c = k[152] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 240 | 0;
      c = k[153] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 244 | 0;
      c = k[154] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 248 | 0;
      c = k[155] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 252 | 0;
      c = k[156] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 256 | 0;
      c = k[157] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      d = a + 260 | 0;
      c = k[158] | 0;
      i[d >> 0] = c;
      i[d + 1 >> 0] = c >> 8;
      i[d + 2 >> 0] = c >> 16;
      i[d + 3 >> 0] = c >> 24;
      i[a + 264 >> 0] = i[636] | 0;
      i[a + 265 >> 0] = i[637] | 0;
      i[a + 266 >> 0] = i[638] | 0;
      i[a + 267 >> 0] = i[639] | 0;
      i[a + 268 >> 0] = i[640] | 0;
      i[a + 269 >> 0] = i[641] | 0;
      i[a + 270 >> 0] = i[642] | 0;
      i[a + 271 >> 0] = i[643] | 0;
      i[a + 272 >> 0] = i[644] | 0;
      i[a + 273 >> 0] = i[645] | 0;
      i[a + 274 >> 0] = i[646] | 0;
      i[a + 275 >> 0] = i[647] | 0;
      return ;
    }
    function Ic(a) {
      a = a | 0;
      var b = 0,
          c = 0,
          d = 0;
      b = 648;
      c = a;
      d = b + 128 | 0;
      do {
        i[b >> 0] = i[c >> 0] | 0;
        b = b + 1 | 0;
        c = c + 1 | 0;
      } while ((b | 0) < (d | 0));
      b = 804;
      c = a + 128 | 0;
      d = b + 64 | 0;
      do {
        i[b >> 0] = i[c >> 0] | 0;
        b = b + 1 | 0;
        c = c + 1 | 0;
      } while ((b | 0) < (d | 0));
      d = a + 192 | 0;
      k[141] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 196 | 0;
      k[142] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 200 | 0;
      k[144] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 204 | 0;
      k[145] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 208 | 0;
      k[146] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 212 | 0;
      k[147] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 216 | 0;
      k[148] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 220 | 0;
      k[143] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 224 | 0;
      k[149] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 228 | 0;
      k[150] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 232 | 0;
      k[151] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 236 | 0;
      k[152] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 240 | 0;
      k[153] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 244 | 0;
      k[154] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 248 | 0;
      k[155] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 252 | 0;
      k[156] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 256 | 0;
      k[157] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      d = a + 260 | 0;
      k[158] = l[d >> 0] | l[d + 1 >> 0] << 8 | l[d + 2 >> 0] << 16 | l[d + 3 >> 0] << 24;
      i[636] = i[a + 264 >> 0] | 0;
      i[637] = i[a + 265 >> 0] | 0;
      i[638] = i[a + 266 >> 0] | 0;
      i[639] = i[a + 267 >> 0] | 0;
      i[640] = i[a + 268 >> 0] | 0;
      i[641] = i[a + 269 >> 0] | 0;
      i[642] = i[a + 270 >> 0] | 0;
      i[643] = i[a + 271 >> 0] | 0;
      i[644] = i[a + 272 >> 0] | 0;
      i[645] = i[a + 273 >> 0] | 0;
      i[646] = i[a + 274 >> 0] | 0;
      i[647] = i[a + 275 >> 0] | 0;
      return ;
    }
    function Jc(a, b) {
      a = a | 0;
      b = b | 0;
      k[804 + (a << 2) >> 2] = b;
      do
        switch (a | 0) {
          case 7:
            {
              k[143] = k[208];
              return ;
            }
          case 1:
          case 0:
            {
              b = k[202] & 15;
              k[202] = b;
              a = k[144] | 0;
              b = (k[201] | 0) + (b << 8) | 0;
              b = (b | 0) == 0 ? 1 : b;
              k[144] = b;
              a = b - a + (k[149] | 0) | 0;
              k[149] = (a | 0) < 1 ? 1 : a;
              return ;
            }
          case 3:
          case 2:
            {
              b = k[204] & 15;
              k[204] = b;
              a = k[145] | 0;
              b = (k[203] | 0) + (b << 8) | 0;
              b = (b | 0) == 0 ? 1 : b;
              k[145] = b;
              a = b - a + (k[150] | 0) | 0;
              k[150] = (a | 0) < 1 ? 1 : a;
              return ;
            }
          case 5:
          case 4:
            {
              b = k[206] & 15;
              k[206] = b;
              a = k[146] | 0;
              b = (k[205] | 0) + (b << 8) | 0;
              b = (b | 0) == 0 ? 1 : b;
              k[146] = b;
              a = b - a + (k[151] | 0) | 0;
              k[151] = (a | 0) < 1 ? 1 : a;
              return ;
            }
          case 12:
          case 11:
            {
              a = k[148] | 0;
              b = (k[213] << 8) + (k[212] | 0) | 0;
              b = (b | 0) == 0 ? 1 : b;
              k[148] = b;
              a = b - a + (k[153] | 0) | 0;
              k[153] = (a | 0) < 1 ? 1 : a;
              return ;
            }
          case 6:
            {
              b = k[207] & 31;
              k[207] = b;
              a = k[147] | 0;
              b = (b | 0) == 0 ? 1 : b;
              k[147] = b;
              a = b - a + (k[152] | 0) | 0;
              k[152] = (a | 0) < 1 ? 1 : a;
              return ;
            }
          case 10:
            {
              a = k[211] | 0;
              b = a & 31;
              k[211] = b;
              a = a & 16;
              i[639] = a;
              if (!a)
                b = 648 + (((b | 0) == 0 ? 0 : b << 1 | 1) << 2) | 0;
              else
                b = 632;
              k[157] = k[b >> 2];
              return ;
            }
          case 8:
            {
              a = k[209] | 0;
              b = a & 31;
              k[209] = b;
              a = a & 16;
              i[637] = a;
              if (!a)
                b = 648 + (((b | 0) == 0 ? 0 : b << 1 | 1) << 2) | 0;
              else
                b = 632;
              k[155] = k[b >> 2];
              return ;
            }
          case 9:
            {
              a = k[210] | 0;
              b = a & 31;
              k[210] = b;
              a = a & 16;
              i[638] = a;
              if (!a)
                b = 648 + (((b | 0) == 0 ? 0 : b << 1 | 1) << 2) | 0;
              else
                b = 632;
              k[156] = k[b >> 2];
              return ;
            }
          case 13:
            {
              a = k[214] | 0;
              k[214] = a & 15;
              b = (a & 4 | 0) != 0 ? 31 : 0;
              i[646] = b;
              if (!(a & 8)) {
                i[644] = 1;
                a = b;
              } else {
                i[644] = a & 1;
                a = a & 2;
              }
              i[645] = a;
              k[153] = k[148];
              i[636] = 31;
              i[647] = 0;
              b = k[648 + ((b & 255 ^ 31) << 2) >> 2] | 0;
              k[158] = b;
              if (i[637] | 0)
                k[155] = b;
              a = j[319] | 0;
              if ((a & 255) << 24 >> 24)
                k[156] = b;
              if ((a & 65535) < 256)
                return ;
              k[157] = b;
              return ;
            }
          default:
            return ;
        }
 while (0);
    }
    function Kc(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
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
          r = 0,
          s = 0,
          t = 0,
          u = 0;
      if (!(k[142] | 0)) {
        fe(b | 0, 0, c | 0) | 0;
        return ;
      }
      a = c << 1;
      h = k[208] | 0;
      if (!(h & 1)) {
        if ((k[209] | 0) == 0 ? (f = k[149] | 0, (f | 0) <= (a | 0)) : 0)
          k[149] = f + a;
      } else {
        c = k[149] | 0;
        if ((c | 0) <= (a | 0))
          k[149] = c + a;
        i[640] = 1;
      }
      if (!(h & 2)) {
        if ((k[210] | 0) == 0 ? (g = k[150] | 0, (g | 0) <= (a | 0)) : 0)
          k[150] = g + a;
      } else {
        d = k[150] | 0;
        if ((d | 0) <= (a | 0))
          k[150] = d + a;
        i[641] = 1;
      }
      if (!(h & 4)) {
        if ((k[211] | 0) == 0 ? (e = k[151] | 0, (e | 0) <= (a | 0)) : 0)
          k[151] = e + a;
      } else {
        d = k[151] | 0;
        if ((d | 0) <= (a | 0))
          k[151] = d + a;
        i[642] = 1;
      }
      if ((h & 56 | 0) == 56 ? (j = k[152] | 0, (j | 0) <= (a | 0)) : 0)
        k[152] = j + a;
      r = h;
      s = b;
      d = l[643] | h;
      a: while (1) {
        c = a;
        do {
          if ((c | 0) <= 0)
            break a;
          b = k[144] | 0;
          n = k[145] | 0;
          o = k[146] | 0;
          p = k[147] | 0;
          g = k[152] | 0;
          q = 2;
          f = 0;
          e = 0;
          a = 0;
          do {
            h = (g | 0) < (q | 0) ? g : q;
            b: do
              if (!(d & 8)) {
                j = (k[149] | 0) - h | 0;
                k[149] = j;
                if ((j | 0) < 1) {
                  while (1) {
                    j = b + j | 0;
                    if ((j | 0) > 0) {
                      t = 42;
                      break;
                    }
                    j = b + j | 0;
                    if ((j | 0) >= 1) {
                      t = 44;
                      break;
                    }
                  }
                  if ((t | 0) == 42) {
                    t = 0;
                    k[149] = j;
                    i[640] = l[640] ^ 1;
                    break;
                  } else if ((t | 0) == 44) {
                    t = 0;
                    k[149] = j;
                    break;
                  }
                }
              } else {
                m = i[640] | 0;
                j = k[149] | 0;
                f = (m << 24 >> 24 == 0 ? 0 : j) + f | 0;
                j = j - h | 0;
                k[149] = j;
                do
                  if ((j | 0) < 1) {
                    while (1) {
                      j = b + j | 0;
                      if ((j | 0) > 0)
                        break;
                      j = b + j | 0;
                      f = b + f | 0;
                      if ((j | 0) >= 1) {
                        t = 37;
                        break;
                      }
                    }
                    if ((t | 0) == 37) {
                      k[149] = j;
                      t = 38;
                      break;
                    }
                    k[149] = j;
                    m = (m & 255 ^ 1) & 255;
                    i[640] = m;
                    if (!(m << 24 >> 24))
                      break b;
                    f = b + f | 0;
                  } else
                    t = 38;
 while (0);
                if ((t | 0) == 38) {
                  t = 0;
                  if (!(m << 24 >> 24))
                    break;
                }
                f = f - j | 0;
              }
 while (0);
            c: do
              if (!(d & 16)) {
                j = (k[150] | 0) - h | 0;
                k[150] = j;
                if ((j | 0) < 1) {
                  while (1) {
                    j = n + j | 0;
                    if ((j | 0) > 0) {
                      t = 56;
                      break;
                    }
                    j = n + j | 0;
                    if ((j | 0) >= 1) {
                      t = 58;
                      break;
                    }
                  }
                  if ((t | 0) == 56) {
                    t = 0;
                    k[150] = j;
                    i[641] = l[641] ^ 1;
                    break;
                  } else if ((t | 0) == 58) {
                    t = 0;
                    k[150] = j;
                    break;
                  }
                }
              } else {
                m = i[641] | 0;
                j = k[150] | 0;
                e = (m << 24 >> 24 == 0 ? 0 : j) + e | 0;
                j = j - h | 0;
                k[150] = j;
                do
                  if ((j | 0) < 1) {
                    while (1) {
                      j = n + j | 0;
                      if ((j | 0) > 0)
                        break;
                      j = n + j | 0;
                      e = n + e | 0;
                      if ((j | 0) >= 1) {
                        t = 51;
                        break;
                      }
                    }
                    if ((t | 0) == 51) {
                      k[150] = j;
                      t = 52;
                      break;
                    }
                    k[150] = j;
                    m = (m & 255 ^ 1) & 255;
                    i[641] = m;
                    if (!(m << 24 >> 24))
                      break c;
                    e = n + e | 0;
                  } else
                    t = 52;
 while (0);
                if ((t | 0) == 52) {
                  t = 0;
                  if (!(m << 24 >> 24))
                    break;
                }
                e = e - j | 0;
              }
 while (0);
            d: do
              if (!(d & 32)) {
                j = (k[151] | 0) - h | 0;
                k[151] = j;
                if ((j | 0) < 1) {
                  while (1) {
                    j = o + j | 0;
                    if ((j | 0) > 0) {
                      t = 70;
                      break;
                    }
                    j = o + j | 0;
                    if ((j | 0) >= 1) {
                      t = 72;
                      break;
                    }
                  }
                  if ((t | 0) == 70) {
                    t = 0;
                    k[151] = j;
                    i[642] = l[642] ^ 1;
                    break;
                  } else if ((t | 0) == 72) {
                    t = 0;
                    k[151] = j;
                    break;
                  }
                }
              } else {
                m = i[642] | 0;
                j = k[151] | 0;
                a = (m << 24 >> 24 == 0 ? 0 : j) + a | 0;
                j = j - h | 0;
                k[151] = j;
                do
                  if ((j | 0) < 1) {
                    while (1) {
                      j = o + j | 0;
                      if ((j | 0) > 0)
                        break;
                      j = o + j | 0;
                      a = o + a | 0;
                      if ((j | 0) >= 1) {
                        t = 65;
                        break;
                      }
                    }
                    if ((t | 0) == 65) {
                      k[151] = j;
                      t = 66;
                      break;
                    }
                    k[151] = j;
                    m = (m & 255 ^ 1) & 255;
                    i[642] = m;
                    if (!(m << 24 >> 24))
                      break d;
                    a = o + a | 0;
                  } else
                    t = 66;
 while (0);
                if ((t | 0) == 66) {
                  t = 0;
                  if (!(m << 24 >> 24))
                    break;
                }
                a = a - j | 0;
              }
 while (0);
            g = g - h | 0;
            if ((g | 0) < 1) {
              j = k[154] | 0;
              if (j + 1 & 2) {
                d = l[643] ^ 255;
                i[643] = d;
                d = d | r;
              }
              if (j & 1) {
                j = j ^ 147456;
                k[154] = j;
              }
              k[154] = j >> 1;
              g = g + p | 0;
            }
            q = q - h | 0;
          } while ((q | 0) > 0);
          k[152] = g;
          if ((i[647] | 0) == 0 ? (u = (k[153] | 0) + -2 | 0, k[153] = u, (u | 0) < 1) : 0) {
            j = k[148] | 0;
            m = k[159] | 0;
            b = m & 255;
            g = u;
            do {
              b = b + -1 << 24 >> 24;
              g = g + j | 0;
            } while ((g | 0) < 1);
            i[636] = b;
            k[153] = g;
            do
              if (b << 24 >> 24 < 0) {
                q = k[161] | 0;
                h = (q & 65280 | 0) == 0;
                j = q >>> 16;
                g = j & 255;
                if (!((q & 255) << 24 >> 24)) {
                  if (!((b & 32) == 0 | h)) {
                    g = (j ^ 31) & 255;
                    i[646] = g;
                  }
                  b = b & 31;
                  i[636] = b;
                  break;
                } else {
                  if (!h) {
                    g = (j ^ 31) & 255;
                    i[646] = g;
                  }
                  i[647] = 1;
                  i[636] = 0;
                  b = 0;
                  break;
                }
              } else
                g = i[646] | 0;
 while (0);
            g = k[648 + ((g & 255 ^ b << 24 >> 24) << 2) >> 2] | 0;
            k[158] = g;
            if (m & 65280)
              k[155] = g;
            if (m & 16711680)
              k[156] = g;
            if (m >>> 0 >= 16777216)
              k[157] = g;
          }
          c = c + -1 | 0;
        } while ((c & 1 | 0) == 0);
        r = ga(k[155] | 0, f) | 0;
        r = (ga(k[156] | 0, e) | 0) + r | 0;
        a = (((r + (ga(k[157] | 0, a) | 0) | 0) >>> 0) / 6 | 0) >>> 8 & 255;
        i[s >> 0] = a;
        a = c;
        r = k[208] | 0;
        s = s + 1 | 0;
      }
      return ;
    }
    function Lc() {
      var a = 0,
          b = 0.0;
      k[154] = 1;
      i[640] = 0;
      i[641] = 0;
      i[642] = 0;
      i[643] = -1;
      a = 31;
      b = 4095.0;
      while (1) {
        k[648 + (a << 2) >> 2] = ~~(b + .5) >>> 0;
        if ((a | 0) > 1) {
          a = a + -1 | 0;
          b = b / 1.188502227;
        } else
          break;
      }
      k[162] = 0;
      k[142] = 1;
      return ;
    }
    function Mc(a, b) {
      a = a | 0;
      b = b | 0;
      return ;
    }
    function Nc() {
      return ;
    }
    function Oc(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ;
    }
    function Pc(a) {
      a = a | 0;
      return ;
    }
    function Qc() {
      return 1;
    }
    function Rc() {
      return 1;
    }
    function Sc(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return 0;
    }
    function Tc() {
      return ;
    }
    function Uc(a) {
      a = a | 0;
      return 0;
    }
    function Vc(a) {
      a = a | 0;
      return 0;
    }
    function Wc(a) {
      a = a | 0;
      k[229] = a;
      return ;
    }
    function Xc(a) {
      a = a | 0;
      k[230] = a;
      return ;
    }
    function Yc(a) {
      a = a | 0;
      k[231] = a;
      return ;
    }
    function Zc(a) {
      a = a | 0;
      k[232] = a;
      return ;
    }
    function _c(a) {
      a = a | 0;
      k[233] = a;
      return ;
    }
    function $c(a) {
      a = a | 0;
      k[a >> 2] = 0;
      k[a + 4 >> 2] = 0;
      k[a + 8 >> 2] = 0;
      k[a + 12 >> 2] = 0;
      k[a >> 2] = 2588978;
      k[a + 4 >> 2] = 2588983;
      i[a + 12 >> 0] = 0;
      k[a + 8 >> 2] = 2588987;
      return ;
    }
    function ad(a) {
      a = a | 0;
      k[a >> 2] = 0;
      k[a + 4 >> 2] = 0;
      k[a + 8 >> 2] = 0;
      k[a + 12 >> 2] = 0;
      k[a + 16 >> 2] = 0;
      k[a + 20 >> 2] = 0;
      k[a + 24 >> 2] = 0;
      k[a + 28 >> 2] = 0;
      p[a + 24 >> 3] = 50.0;
      p[a + 32 >> 3] = 44100.0;
      k[a >> 2] = 330;
      k[a + 4 >> 2] = 410;
      k[a + 8 >> 2] = 330;
      k[a + 12 >> 2] = 410;
      o[a + 16 >> 2] = 0.0;
      return ;
    }
    function bd() {
      var a = 0,
          b = 0;
      a = r;
      r = r + 16 | 0;
      b = a;
      k[b >> 2] = 5;
      jc[k[916 >> 2] & 63](8, b) | 0;
      Lc();
      fe(2264252, 0, 135300) | 0;
      i[2588995] = 1;
      r = a;
      return ;
    }
    function cd() {
      return kd() | 0;
    }
    function dd(a, b) {
      a = a | 0;
      b = b | 0;
      return (ld(a, b) | 0) != 0 | 0;
    }
    function ed(a, b) {
      a = a | 0;
      b = b | 0;
      return (md(a, b) | 0) != 0 | 0;
    }
    function fd(a) {
      a = a | 0;
      var b = 0,
          c = 0;
      c = r;
      r = r + 352 | 0;
      b = c;
      ge(b | 0, 936, 340) | 0;
      jc[k[916 >> 2] & 63](11, b) | 0;
      ge(2547903, 2539711, k[194] | 0) | 0;
      b = a + 4 | 0;
      if (!(k[b >> 2] | 0)) {
        b = 0;
        r = c;
        return b | 0;
      }
      a = a + 8 | 0;
      if (((k[a >> 2] | 0) + -1 | 0) >>> 0 >= 32768) {
        b = 0;
        r = c;
        return b | 0;
      }
      fe(2556095, 0, 32768) | 0;
      ge(2556095, k[b >> 2] | 0, k[a >> 2] | 0) | 0;
      pd();
      Lc();
      b = 1;
      r = c;
      return b | 0;
    }
    function gd() {
      fe(2556095, 0, 32768) | 0;
      pd();
      return ;
    }
    function hd() {
      pd();
      Lc();
      return ;
    }
    function id() {
      var a = 0,
          b = 0,
          c = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0,
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
          E = 0;
      fe(2264252, 0, 270600) | 0;
      y = k[199] | 0;
      if ((y | 0) <= 0)
        return ;
      z = k[217] | 0;
      B = i[2588995] | 0;
      A = B & 255;
      B = B << 24 >> 24 == 1;
      C = A & 0 - A;
      D = 0;
      do {
        e = i[z + (D * 20 | 0) + 16 >> 0] | 0;
        f = ~~(+(k[z + (D * 20 | 0) >> 2] | 0) / 33.0e3 * 330.0) >>> 0;
        s = ~~(+(k[z + (D * 20 | 0) + 8 >> 2] | 0) / 33.0e3 * 330.0) >>> 0;
        h = ~~(+(k[z + (D * 20 | 0) + 4 >> 2] | 0) / 41.0e3 * 410.0) >>> 0;
        t = ~~(+(k[z + (D * 20 | 0) + 12 >> 2] | 0) / 41.0e3 * 410.0) >>> 0;
        a: do
          if (e << 24 >> 24 != -128) {
            if ((s | 0) == (f | 0) & (t | 0) == (h | 0)) {
              if (B) {
                x = e & 255;
                j[2264252 + ((h * 330 | 0) + f << 1) >> 1] = x << 5 | x | x << 10;
                break;
              }
              l = h - A | 0;
              l = (l | 0) > 0 ? l : 0;
              h = A + h | 0;
              h = (h | 0) > 409 ? 409 : h;
              g = f - A | 0;
              g = (g | 0) > 0 ? g : 0;
              f = A + f | 0;
              f = (f | 0) > 329 ? 329 : f;
              if ((l | 0) > (h | 0))
                break;
              c = e & 255;
              c = (c << 5 | c | c << 10) & 65535;
              if ((g | 0) > (f | 0))
                break;
              else
                a = l;
              while (1) {
                d = a - l | 0;
                d = ga(d, d) | 0;
                e = a * 330 | 0;
                b = g;
                while (1) {
                  x = b - g | 0;
                  if (((ga(x, x) | 0) + d | 0) <= (C | 0))
                    j[2264252 + (b + e << 1) >> 1] = c;
                  if ((b | 0) < (f | 0))
                    b = b + 1 | 0;
                  else
                    break;
                }
                if ((a | 0) < (h | 0))
                  a = a + 1 | 0;
                else
                  break a;
              }
            }
            u = s - f | 0;
            u = (u | 0) > -1 ? u : 0 - u | 0;
            v = t - h | 0;
            v = (v | 0) > -1 ? v : 0 - v | 0;
            w = s >>> 0 > f >>> 0 ? 1 : -1;
            x = t >>> 0 > h >>> 0 ? 1 : -1;
            q = e & 255;
            q = (q << 5 | q | q << 10) & 65535;
            r = 0 - v | 0;
            l = f;
            p = h;
            h = u - v | 0;
            while (1) {
              g = p * 330 | 0;
              n = (p | 0) == (t | 0);
              a = p - A | 0;
              a = (a | 0) > 0 ? a : 0;
              o = p + A | 0;
              o = (o | 0) > 409 ? 409 : o;
              m = (a | 0) > (o | 0);
              b: do
                if (B) {
                  if (!n)
                    while (1) {
                      j[2264252 + (l + g << 1) >> 1] = q;
                      o = h << 1;
                      n = (o | 0) > (r | 0);
                      h = h - (n ? v : 0) | 0;
                      l = (n ? w : 0) + l | 0;
                      if ((o | 0) < (u | 0))
                        break b;
                    }
                  do {
                    j[2264252 + (l + g << 1) >> 1] = q;
                    if ((l | 0) == (s | 0))
                      break a;
                    o = h << 1;
                    n = (o | 0) > (r | 0);
                    h = h - (n ? v : 0) | 0;
                    l = (n ? w : 0) + l | 0;
                  } while ((o | 0) >= (u | 0));
                } else
                  do {
                    e = l - A | 0;
                    e = (e | 0) > 0 ? e : 0;
                    d = l + A | 0;
                    d = (d | 0) > 329 ? 329 : d;
                    if (!(m | (e | 0) > (d | 0))) {
                      g = a;
                      while (1) {
                        c = g - a | 0;
                        c = ga(c, c) | 0;
                        b = g * 330 | 0;
                        f = e;
                        while (1) {
                          E = f - e | 0;
                          if (((ga(E, E) | 0) + c | 0) <= (C | 0))
                            j[2264252 + (f + b << 1) >> 1] = q;
                          if ((f | 0) < (d | 0))
                            f = f + 1 | 0;
                          else
                            break;
                        }
                        if ((g | 0) < (o | 0))
                          g = g + 1 | 0;
                        else
                          break;
                      }
                    }
                    if (n & (l | 0) == (s | 0))
                      break a;
                    E = h << 1;
                    g = (E | 0) > (r | 0);
                    h = h - (g ? v : 0) | 0;
                    l = (g ? w : 0) + l | 0;
                  } while ((E | 0) >= (u | 0));
 while (0);
              p = p + x | 0;
              h = h + u | 0;
            }
          }
 while (0);
        D = D + 1 | 0;
      } while ((D | 0) < (y | 0));
      return ;
    }
    function jd() {
      var a = 0,
          b = 0,
          c = 0,
          d = 0;
      c = r;
      r = r + 896 | 0;
      a = c;
      fe(a | 0, 0, 882) | 0;
      gc[k[928 >> 2] & 63]();
      do
        if (!((hc[k[932 >> 2] & 63](0, 1, 0, 6) | 0) << 16 >> 16))
          if (!((hc[k[932 >> 2] & 63](0, 1, 0, 7) | 0) << 16 >> 16)) {
            k[195] = 128;
            break;
          } else {
            k[195] = 255;
            break;
          }
        else
          k[195] = 0;
 while (0);
      do
        if (!((hc[k[932 >> 2] & 63](0, 1, 0, 4) | 0) << 16 >> 16))
          if (!((hc[k[932 >> 2] & 63](0, 1, 0, 5) | 0) << 16 >> 16)) {
            k[196] = 128;
            break;
          } else {
            k[196] = 0;
            break;
          }
        else
          k[196] = 255;
 while (0);
      b = (hc[k[932 >> 2] & 63](0, 1, 0, 8) | 0) << 16 >> 16 == 0;
      d = k[215] | 0;
      k[215] = b ? d | 1 : d & -2;
      d = (hc[k[932 >> 2] & 63](0, 1, 0, 0) | 0) << 16 >> 16 == 0;
      b = k[215] | 0;
      k[215] = d ? b | 2 : b & -3;
      b = (hc[k[932 >> 2] & 63](0, 1, 0, 9) | 0) << 16 >> 16 == 0;
      d = k[215] | 0;
      k[215] = b ? d | 4 : d & -5;
      d = (hc[k[932 >> 2] & 63](0, 1, 0, 1) | 0) << 16 >> 16 == 0;
      b = k[215] | 0;
      k[215] = d ? b | 8 : b & -9;
      do
        if (!((hc[k[932 >> 2] & 63](1, 1, 0, 6) | 0) << 16 >> 16))
          if (!((hc[k[932 >> 2] & 63](1, 1, 0, 7) | 0) << 16 >> 16)) {
            k[197] = 128;
            break;
          } else {
            k[197] = 255;
            break;
          }
        else
          k[197] = 0;
 while (0);
      do
        if (!((hc[k[932 >> 2] & 63](1, 1, 0, 4) | 0) << 16 >> 16))
          if (!((hc[k[932 >> 2] & 63](1, 1, 0, 5) | 0) << 16 >> 16)) {
            k[198] = 128;
            break;
          } else {
            k[198] = 0;
            break;
          }
        else
          k[198] = 255;
 while (0);
      b = (hc[k[932 >> 2] & 63](1, 1, 0, 8) | 0) << 16 >> 16 == 0;
      d = k[215] | 0;
      k[215] = b ? d | 16 : d & -17;
      d = (hc[k[932 >> 2] & 63](1, 1, 0, 0) | 0) << 16 >> 16 == 0;
      b = k[215] | 0;
      k[215] = d ? b | 32 : b & -33;
      b = (hc[k[932 >> 2] & 63](1, 1, 0, 9) | 0) << 16 >> 16 == 0;
      d = k[215] | 0;
      k[215] = b ? d | 64 : d & -65;
      d = (hc[k[932 >> 2] & 63](1, 1, 0, 1) | 0) << 16 >> 16 == 0;
      b = k[215] | 0;
      k[215] = d ? b | 128 : b & -129;
      qd(3e4);
      Kc(0, a, 882);
      b = 0;
      do {
        d = ((l[a + b >> 0] | 0) << 8) + 63489 & 65535;
        dc[k[924 >> 2] & 63](d, d);
        b = b + 1 | 0;
      } while ((b | 0) != 882);
      kc[k[920 >> 2] & 63](2264252, 330, 410, 660);
      r = c;
      return ;
    }
    function kd() {
      var a = 0;
      a = (Bc() | 0) + 1221 | 0;
      return a + (Gc() | 0) | 0;
    }
    function ld(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
          d = 0;
      c = (Bc() | 0) + 1221 | 0;
      if ((c + (Gc() | 0) | 0) > (b | 0)) {
        c = 0;
        return c | 0;
      }
      Cc(a);
      c = Bc() | 0;
      Hc(a + c | 0);
      c = (Gc() | 0) + c | 0;
      ge(a + c | 0, 2588996, 1024) | 0;
      b = a + (c + 1024) | 0;
      d = k[319] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1028) | 0;
      d = k[320] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1032) | 0;
      d = k[321] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1036) | 0;
      d = k[322] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1040) | 0;
      d = k[323] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1044) | 0;
      d = k[324] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1048) | 0;
      d = k[325] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1052) | 0;
      d = k[326] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1056) | 0;
      d = k[327] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1060) | 0;
      d = k[328] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1064) | 0;
      d = k[329] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1068) | 0;
      d = k[330] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1072) | 0;
      d = k[331] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1076) | 0;
      d = k[332] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1080) | 0;
      d = k[333] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1084) | 0;
      d = k[333] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1088) | 0;
      d = k[334] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1092) | 0;
      d = k[335] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1096) | 0;
      d = k[336] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1100) | 0;
      d = k[337] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1104) | 0;
      d = k[338] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1108) | 0;
      d = k[339] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1112) | 0;
      d = k[340] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1116) | 0;
      d = k[341] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1120) | 0;
      d = k[342] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1124) | 0;
      d = k[343] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1128) | 0;
      d = k[344] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1132) | 0;
      d = k[345] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1136) | 0;
      d = k[345] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1140) | 0;
      d = k[346] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1144) | 0;
      d = k[347] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1148) | 0;
      d = k[348] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1152) | 0;
      d = k[195] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1156) | 0;
      d = k[196] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1160) | 0;
      d = k[197] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1164) | 0;
      d = k[198] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1168) | 0;
      d = k[349] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1172) | 0;
      d = k[350] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1176) | 0;
      d = k[351] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1180) | 0;
      d = k[352] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1184) | 0;
      d = k[353] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1188) | 0;
      d = k[354] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1192) | 0;
      d = k[355] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1196) | 0;
      d = k[356] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1200) | 0;
      d = k[357] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1204) | 0;
      d = k[358] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1208) | 0;
      d = k[359] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1212) | 0;
      d = k[199] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      b = a + (c + 1216) | 0;
      d = k[200] | 0;
      i[b >> 0] = d;
      i[b + 1 >> 0] = d >> 8;
      i[b + 2 >> 0] = d >> 16;
      i[b + 3 >> 0] = d >> 24;
      i[a + (c + 1220) >> 0] = i[2590020] | 0;
      c = 1;
      return c | 0;
    }
    function md(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0;
      c = (Bc() | 0) + 1221 | 0;
      if ((c + (Gc() | 0) | 0) > (b | 0)) {
        c = 0;
        return c | 0;
      }
      Dc(a);
      c = Bc() | 0;
      Ic(a + c | 0);
      c = (Gc() | 0) + c | 0;
      ge(2588996, a + c | 0, 1024) | 0;
      b = a + (c + 1024) | 0;
      k[319] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1028) | 0;
      k[320] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1032) | 0;
      k[321] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1036) | 0;
      k[322] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1040) | 0;
      k[323] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1044) | 0;
      k[324] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1048) | 0;
      k[325] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1052) | 0;
      k[326] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1056) | 0;
      k[327] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1060) | 0;
      k[328] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1064) | 0;
      k[329] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1068) | 0;
      k[330] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1072) | 0;
      k[331] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1076) | 0;
      k[332] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1080) | 0;
      k[333] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1084) | 0;
      k[333] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1088) | 0;
      k[334] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1092) | 0;
      k[335] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1096) | 0;
      k[336] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1100) | 0;
      k[337] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1104) | 0;
      k[338] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1108) | 0;
      k[339] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1112) | 0;
      k[340] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1116) | 0;
      k[341] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1120) | 0;
      k[342] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1124) | 0;
      k[343] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1128) | 0;
      k[344] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1132) | 0;
      k[345] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1136) | 0;
      k[345] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1140) | 0;
      k[346] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1144) | 0;
      k[347] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1148) | 0;
      k[348] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1152) | 0;
      k[195] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1156) | 0;
      k[196] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1160) | 0;
      k[197] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1164) | 0;
      k[198] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1168) | 0;
      k[349] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1172) | 0;
      k[350] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1176) | 0;
      k[351] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1180) | 0;
      k[352] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1184) | 0;
      k[353] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1188) | 0;
      k[354] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1192) | 0;
      k[355] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1196) | 0;
      k[356] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1200) | 0;
      k[357] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1204) | 0;
      k[358] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1208) | 0;
      k[359] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1212) | 0;
      k[199] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      b = a + (c + 1216) | 0;
      k[200] = l[b >> 0] | l[b + 1 >> 0] << 8 | l[b + 2 >> 0] << 16 | l[b + 3 >> 0] << 24;
      i[2590020] = i[a + (c + 1220) >> 0] | 0;
      c = 1;
      return c | 0;
    }
    function nd(a) {
      a = a | 0;
      var b = 0,
          c = 0;
      b = a & 57344;
      a: do
        if ((b | 0) < 57344) {
          switch (b | 0) {
            case 49152:
              break;
            default:
              break a;
          }
          if (a & 2048) {
            a = i[2588996 + (a & 1023) >> 0] | 0;
            return a | 0;
          }
          if (!(a & 4096)) {
            a = 0;
            return a | 0;
          }
          do
            switch (a & 15 | 0) {
              case 8:
                {
                  a = k[332] & 255;
                  b = k[340] | 0;
                  k[330] = 0;
                  k[331] = 0;
                  c = b & 95;
                  k[340] = (c & k[341] | 0) == 0 ? c : b & 95 | 128;
                  return a | 0;
                }
              case 0:
                {
                  b = k[321] | 0;
                  if (!(k[338] & 128)) {
                    c = (k[350] | b & 223) & 255;
                    return c | 0;
                  } else {
                    c = (k[329] | b & 95 | k[350]) & 255;
                    return c | 0;
                  }
                }
              case 1:
                {
                  if ((k[339] & 14 | 0) == 8)
                    k[342] = 0;
                  break;
                }
              case 15:
                break;
              case 2:
                {
                  c = k[323] & 255;
                  return c | 0;
                }
              case 3:
                {
                  c = k[322] & 255;
                  return c | 0;
                }
              case 4:
                {
                  c = k[326] & 255;
                  a = k[340] | 0;
                  k[324] = 0;
                  k[325] = 0;
                  k[329] = 128;
                  b = a & 63;
                  k[340] = (b & k[341] | 0) == 0 ? b : a & 63 | 128;
                  return c | 0;
                }
              case 5:
                {
                  c = (k[326] | 0) >>> 8 & 255;
                  return c | 0;
                }
              case 6:
                {
                  c = k[327] & 255;
                  return c | 0;
                }
              case 7:
                {
                  c = k[328] & 255;
                  return c | 0;
                }
              case 9:
                {
                  c = (k[332] | 0) >>> 8 & 255;
                  return c | 0;
                }
              case 14:
                {
                  c = (k[341] | 128) & 255;
                  return c | 0;
                }
              case 10:
                {
                  c = k[334] & 255;
                  a = k[340] | 0;
                  k[335] = 0;
                  k[337] = 1;
                  b = a & 123;
                  k[340] = (b & k[341] | 0) == 0 ? b : a & 123 | 128;
                  return c | 0;
                }
              case 11:
                {
                  c = k[338] & 255;
                  return c | 0;
                }
              case 12:
                {
                  c = k[339] & 255;
                  return c | 0;
                }
              case 13:
                {
                  c = k[340] & 255;
                  return c | 0;
                }
              default:
                {
                  c = 0;
                  return c | 0;
                }
            }
 while (0);
          if ((k[321] & 24 | 0) == 8) {
            c = k[804 + (k[319] << 2) >> 2] & 255;
            return c | 0;
          } else {
            c = k[320] & 255;
            return c | 0;
          }
        } else {
          switch (b | 0) {
            case 57344:
              break;
            default:
              break a;
          }
          c = i[2547903 + (a & 8191) >> 0] | 0;
          return c | 0;
        }
 while (0);
      if (a >>> 0 >= 32768) {
        c = -1;
        return c | 0;
      }
      c = i[2556095 + a >> 0] | 0;
      return c | 0;
    }
    function od(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
          d = 0;
      if ((a & 57344 | 0) != 49152)
        return ;
      if (a & 2048)
        i[2588996 + (a & 1023) >> 0] = b;
      if (!(a & 4096))
        return ;
      do
        switch (a & 15 | 0) {
          case 6:
            {
              k[327] = b & 255;
              return ;
            }
          case 5:
            {
              b = b & 255;
              k[328] = b;
              k[326] = k[327] | b << 8;
              b = k[340] | 0;
              k[324] = 1;
              k[325] = 1;
              k[329] = 0;
              d = b & 63;
              k[340] = (d & k[341] | 0) == 0 ? d : b & 63 | 128;
              return ;
            }
          case 7:
            {
              k[328] = b & 255;
              return ;
            }
          case 8:
            {
              k[333] = b & 255;
              return ;
            }
          case 1:
            {
              if ((k[339] & 14 | 0) == 8)
                k[342] = 0;
              break;
            }
          case 15:
            break;
          case 0:
            {
              a = b & 255;
              k[321] = a;
              switch (a & 24 | 0) {
                case 24:
                  {
                    c = k[320] | 0;
                    if (!(c & 240))
                      k[319] = c & 15;
                    break;
                  }
                case 16:
                  {
                    c = k[319] | 0;
                    if ((c | 0) != 14) {
                      a = k[320] | 0;
                      k[804 + (c << 2) >> 2] = a;
                      Jc(c, a);
                      a = k[321] | 0;
                    }
                    break;
                  }
                default:
                  {}
              }
              a: do
                switch (a & 6 | 0) {
                  case 4:
                    {
                      c = k[197] | 0;
                      k[349] = c;
                      if (!(a & 1)) {
                        a = k[346] | 0;
                        if (a >>> 0 > 128) {
                          k[348] = a + -128;
                          break a;
                        } else {
                          k[348] = 0;
                          break a;
                        }
                      }
                      break;
                    }
                  case 2:
                    {
                      c = k[196] | 0;
                      k[349] = c;
                      if (!(a & 1))
                        k[345] = k[346];
                      break;
                    }
                  case 0:
                    {
                      c = k[195] | 0;
                      k[349] = c;
                      if (!(a & 1))
                        k[347] = k[346];
                      break;
                    }
                  case 6:
                    {
                      c = k[198] | 0;
                      k[349] = c;
                      break;
                    }
                  default:
                    c = k[349] | 0;
                }
 while (0);
              d = k[346] | 0;
              k[350] = c >>> 0 > d >>> 0 ? 32 : 0;
              b = k[345] | 0;
              k[360] = d - b;
              k[361] = b - (k[347] | 0);
              if ((k[339] & 224 | 0) != 128)
                return ;
              k[343] = 0;
              return ;
            }
          case 2:
            {
              k[323] = b & 255;
              return ;
            }
          case 3:
            {
              k[322] = b & 255;
              return ;
            }
          case 4:
            {
              k[327] = b & 255;
              return ;
            }
          case 12:
            {
              b = b & 255;
              k[339] = b;
              k[342] = (b & 14 | 0) != 12 & 1;
              if ((b & 224 | 0) == 192) {
                k[343] = 0;
                return ;
              } else {
                k[343] = 1;
                return ;
              }
            }
          case 13:
            {
              b = k[340] & ((b & 255 | -128) ^ 127);
              d = b & 127;
              k[340] = (d & k[341] | 0) == 0 ? d : b | 128;
              return ;
            }
          case 14:
            {
              c = b & 255;
              if (!(c & 128))
                c = k[341] & ((c | -128) ^ 127);
              else
                c = k[341] | c & 127;
              k[341] = c;
              b = k[340] | 0;
              d = b & 127;
              k[340] = (d & c | 0) == 0 ? d : b | 128;
              return ;
            }
          case 9:
            {
              k[332] = k[333] | (b & 255) << 8;
              b = k[340] | 0;
              k[330] = 1;
              k[331] = 1;
              d = b & 95;
              k[340] = (d & k[341] | 0) == 0 ? d : b & 95 | 128;
              return ;
            }
          case 11:
            {
              k[338] = b & 255;
              return ;
            }
          case 10:
            {
              k[334] = b & 255;
              b = k[340] | 0;
              k[335] = 0;
              k[337] = 1;
              d = b & 123;
              k[340] = (d & k[341] | 0) == 0 ? d : b & 123 | 128;
              return ;
            }
          default:
            return ;
        }
 while (0);
      d = b & 255;
      k[320] = d;
      a = k[321] | 0;
      switch (a & 24 | 0) {
        case 24:
          {
            if (!(d & 240)) {
              k[319] = d & 15;
              c = a;
            } else
              c = a;
            break;
          }
        case 16:
          {
            c = k[319] | 0;
            if ((c | 0) == 14)
              c = a;
            else {
              k[804 + (c << 2) >> 2] = d;
              Jc(c, d);
              c = k[321] | 0;
            }
            break;
          }
        default:
          c = a;
      }
      d = d ^ 128;
      k[346] = d;
      b: do
        switch (c & 6 | 0) {
          case 0:
            {
              a = k[195] | 0;
              k[349] = a;
              if (!(c & 1))
                k[347] = d;
              break;
            }
          case 2:
            {
              a = k[196] | 0;
              k[349] = a;
              if (!(c & 1))
                k[345] = d;
              break;
            }
          case 4:
            {
              a = k[197] | 0;
              k[349] = a;
              if (!(c & 1))
                if (d >>> 0 > 128) {
                  k[348] = b << 24 >> 24;
                  break b;
                } else {
                  k[348] = 0;
                  break b;
                }
              break;
            }
          case 6:
            {
              a = k[198] | 0;
              k[349] = a;
              break;
            }
          default:
            a = k[349] | 0;
        }
 while (0);
      k[350] = a >>> 0 > d >>> 0 ? 32 : 0;
      b = k[345] | 0;
      k[360] = d - b;
      k[361] = b - (k[347] | 0);
      return ;
    }
    function pd() {
      var a = 0;
      a = 0;
      do {
        i[2588996 + a >> 0] = a;
        a = a + 1 | 0;
      } while ((a | 0) != 1024);
      k[201] = 0;
      Jc(0, 0);
      k[202] = 0;
      Jc(1, 0);
      k[203] = 0;
      Jc(2, 0);
      k[204] = 0;
      Jc(3, 0);
      k[205] = 0;
      Jc(4, 0);
      k[206] = 0;
      Jc(5, 0);
      k[207] = 0;
      Jc(6, 0);
      k[208] = 0;
      Jc(7, 0);
      k[209] = 0;
      Jc(8, 0);
      k[210] = 0;
      Jc(9, 0);
      k[211] = 0;
      Jc(10, 0);
      k[212] = 0;
      Jc(11, 0);
      k[213] = 0;
      Jc(12, 0);
      k[214] = 0;
      Jc(13, 0);
      k[215] = 0;
      Jc(14, 0);
      k[216] = 0;
      Jc(15, 0);
      k[215] = 255;
      Jc(14, 255);
      k[319] = 0;
      k[320] = 0;
      k[321] = 0;
      k[322] = 0;
      k[323] = 0;
      k[324] = 0;
      k[325] = 0;
      k[326] = 0;
      k[327] = 0;
      k[328] = 0;
      k[329] = 128;
      k[330] = 0;
      k[331] = 0;
      k[332] = 0;
      k[333] = 0;
      k[334] = 0;
      k[335] = 8;
      k[336] = 0;
      k[337] = 0;
      k[338] = 0;
      k[339] = 0;
      k[340] = 0;
      k[341] = 0;
      k[342] = 1;
      k[343] = 1;
      k[344] = 0;
      k[345] = 128;
      k[346] = 128;
      k[347] = 128;
      k[348] = 0;
      k[195] = 128;
      k[196] = 128;
      k[197] = 128;
      k[198] = 128;
      k[349] = 128;
      k[350] = 0;
      k[360] = 0;
      k[361] = 0;
      k[352] = 16500;
      k[353] = 20500;
      k[351] = 0;
      k[199] = 0;
      k[200] = 0;
      k[217] = 1448;
      k[218] = 1001448;
      k[500362] = 5e4;
      k[139] = 44;
      k[140] = 44;
      Ec();
      return ;
    }
    function qd(a) {
      a = a | 0;
      var b = 0,
          c = 0,
          d = 0,
          e = 0,
          f = 0,
          g = 0,
          h = 0;
      if ((a | 0) <= 0)
        return ;
      do {
        g = Fc(k[340] & 128, 0) | 0;
        if (g) {
          h = 0;
          do {
            do
              if ((k[324] | 0) != 0 ? (f = (k[326] | 0) + -1 | 0, k[326] = f, (f & 65535 | 0) == 65535) : 0) {
                if (k[338] & 64) {
                  f = k[340] | 0;
                  e = f & 63 | 64;
                  k[340] = (e & k[341] | 0) == 0 ? e : f | 192;
                  k[329] = 128 - (k[329] | 0);
                  k[326] = k[328] << 8 | k[327];
                  break;
                }
                if (k[325] | 0) {
                  f = k[340] | 0;
                  e = f & 63 | 64;
                  k[340] = (e & k[341] | 0) == 0 ? e : f | 192;
                  k[329] = 128;
                  k[325] = 0;
                }
              }
 while (0);
            if (((k[330] | 0) != 0 ? (k[338] & 32 | 0) == 0 : 0) ? (f = (k[332] | 0) + -1 | 0, k[332] = f, (k[331] | 0) != 0 & (f & 65535 | 0) == 65535) : 0) {
              f = k[340] | 0;
              e = f & 95 | 32;
              k[340] = (e & k[341] | 0) == 0 ? e : f | 160;
              k[331] = 0;
            }
            f = (k[336] | 0) + -1 | 0;
            k[336] = f;
            do
              if ((f & 255 | 0) == 255) {
                k[336] = k[333];
                if (!(k[337] | 0)) {
                  k[337] = 1;
                  b = 0;
                  break;
                } else {
                  k[337] = 0;
                  b = 1;
                  break;
                }
              } else
                b = 0;
 while (0);
            c = k[335] | 0;
            d = k[338] | 0;
            a: do
              if (c >>> 0 < 8) {
                switch (d & 28 | 0) {
                  case 8:
                    {
                      k[334] = k[334] << 1;
                      b = c + 1 | 0;
                      k[335] = b;
                      break;
                    }
                  case 16:
                    {
                      if (!b)
                        break a;
                      f = k[334] | 0;
                      e = f >>> 7 & 1;
                      k[344] = e;
                      k[334] = e | f << 1;
                      break a;
                    }
                  case 20:
                    {
                      if (!b)
                        break a;
                      b = k[334] | 0;
                      f = b >>> 7 & 1;
                      k[344] = f;
                      k[334] = f | b << 1;
                      b = c + 1 | 0;
                      k[335] = b;
                      break;
                    }
                  case 24:
                    {
                      b = k[334] | 0;
                      f = b >>> 7 & 1;
                      k[344] = f;
                      k[334] = f | b << 1;
                      b = c + 1 | 0;
                      k[335] = b;
                      break;
                    }
                  case 4:
                    {
                      if (!b)
                        break a;
                      k[334] = k[334] << 1;
                      b = c + 1 | 0;
                      k[335] = b;
                      break;
                    }
                  default:
                    break a;
                }
                if ((b | 0) == 8) {
                  f = k[340] | 0;
                  e = f & 123 | 4;
                  k[340] = (e & k[341] | 0) == 0 ? e : f | 132;
                }
              }
 while (0);
            e = (d & 16 | 0) == 0 ? k[343] | 0 : k[344] | 0;
            if (k[342] | 0)
              if (!(((d & 128 | 0) == 0 ? k[321] & 128 : k[329] | 0) | 0)) {
                d = k[360] | 0;
                f = k[361] | 0;
              } else {
                d = 0;
                f = 0;
              }
            else {
              d = 16500 - (k[352] | 0) | 0;
              f = 20500 - (k[353] | 0) | 0;
            }
            do
              if (!(k[351] | 0)) {
                c = k[352] | 0;
                b = k[353] | 0;
                if (b >>> 0 < 41e3 & ((e | 0) == 1 & c >>> 0 < 33e3)) {
                  k[351] = 1;
                  k[354] = c;
                  k[355] = b;
                  k[356] = c;
                  k[357] = b;
                  k[358] = d;
                  k[359] = f;
                  i[2590020] = k[348];
                }
              } else {
                if (!e) {
                  k[351] = 0;
                  ud(k[354] | 0, k[355] | 0, k[356] | 0, k[357] | 0, i[2590020] | 0);
                  break;
                }
                if ((d | 0) == (k[358] | 0) & (f | 0) == (k[359] | 0)) {
                  b = i[2590020] | 0;
                  if (b << 24 >> 24 == (k[348] & 255) << 24 >> 24)
                    break;
                } else
                  b = i[2590020] | 0;
                ud(k[354] | 0, k[355] | 0, k[356] | 0, k[357] | 0, b);
                c = k[352] | 0;
                b = k[353] | 0;
                if (c >>> 0 < 33e3 & b >>> 0 < 41e3) {
                  k[354] = c;
                  k[355] = b;
                  k[356] = c;
                  k[357] = b;
                  k[358] = d;
                  k[359] = f;
                  i[2590020] = k[348];
                  break;
                } else {
                  k[351] = 0;
                  break;
                }
              }
 while (0);
            c = (k[352] | 0) + d | 0;
            k[352] = c;
            b = (k[353] | 0) + f | 0;
            k[353] = b;
            if (b >>> 0 < 41e3 & (c >>> 0 < 33e3 & (k[351] | 0) == 1)) {
              k[356] = c;
              k[357] = b;
            }
            b = k[339] | 0;
            if ((b & 14 | 0) == 10)
              k[342] = 1;
            if ((b & 224 | 0) == 160)
              k[343] = 1;
            h = h + 1 | 0;
          } while ((h | 0) != (g | 0));
        }
        a = a - g | 0;
        b = (k[500362] | 0) - g | 0;
        k[500362] = b;
        if ((b | 0) < 0) {
          k[500362] = b + 5e4;
          id();
          k[200] = k[199];
          k[199] = 0;
          h = k[218] | 0;
          k[218] = k[217];
          k[217] = h;
        }
      } while ((a | 0) > 0);
      return ;
    }
    function rd(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
          f = 0;
      if (a & 128) {
        e = k[223] | 0;
        f = (k[b >> 2] | 0) + -1 | 0;
        k[b >> 2] = f;
        dc[k[560 >> 2] & 63](f & 65535, e & 255);
        f = (k[b >> 2] | 0) + -1 | 0;
        k[b >> 2] = f;
        dc[k[560 >> 2] & 63](f & 65535, e >>> 8 & 255);
        k[d >> 2] = (k[d >> 2] | 0) + 2;
      }
      if (a & 64) {
        f = (k[b >> 2] | 0) + -1 | 0;
        k[b >> 2] = f;
        dc[k[560 >> 2] & 63](f & 65535, c & 255);
        f = (k[b >> 2] | 0) + -1 | 0;
        k[b >> 2] = f;
        dc[k[560 >> 2] & 63](f & 65535, c >>> 8 & 255);
        k[d >> 2] = (k[d >> 2] | 0) + 2;
      }
      if (a & 32) {
        f = k[220] | 0;
        e = (k[b >> 2] | 0) + -1 | 0;
        k[b >> 2] = e;
        dc[k[560 >> 2] & 63](e & 65535, f & 255);
        e = (k[b >> 2] | 0) + -1 | 0;
        k[b >> 2] = e;
        dc[k[560 >> 2] & 63](e & 65535, f >>> 8 & 255);
        k[d >> 2] = (k[d >> 2] | 0) + 2;
      }
      if (a & 16) {
        f = k[219] | 0;
        e = (k[b >> 2] | 0) + -1 | 0;
        k[b >> 2] = e;
        dc[k[560 >> 2] & 63](e & 65535, f & 255);
        e = (k[b >> 2] | 0) + -1 | 0;
        k[b >> 2] = e;
        dc[k[560 >> 2] & 63](e & 65535, f >>> 8 & 255);
        k[d >> 2] = (k[d >> 2] | 0) + 2;
      }
      if (a & 8) {
        f = k[226] | 0;
        e = (k[b >> 2] | 0) + -1 | 0;
        k[b >> 2] = e;
        dc[k[560 >> 2] & 63](e & 65535, f & 255);
        k[d >> 2] = (k[d >> 2] | 0) + 1;
      }
      if (a & 4) {
        f = k[225] | 0;
        e = (k[b >> 2] | 0) + -1 | 0;
        k[b >> 2] = e;
        dc[k[560 >> 2] & 63](e & 65535, f & 255);
        k[d >> 2] = (k[d >> 2] | 0) + 1;
      }
      if (a & 2) {
        f = k[224] | 0;
        e = (k[b >> 2] | 0) + -1 | 0;
        k[b >> 2] = e;
        dc[k[560 >> 2] & 63](e & 65535, f & 255);
        k[d >> 2] = (k[d >> 2] | 0) + 1;
      }
      if (!(a & 1))
        return ;
      f = k[227] | 0;
      e = (k[b >> 2] | 0) + -1 | 0;
      k[b >> 2] = e;
      dc[k[560 >> 2] & 63](e & 65535, f & 255);
      k[d >> 2] = (k[d >> 2] | 0) + 1;
      return ;
    }
    function sd(a) {
      a = a | 0;
      var b = 0,
          c = 0,
          d = 0,
          e = 0;
      b = (ec[k[556 >> 2] & 63](k[223] & 65535) | 0) & 255;
      c = k[223] | 0;
      d = c + 1 | 0;
      k[223] = d;
      e = b >>> 5 & 3;
      do
        switch (b | 0) {
          case 230:
          case 198:
          case 166:
          case 134:
            {
              d = k[224] | 0;
              e = (((d | -129) ^ 128) + 1 | d & 255) + (k[k[2263536 + (e << 2) >> 2] >> 2] | 0) | 0;
              k[a >> 2] = (k[a >> 2] | 0) + 1;
              a = e;
              return a | 0;
            }
          case 246:
          case 214:
          case 182:
          case 150:
            {
              d = k[224] | 0;
              d = (((d | -129) ^ 128) + 1 | d & 255) + (k[k[2263536 + (e << 2) >> 2] >> 2] | 0) | 0;
              e = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              e = (ec[k[556 >> 2] & 63](d + 1 & 65535) | 0) & 255 | e << 8;
              k[a >> 2] = (k[a >> 2] | 0) + 4;
              a = e;
              return a | 0;
            }
          case 245:
          case 213:
          case 181:
          case 149:
            {
              d = k[225] | 0;
              d = (((d | -129) ^ 128) + 1 | d & 255) + (k[k[2263536 + (e << 2) >> 2] >> 2] | 0) | 0;
              e = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              e = (ec[k[556 >> 2] & 63](d + 1 & 65535) | 0) & 255 | e << 8;
              k[a >> 2] = (k[a >> 2] | 0) + 4;
              a = e;
              return a | 0;
            }
          case 235:
          case 203:
          case 171:
          case 139:
            {
              e = (k[225] & 255 | k[224] << 8) + (k[k[2263536 + (e << 2) >> 2] >> 2] | 0) | 0;
              k[a >> 2] = (k[a >> 2] | 0) + 4;
              a = e;
              return a | 0;
            }
          case 251:
          case 219:
          case 187:
          case 155:
            {
              d = (k[225] & 255 | k[224] << 8) + (k[k[2263536 + (e << 2) >> 2] >> 2] | 0) | 0;
              e = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              e = (ec[k[556 >> 2] & 63](d + 1 & 65535) | 0) & 255 | e << 8;
              k[a >> 2] = (k[a >> 2] | 0) + 7;
              a = e;
              return a | 0;
            }
          case 127:
          case 126:
          case 125:
          case 124:
          case 123:
          case 122:
          case 121:
          case 120:
          case 119:
          case 118:
          case 117:
          case 116:
          case 115:
          case 114:
          case 113:
          case 112:
          case 95:
          case 94:
          case 93:
          case 92:
          case 91:
          case 90:
          case 89:
          case 88:
          case 87:
          case 86:
          case 85:
          case 84:
          case 83:
          case 82:
          case 81:
          case 80:
          case 63:
          case 62:
          case 61:
          case 60:
          case 59:
          case 58:
          case 57:
          case 56:
          case 55:
          case 54:
          case 53:
          case 52:
          case 51:
          case 50:
          case 49:
          case 48:
          case 31:
          case 30:
          case 29:
          case 28:
          case 27:
          case 26:
          case 25:
          case 24:
          case 23:
          case 22:
          case 21:
          case 20:
          case 19:
          case 18:
          case 17:
          case 16:
            {
              e = (b | -16) + (k[k[2263536 + (e << 2) >> 2] >> 2] | 0) | 0;
              k[a >> 2] = (k[a >> 2] | 0) + 1;
              a = e;
              return a | 0;
            }
          case 232:
          case 200:
          case 168:
          case 136:
            {
              e = k[k[2263536 + (e << 2) >> 2] >> 2] | 0;
              d = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              k[a >> 2] = (k[a >> 2] | 0) + 1;
              a = (((d | -129) ^ 128) + 1 | d) + e | 0;
              return a | 0;
            }
          case 227:
          case 226:
          case 195:
          case 194:
          case 163:
          case 162:
          case 131:
          case 130:
            {
              d = k[2263536 + (e << 2) >> 2] | 0;
              e = ((b | -2) ^ 1) + (k[d >> 2] | 0) | 0;
              k[d >> 2] = e;
              k[a >> 2] = (k[a >> 2] | 0) + (b & 1 | 2);
              a = e;
              return a | 0;
            }
          case 241:
          case 240:
          case 209:
          case 208:
          case 177:
          case 176:
          case 145:
          case 144:
            {
              c = k[2263536 + (e << 2) >> 2] | 0;
              d = k[c >> 2] | 0;
              e = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              e = (ec[k[556 >> 2] & 63](d + 1 & 65535) | 0) & 255 | e << 8;
              d = b & 1;
              k[c >> 2] = d + 1 + (k[c >> 2] | 0);
              k[a >> 2] = d + 5 + (k[a >> 2] | 0);
              a = e;
              return a | 0;
            }
          case 225:
          case 224:
          case 193:
          case 192:
          case 161:
          case 160:
          case 129:
          case 128:
            {
              c = k[2263536 + (e << 2) >> 2] | 0;
              e = k[c >> 2] | 0;
              d = b & 1;
              k[c >> 2] = d + 1 + e;
              k[a >> 2] = (k[a >> 2] | 0) + (d | 2);
              a = e;
              return a | 0;
            }
          case 111:
          case 110:
          case 109:
          case 108:
          case 107:
          case 106:
          case 105:
          case 104:
          case 103:
          case 102:
          case 101:
          case 100:
          case 99:
          case 98:
          case 97:
          case 96:
          case 79:
          case 78:
          case 77:
          case 76:
          case 75:
          case 74:
          case 73:
          case 72:
          case 71:
          case 70:
          case 69:
          case 68:
          case 67:
          case 66:
          case 65:
          case 64:
          case 47:
          case 46:
          case 45:
          case 44:
          case 43:
          case 42:
          case 41:
          case 40:
          case 39:
          case 38:
          case 37:
          case 36:
          case 35:
          case 34:
          case 33:
          case 32:
          case 15:
          case 14:
          case 13:
          case 12:
          case 11:
          case 10:
          case 9:
          case 8:
          case 7:
          case 6:
          case 5:
          case 4:
          case 3:
          case 2:
          case 1:
          case 0:
            {
              e = (k[k[2263536 + (e << 2) >> 2] >> 2] | 0) + (b & 15) | 0;
              k[a >> 2] = (k[a >> 2] | 0) + 1;
              a = e;
              return a | 0;
            }
          case 248:
          case 216:
          case 184:
          case 152:
            {
              e = k[k[2263536 + (e << 2) >> 2] >> 2] | 0;
              d = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              k[223] = (k[223] | 0) + 1;
              d = (((d | -129) ^ 128) + 1 | d) + e | 0;
              e = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              e = (ec[k[556 >> 2] & 63](d + 1 & 65535) | 0) & 255 | e << 8;
              k[a >> 2] = (k[a >> 2] | 0) + 4;
              a = e;
              return a | 0;
            }
          case 244:
          case 212:
          case 180:
          case 148:
            {
              d = k[k[2263536 + (e << 2) >> 2] >> 2] | 0;
              e = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              e = (ec[k[556 >> 2] & 63](d + 1 & 65535) | 0) & 255 | e << 8;
              k[a >> 2] = (k[a >> 2] | 0) + 3;
              a = e;
              return a | 0;
            }
          case 229:
          case 197:
          case 165:
          case 133:
            {
              d = k[225] | 0;
              e = (((d | -129) ^ 128) + 1 | d & 255) + (k[k[2263536 + (e << 2) >> 2] >> 2] | 0) | 0;
              k[a >> 2] = (k[a >> 2] | 0) + 1;
              a = e;
              return a | 0;
            }
          case 233:
          case 201:
          case 169:
          case 137:
            {
              e = k[k[2263536 + (e << 2) >> 2] >> 2] | 0;
              d = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              d = (ec[k[556 >> 2] & 63](c + 2 & 65535) | 0) & 255 | d << 8;
              k[223] = (k[223] | 0) + 2;
              k[a >> 2] = (k[a >> 2] | 0) + 4;
              a = d + e | 0;
              return a | 0;
            }
          case 228:
          case 196:
          case 164:
          case 132:
            {
              a = k[k[2263536 + (e << 2) >> 2] >> 2] | 0;
              return a | 0;
            }
          case 243:
          case 242:
          case 211:
          case 210:
          case 179:
          case 178:
          case 147:
          case 146:
            {
              e = k[2263536 + (e << 2) >> 2] | 0;
              d = ((b | -2) ^ 1) + (k[e >> 2] | 0) | 0;
              k[e >> 2] = d;
              e = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              e = (ec[k[556 >> 2] & 63](d + 1 & 65535) | 0) & 255 | e << 8;
              k[a >> 2] = (b & 1) + 5 + (k[a >> 2] | 0);
              a = e;
              return a | 0;
            }
          case 249:
          case 217:
          case 185:
          case 153:
            {
              e = k[k[2263536 + (e << 2) >> 2] >> 2] | 0;
              d = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              d = (ec[k[556 >> 2] & 63](c + 2 & 65535) | 0) & 255 | d << 8;
              k[223] = (k[223] | 0) + 2;
              d = d + e | 0;
              e = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              e = (ec[k[556 >> 2] & 63](d + 1 & 65535) | 0) & 255 | e << 8;
              k[a >> 2] = (k[a >> 2] | 0) + 7;
              a = e;
              return a | 0;
            }
          case 236:
          case 204:
          case 172:
          case 140:
            {
              d = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              e = (k[223] | 0) + 1 | 0;
              k[223] = e;
              k[a >> 2] = (k[a >> 2] | 0) + 1;
              a = (((d | -129) ^ 128) + 1 | d) + e | 0;
              return a | 0;
            }
          case 252:
          case 220:
          case 188:
          case 156:
            {
              e = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              d = (k[223] | 0) + 1 | 0;
              k[223] = d;
              d = (((e | -129) ^ 128) + 1 | e) + d | 0;
              e = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              e = (ec[k[556 >> 2] & 63](d + 1 & 65535) | 0) & 255 | e << 8;
              k[a >> 2] = (k[a >> 2] | 0) + 4;
              a = e;
              return a | 0;
            }
          case 237:
          case 205:
          case 173:
          case 141:
            {
              e = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              e = (ec[k[556 >> 2] & 63](c + 2 & 65535) | 0) & 255 | e << 8;
              d = (k[223] | 0) + 2 | 0;
              k[223] = d;
              k[a >> 2] = (k[a >> 2] | 0) + 5;
              a = d + e | 0;
              return a | 0;
            }
          case 253:
          case 221:
          case 189:
          case 157:
            {
              d = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              d = (ec[k[556 >> 2] & 63](c + 2 & 65535) | 0) & 255 | d << 8;
              e = (k[223] | 0) + 2 | 0;
              k[223] = e;
              d = e + d | 0;
              e = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              e = (ec[k[556 >> 2] & 63](d + 1 & 65535) | 0) & 255 | e << 8;
              k[a >> 2] = (k[a >> 2] | 0) + 8;
              a = e;
              return a | 0;
            }
          case 159:
            {
              d = (ec[k[556 >> 2] & 63](d & 65535) | 0) & 255;
              d = (ec[k[556 >> 2] & 63](c + 2 & 65535) | 0) & 255 | d << 8;
              k[223] = (k[223] | 0) + 2;
              e = (ec[k[556 >> 2] & 63](d) | 0) & 255;
              e = (ec[k[556 >> 2] & 63](d + 1 & 65535) | 0) & 255 | e << 8;
              k[a >> 2] = (k[a >> 2] | 0) + 5;
              a = e;
              return a | 0;
            }
          default:
            {
              xb(2590048) | 0;
              a = 0;
              return a | 0;
            }
        }
 while (0);
      return 0;
    }
    function td(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
          f = 0;
      if (a & 1) {
        e = (ec[k[556 >> 2] & 63](k[b >> 2] & 65535) | 0) & 255;
        k[b >> 2] = (k[b >> 2] | 0) + 1;
        k[227] = e;
        k[d >> 2] = (k[d >> 2] | 0) + 1;
      }
      if (a & 2) {
        e = (ec[k[556 >> 2] & 63](k[b >> 2] & 65535) | 0) & 255;
        k[b >> 2] = (k[b >> 2] | 0) + 1;
        k[224] = e;
        k[d >> 2] = (k[d >> 2] | 0) + 1;
      }
      if (a & 4) {
        e = (ec[k[556 >> 2] & 63](k[b >> 2] & 65535) | 0) & 255;
        k[b >> 2] = (k[b >> 2] | 0) + 1;
        k[225] = e;
        k[d >> 2] = (k[d >> 2] | 0) + 1;
      }
      if (a & 8) {
        e = (ec[k[556 >> 2] & 63](k[b >> 2] & 65535) | 0) & 255;
        k[b >> 2] = (k[b >> 2] | 0) + 1;
        k[226] = e;
        k[d >> 2] = (k[d >> 2] | 0) + 1;
      }
      if (a & 16) {
        e = (ec[k[556 >> 2] & 63](k[b >> 2] & 65535) | 0) & 255;
        f = (k[b >> 2] | 0) + 1 | 0;
        k[b >> 2] = f;
        f = (ec[k[556 >> 2] & 63](f & 65535) | 0) & 255;
        k[b >> 2] = (k[b >> 2] | 0) + 1;
        k[219] = f | e << 8;
        k[d >> 2] = (k[d >> 2] | 0) + 2;
      }
      if (a & 32) {
        f = (ec[k[556 >> 2] & 63](k[b >> 2] & 65535) | 0) & 255;
        e = (k[b >> 2] | 0) + 1 | 0;
        k[b >> 2] = e;
        e = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
        k[b >> 2] = (k[b >> 2] | 0) + 1;
        k[220] = e | f << 8;
        k[d >> 2] = (k[d >> 2] | 0) + 2;
      }
      if (a & 64) {
        f = (ec[k[556 >> 2] & 63](k[b >> 2] & 65535) | 0) & 255;
        e = (k[b >> 2] | 0) + 1 | 0;
        k[b >> 2] = e;
        e = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
        k[b >> 2] = (k[b >> 2] | 0) + 1;
        k[c >> 2] = e | f << 8;
        k[d >> 2] = (k[d >> 2] | 0) + 2;
      }
      if (!(a & 128))
        return ;
      f = (ec[k[556 >> 2] & 63](k[b >> 2] & 65535) | 0) & 255;
      e = (k[b >> 2] | 0) + 1 | 0;
      k[b >> 2] = e;
      e = (ec[k[556 >> 2] & 63](e & 65535) | 0) & 255;
      k[b >> 2] = (k[b >> 2] | 0) + 1;
      k[223] = e | f << 8;
      k[d >> 2] = (k[d >> 2] | 0) + 2;
      return ;
    }
    function ud(a, b, c, d, e) {
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
          m = 0;
      j = 2001452 + (((((((((a * 31 | 0) + b | 0) * 31 | 0) + c | 0) * 31 | 0) + d | 0) >>> 0) % 65521 | 0) << 2) | 0;
      l = k[j >> 2] | 0;
      m = (l | 0) > -1;
      f = k[199] | 0;
      if ((((m & (l | 0) < (f | 0) ? (g = k[217] | 0, (k[g + (l * 20 | 0) >> 2] | 0) == (a | 0)) : 0) ? (k[g + (l * 20 | 0) + 4 >> 2] | 0) == (b | 0) : 0) ? (k[g + (l * 20 | 0) + 8 >> 2] | 0) == (c | 0) : 0) ? (k[g + (l * 20 | 0) + 12 >> 2] | 0) == (d | 0) : 0) {
        i[g + (l * 20 | 0) + 16 >> 0] = e;
        return ;
      }
      if ((((m & (l | 0) < (k[200] | 0) ? (h = k[218] | 0, (k[h + (l * 20 | 0) >> 2] | 0) == (a | 0)) : 0) ? (k[h + (l * 20 | 0) + 4 >> 2] | 0) == (b | 0) : 0) ? (k[h + (l * 20 | 0) + 8 >> 2] | 0) == (c | 0) : 0) ? (k[h + (l * 20 | 0) + 12 >> 2] | 0) == (d | 0) : 0)
        i[h + (l * 20 | 0) + 16 >> 0] = -128;
      m = k[217] | 0;
      k[m + (f * 20 | 0) >> 2] = a;
      k[m + ((k[199] | 0) * 20 | 0) + 4 >> 2] = b;
      k[m + ((k[199] | 0) * 20 | 0) + 8 >> 2] = c;
      k[m + ((k[199] | 0) * 20 | 0) + 12 >> 2] = d;
      d = k[199] | 0;
      i[m + (d * 20 | 0) + 16 >> 0] = e;
      k[j >> 2] = d;
      k[199] = d + 1;
      return ;
    }
    function vd(a) {
      a = a | 0;
      return yd(k[a + 4 >> 2] | 0) | 0;
    }
    function wd(a) {
      a = a | 0;
      Wa(352, 2590068);
      jb(384, 2590073, 1, 1, 0);
      Sa(392, 2590078, 1, -128, 127);
      Sa(408, 2590083, 1, -128, 127);
      Sa(400, 2590095, 1, 0, 255);
      Sa(416, 2590109, 2, -32768, 32767);
      Sa(424, 2590115, 2, 0, 65535);
      Sa(432, 2590130, 4, -2147483648, 2147483647);
      Sa(440, 2590134, 4, 0, -1);
      Sa(448, 2590147, 4, -2147483648, 2147483647);
      Sa(456, 2590152, 4, 0, -1);
      zb(464, 2590166, 4);
      zb(472, 2590172, 8);
      nb(80, 2590179);
      nb(104, 2590191);
      gb(128, 4, 2590224);
      pb(152, 2590237);
      Na(160, 0, 2590253);
      Na(168, 0, 2590283);
      Na(176, 1, 2590320);
      Na(184, 2, 2590359);
      Na(192, 3, 2590390);
      Na(200, 4, 2590430);
      Na(208, 5, 2590459);
      Na(216, 4, 2590497);
      Na(224, 5, 2590527);
      Na(168, 0, 2590566);
      Na(176, 1, 2590598);
      Na(184, 2, 2590631);
      Na(192, 3, 2590664);
      Na(200, 4, 2590698);
      Na(208, 5, 2590731);
      Na(232, 6, 2590765);
      Na(240, 7, 2590796);
      Na(248, 7, 2590828);
      return ;
    }
    function xd() {
      wd(0);
      return ;
    }
    function yd(a) {
      a = a | 0;
      var b = 0,
          c = 0;
      b = (ee(a | 0) | 0) + 1 | 0;
      c = be(b) | 0;
      if (!c) {
        a = 0;
        return a | 0;
      }
      ge(c | 0, a | 0, b | 0) | 0;
      a = c;
      return a | 0;
    }
    function zd(a) {
      a = a | 0;
      ce(a);
      return ;
    }
    function Ad(a) {
      a = a | 0;
      return ;
    }
    function Bd(a) {
      a = a | 0;
      return ;
    }
    function Cd(a) {
      a = a | 0;
      return ;
    }
    function Dd(a) {
      a = a | 0;
      return ;
    }
    function Ed(a) {
      a = a | 0;
      zd(a);
      return ;
    }
    function Fd(a) {
      a = a | 0;
      zd(a);
      return ;
    }
    function Gd(a) {
      a = a | 0;
      zd(a);
      return ;
    }
    function Hd(a) {
      a = a | 0;
      zd(a);
      return ;
    }
    function Id(a) {
      a = a | 0;
      zd(a);
      return ;
    }
    function Jd(a) {
      a = a | 0;
      zd(a);
      return ;
    }
    function Kd(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return (a | 0) == (b | 0) | 0;
    }
    function Ld(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return (a | 0) == (b | 0) | 0;
    }
    function Md(a, b, c) {
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
        if ((b | 0) != 0 ? (e = Td(b, 272, 288, 0) | 0, (e | 0) != 0) : 0) {
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
          kc[k[(k[e >> 2] | 0) + 28 >> 2] & 63](e, f, k[c >> 2] | 0, 1);
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
    function Nd(a, b, c, d) {
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
    function Od(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      if ((a | 0) == (k[b + 8 >> 2] | 0))
        Nd(0, b, c, d);
      return ;
    }
    function Pd(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      if ((a | 0) == (k[b + 8 >> 2] | 0))
        Nd(0, b, c, d);
      else {
        a = k[a + 8 >> 2] | 0;
        kc[k[(k[a >> 2] | 0) + 28 >> 2] & 63](a, b, c, d);
      }
      return ;
    }
    function Qd(a, b, c, d) {
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
      kc[k[(k[a >> 2] | 0) + 28 >> 2] & 63](a, b, c + e | 0, (f & 2 | 0) != 0 ? d : 2);
      return ;
    }
    function Rd(a, b, c, d) {
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
          Qd(a + 16 | 0, b, c, d);
          if ((f | 0) > 1) {
            f = b + 54 | 0;
            a = a + 24 | 0;
            do {
              Qd(a, b, c, d);
              if (i[f >> 0] | 0)
                break a;
              a = a + 8 | 0;
            } while (a >>> 0 < e >>> 0);
          }
        } else
          Nd(0, b, c, d);
 while (0);
      return ;
    }
    function Sd(a, b, c) {
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
      if (!((a | 0) == (b | 0) | (b | 0) == 376))
        if (((b | 0) != 0 ? (d = Td(b, 272, 320, 0) | 0, (d | 0) != 0) : 0) ? (k[d + 8 >> 2] & ~k[a + 8 >> 2] | 0) == 0 : 0) {
          b = k[a + 12 >> 2] | 0;
          a = d + 12 | 0;
          if (!((b | 0) == 352 ? 1 : (b | 0) == (k[a >> 2] | 0)))
            if ((((b | 0) != 0 ? (f = Td(b, 272, 288, 0) | 0, (f | 0) != 0) : 0) ? (e = k[a >> 2] | 0, (e | 0) != 0) : 0) ? (g = Td(e, 272, 288, 0) | 0, (g | 0) != 0) : 0) {
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
              kc[k[(k[g >> 2] | 0) + 28 >> 2] & 63](g, h, k[c >> 2] | 0, 1);
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
    function Td(a, b, c, d) {
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
          ic[k[(k[c >> 2] | 0) + 20 >> 2] & 63](c, p, n, n, 1, 0);
          d = (k[d >> 2] | 0) == 1 ? n : 0;
        } else {
          ac[k[(k[o >> 2] | 0) + 24 >> 2] & 63](o, p, n, 1, 0);
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
    function Ud(a, b, c, d, e) {
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
            e = b + 36 | 0;
            k[e >> 2] = (k[e >> 2] | 0) + 1;
            i[b + 54 >> 0] = 1;
            break;
          }
          d = b + 24 | 0;
          a = k[d >> 2] | 0;
          if ((a | 0) == 2) {
            k[d >> 2] = e;
            a = e;
          }
          if ((a | 0) == 1 ? (k[b + 48 >> 2] | 0) == 1 : 0)
            i[b + 54 >> 0] = 1;
        }
 while (0);
      return ;
    }
    function Vd(a, b, c, d, e) {
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
            Xd(a + 16 | 0, b, c, d, e);
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
                  Xd(f, b, c, d, e);
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
                Xd(f, b, c, d, e);
                f = f + 8 | 0;
                if (f >>> 0 >= j >>> 0)
                  break a;
              }
            }
            g = b + 54 | 0;
            while (1) {
              if (i[g >> 0] | 0)
                break a;
              Xd(f, b, c, d, e);
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
                  Wd(l, b, c, c, 1, e);
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
    function Wd(a, b, c, d, e, f) {
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
      ic[k[(k[a >> 2] | 0) + 20 >> 2] & 63](a, b, c, d + g | 0, (h & 2 | 0) != 0 ? e : 2, f);
      return ;
    }
    function Xd(a, b, c, d, e) {
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
      ac[k[(k[a >> 2] | 0) + 24 >> 2] & 63](a, b, c + f | 0, (g & 2 | 0) != 0 ? d : 2, e);
      return ;
    }
    function Yd(a, b, c, d, e) {
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
            ac[k[(k[h >> 2] | 0) + 24 >> 2] & 63](h, b, c, d, e);
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
            ic[k[(k[a >> 2] | 0) + 20 >> 2] & 63](a, b, c, c, 1, e);
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
    function Zd(a, b, c, d, e) {
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
    function _d(a, b, c, d, e, f) {
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
        Ud(0, b, c, d, e);
      else {
        m = b + 52 | 0;
        n = i[m >> 0] | 0;
        o = b + 53 | 0;
        p = i[o >> 0] | 0;
        l = k[a + 12 >> 2] | 0;
        g = a + 16 + (l << 3) | 0;
        i[m >> 0] = 0;
        i[o >> 0] = 0;
        Wd(a + 16 | 0, b, c, d, e, f);
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
              Wd(a, b, c, d, e, f);
              a = a + 8 | 0;
            } while (a >>> 0 < g >>> 0);
          }
 while (0);
        i[m >> 0] = n;
        i[o >> 0] = p;
      }
      return ;
    }
    function $d(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      if ((a | 0) == (k[b + 8 >> 2] | 0))
        Ud(0, b, c, d, e);
      else {
        a = k[a + 8 >> 2] | 0;
        ic[k[(k[a >> 2] | 0) + 20 >> 2] & 63](a, b, c, d, e, f);
      }
      return ;
    }
    function ae(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      if ((a | 0) == (k[b + 8 >> 2] | 0))
        Ud(0, b, c, d, e);
      return ;
    }
    function be(a) {
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
          l = k[565939] | 0;
          i = l >>> a;
          if (i & 3) {
            d = (i & 1 ^ 1) + a | 0;
            e = d << 1;
            b = 2263796 + (e << 2) | 0;
            e = 2263796 + (e + 2 << 2) | 0;
            f = k[e >> 2] | 0;
            g = f + 8 | 0;
            h = k[g >> 2] | 0;
            do
              if ((b | 0) != (h | 0)) {
                if (h >>> 0 < (k[565943] | 0) >>> 0)
                  Mb();
                c = h + 12 | 0;
                if ((k[c >> 2] | 0) == (f | 0)) {
                  k[c >> 2] = b;
                  k[e >> 2] = h;
                  break;
                } else
                  Mb();
              } else
                k[565939] = l & ~(1 << d);
 while (0);
            N = d << 3;
            k[f + 4 >> 2] = N | 3;
            N = f + (N | 4) | 0;
            k[N >> 2] = k[N >> 2] | 1;
            N = g;
            return N | 0;
          }
          b = k[565941] | 0;
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
              f = 2263796 + (e << 2) | 0;
              e = 2263796 + (e + 2 << 2) | 0;
              c = k[e >> 2] | 0;
              a = c + 8 | 0;
              d = k[a >> 2] | 0;
              do
                if ((f | 0) != (d | 0)) {
                  if (d >>> 0 < (k[565943] | 0) >>> 0)
                    Mb();
                  h = d + 12 | 0;
                  if ((k[h >> 2] | 0) == (c | 0)) {
                    k[h >> 2] = f;
                    k[e >> 2] = d;
                    j = k[565941] | 0;
                    break;
                  } else
                    Mb();
                } else {
                  k[565939] = l & ~(1 << g);
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
                d = k[565944] | 0;
                f = j >>> 3;
                h = f << 1;
                e = 2263796 + (h << 2) | 0;
                g = k[565939] | 0;
                f = 1 << f;
                if (g & f) {
                  g = 2263796 + (h + 2 << 2) | 0;
                  h = k[g >> 2] | 0;
                  if (h >>> 0 < (k[565943] | 0) >>> 0)
                    Mb();
                  else {
                    m = g;
                    n = h;
                  }
                } else {
                  k[565939] = g | f;
                  m = 2263796 + (h + 2 << 2) | 0;
                  n = e;
                }
                k[m >> 2] = d;
                k[n + 12 >> 2] = d;
                k[d + 8 >> 2] = n;
                k[d + 12 >> 2] = e;
              }
              k[565941] = b;
              k[565944] = i;
              N = a;
              return N | 0;
            }
            a = k[565940] | 0;
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
              f = k[2264060 + ((L | M | N | h | f) + (g >>> f) << 2) >> 2] | 0;
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
              a = k[565943] | 0;
              if (j >>> 0 < a >>> 0)
                Mb();
              b = j + q | 0;
              if (j >>> 0 >= b >>> 0)
                Mb();
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
                    Mb();
                  else {
                    k[g >> 2] = 0;
                    d = h;
                    break;
                  }
                } else {
                  e = k[j + 8 >> 2] | 0;
                  if (e >>> 0 < a >>> 0)
                    Mb();
                  h = e + 12 | 0;
                  if ((k[h >> 2] | 0) != (j | 0))
                    Mb();
                  g = f + 8 | 0;
                  if ((k[g >> 2] | 0) == (j | 0)) {
                    k[h >> 2] = f;
                    k[g >> 2] = e;
                    d = f;
                    break;
                  } else
                    Mb();
                }
 while (0);
              do
                if (i) {
                  h = k[j + 28 >> 2] | 0;
                  g = 2264060 + (h << 2) | 0;
                  if ((j | 0) == (k[g >> 2] | 0)) {
                    k[g >> 2] = d;
                    if (!d) {
                      k[565940] = k[565940] & ~(1 << h);
                      break;
                    }
                  } else {
                    if (i >>> 0 < (k[565943] | 0) >>> 0)
                      Mb();
                    h = i + 16 | 0;
                    if ((k[h >> 2] | 0) == (j | 0))
                      k[h >> 2] = d;
                    else
                      k[i + 20 >> 2] = d;
                    if (!d)
                      break;
                  }
                  g = k[565943] | 0;
                  if (d >>> 0 < g >>> 0)
                    Mb();
                  k[d + 24 >> 2] = i;
                  h = k[j + 16 >> 2] | 0;
                  do
                    if (h)
                      if (h >>> 0 < g >>> 0)
                        Mb();
                      else {
                        k[d + 16 >> 2] = h;
                        k[h + 24 >> 2] = d;
                        break;
                      }
 while (0);
                  h = k[j + 20 >> 2] | 0;
                  if (h)
                    if (h >>> 0 < (k[565943] | 0) >>> 0)
                      Mb();
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
                c = k[565941] | 0;
                if (c) {
                  d = k[565944] | 0;
                  f = c >>> 3;
                  h = f << 1;
                  e = 2263796 + (h << 2) | 0;
                  g = k[565939] | 0;
                  f = 1 << f;
                  if (g & f) {
                    h = 2263796 + (h + 2 << 2) | 0;
                    g = k[h >> 2] | 0;
                    if (g >>> 0 < (k[565943] | 0) >>> 0)
                      Mb();
                    else {
                      p = h;
                      o = g;
                    }
                  } else {
                    k[565939] = g | f;
                    p = 2263796 + (h + 2 << 2) | 0;
                    o = e;
                  }
                  k[p >> 2] = d;
                  k[o + 12 >> 2] = d;
                  k[d + 8 >> 2] = o;
                  k[d + 12 >> 2] = e;
                }
                k[565941] = l;
                k[565944] = b;
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
          j = k[565940] | 0;
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
            a = k[2264060 + (l << 2) >> 2] | 0;
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
                g = k[2264060 + ((m | n | o | q | g) + (a >>> g) << 2) >> 2] | 0;
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
            if ((q | 0) != 0 ? n >>> 0 < ((k[565941] | 0) - p | 0) >>> 0 : 0) {
              a = k[565943] | 0;
              if (q >>> 0 < a >>> 0)
                Mb();
              m = q + p | 0;
              if (q >>> 0 >= m >>> 0)
                Mb();
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
                    Mb();
                  else {
                    k[g >> 2] = 0;
                    s = h;
                    break;
                  }
                } else {
                  e = k[q + 8 >> 2] | 0;
                  if (e >>> 0 < a >>> 0)
                    Mb();
                  h = e + 12 | 0;
                  if ((k[h >> 2] | 0) != (q | 0))
                    Mb();
                  g = f + 8 | 0;
                  if ((k[g >> 2] | 0) == (q | 0)) {
                    k[h >> 2] = f;
                    k[g >> 2] = e;
                    s = f;
                    break;
                  } else
                    Mb();
                }
 while (0);
              do
                if (i) {
                  h = k[q + 28 >> 2] | 0;
                  g = 2264060 + (h << 2) | 0;
                  if ((q | 0) == (k[g >> 2] | 0)) {
                    k[g >> 2] = s;
                    if (!s) {
                      k[565940] = k[565940] & ~(1 << h);
                      break;
                    }
                  } else {
                    if (i >>> 0 < (k[565943] | 0) >>> 0)
                      Mb();
                    h = i + 16 | 0;
                    if ((k[h >> 2] | 0) == (q | 0))
                      k[h >> 2] = s;
                    else
                      k[i + 20 >> 2] = s;
                    if (!s)
                      break;
                  }
                  g = k[565943] | 0;
                  if (s >>> 0 < g >>> 0)
                    Mb();
                  k[s + 24 >> 2] = i;
                  h = k[q + 16 >> 2] | 0;
                  do
                    if (h)
                      if (h >>> 0 < g >>> 0)
                        Mb();
                      else {
                        k[s + 16 >> 2] = h;
                        k[h + 24 >> 2] = s;
                        break;
                      }
 while (0);
                  h = k[q + 20 >> 2] | 0;
                  if (h)
                    if (h >>> 0 < (k[565943] | 0) >>> 0)
                      Mb();
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
                    e = 2263796 + (g << 2) | 0;
                    f = k[565939] | 0;
                    h = 1 << h;
                    if (f & h) {
                      h = 2263796 + (g + 2 << 2) | 0;
                      g = k[h >> 2] | 0;
                      if (g >>> 0 < (k[565943] | 0) >>> 0)
                        Mb();
                      else {
                        t = h;
                        u = g;
                      }
                    } else {
                      k[565939] = f | h;
                      t = 2263796 + (g + 2 << 2) | 0;
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
                  h = 2264060 + (e << 2) | 0;
                  k[q + (p + 28) >> 2] = e;
                  k[q + (p + 20) >> 2] = 0;
                  k[q + (p + 16) >> 2] = 0;
                  g = k[565940] | 0;
                  f = 1 << e;
                  if (!(g & f)) {
                    k[565940] = g | f;
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
                      if (b >>> 0 < (k[565943] | 0) >>> 0)
                        Mb();
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
                  N = k[565943] | 0;
                  if (b >>> 0 >= N >>> 0 & z >>> 0 >= N >>> 0) {
                    k[b + 12 >> 2] = m;
                    k[c >> 2] = m;
                    k[q + (p + 8) >> 2] = b;
                    k[q + (p + 12) >> 2] = z;
                    k[q + (p + 24) >> 2] = 0;
                    break;
                  } else
                    Mb();
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
      a = k[565941] | 0;
      if (a >>> 0 >= z >>> 0) {
        b = a - z | 0;
        c = k[565944] | 0;
        if (b >>> 0 > 15) {
          k[565944] = c + z;
          k[565941] = b;
          k[c + (z + 4) >> 2] = b | 1;
          k[c + a >> 2] = b;
          k[c + 4 >> 2] = z | 3;
        } else {
          k[565941] = 0;
          k[565944] = 0;
          k[c + 4 >> 2] = a | 3;
          N = c + (a + 4) | 0;
          k[N >> 2] = k[N >> 2] | 1;
        }
        N = c + 8 | 0;
        return N | 0;
      }
      a = k[565942] | 0;
      if (a >>> 0 > z >>> 0) {
        M = a - z | 0;
        k[565942] = M;
        N = k[565945] | 0;
        k[565945] = N + z;
        k[N + (z + 4) >> 2] = M | 1;
        k[N + 4 >> 2] = z | 3;
        N = N + 8 | 0;
        return N | 0;
      }
      do
        if (!(k[566057] | 0)) {
          a = kb(30) | 0;
          if (!(a + -1 & a)) {
            k[566059] = a;
            k[566058] = a;
            k[566060] = -1;
            k[566061] = -1;
            k[566062] = 0;
            k[566050] = 0;
            u = (Qb(0) | 0) & -16 ^ 1431655768;
            k[566057] = u;
            break;
          } else
            Mb();
        }
 while (0);
      l = z + 48 | 0;
      c = k[566059] | 0;
      j = z + 47 | 0;
      d = c + j | 0;
      c = 0 - c | 0;
      m = d & c;
      if (m >>> 0 <= z >>> 0) {
        N = 0;
        return N | 0;
      }
      a = k[566049] | 0;
      if ((a | 0) != 0 ? (t = k[566047] | 0, u = t + m | 0, u >>> 0 <= t >>> 0 | u >>> 0 > a >>> 0) : 0) {
        N = 0;
        return N | 0;
      }
      d: do
        if (!(k[566050] & 4)) {
          a = k[565945] | 0;
          e: do
            if (a) {
              g = 2264204;
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
              i = d - (k[565942] | 0) & c;
              if (i >>> 0 < 2147483647) {
                g = fb(i | 0) | 0;
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
              f = fb(0) | 0;
              if ((f | 0) != (-1 | 0)) {
                a = f;
                i = k[566058] | 0;
                g = i + -1 | 0;
                if (!(g & a))
                  i = m;
                else
                  i = m - a + (g + a & 0 - i) | 0;
                a = k[566047] | 0;
                g = a + i | 0;
                if (i >>> 0 > z >>> 0 & i >>> 0 < 2147483647) {
                  u = k[566049] | 0;
                  if ((u | 0) != 0 ? g >>> 0 <= a >>> 0 | g >>> 0 > u >>> 0 : 0) {
                    a = 0;
                    break;
                  }
                  g = fb(i | 0) | 0;
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
                if (l >>> 0 > i >>> 0 & (i >>> 0 < 2147483647 & (g | 0) != (-1 | 0)) ? (v = k[566059] | 0, v = j - i + v & 0 - v, v >>> 0 < 2147483647) : 0)
                  if ((fb(v | 0) | 0) == (-1 | 0)) {
                    fb(f | 0) | 0;
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
          k[566050] = k[566050] | 4;
          w = 191;
        } else {
          a = 0;
          w = 191;
        }
 while (0);
      if ((((w | 0) == 191 ? m >>> 0 < 2147483647 : 0) ? (x = fb(m | 0) | 0, y = fb(0) | 0, x >>> 0 < y >>> 0 & ((x | 0) != (-1 | 0) & (y | 0) != (-1 | 0))) : 0) ? (A = y - x | 0, B = A >>> 0 > (z + 40 | 0) >>> 0, B) : 0) {
        a = B ? A : a;
        w = 194;
      }
      if ((w | 0) == 194) {
        i = (k[566047] | 0) + a | 0;
        k[566047] = i;
        if (i >>> 0 > (k[566048] | 0) >>> 0)
          k[566048] = i;
        n = k[565945] | 0;
        g: do
          if (n) {
            d = 2264204;
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
              N = (k[565942] | 0) + a | 0;
              M = n + 8 | 0;
              M = (M & 7 | 0) == 0 ? 0 : 0 - M & 7;
              L = N - M | 0;
              k[565945] = n + M;
              k[565942] = L;
              k[n + (M + 4) >> 2] = L | 1;
              k[n + (N + 4) >> 2] = 40;
              k[565946] = k[566061];
              break;
            }
            i = k[565943] | 0;
            if (x >>> 0 < i >>> 0) {
              k[565943] = x;
              i = x;
            }
            g = x + a | 0;
            d = 2264204;
            while (1) {
              if ((k[d >> 2] | 0) == (g | 0)) {
                f = d;
                g = d;
                w = 212;
                break;
              }
              d = k[d + 8 >> 2] | 0;
              if (!d) {
                f = 2264204;
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
                    if ((h | 0) == (k[565944] | 0)) {
                      N = (k[565941] | 0) + m | 0;
                      k[565941] = N;
                      k[565944] = q;
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
                                Mb();
                              else {
                                k[f >> 2] = 0;
                                K = g;
                                break;
                              }
                            } else {
                              e = k[x + ((b | 8) + a) >> 2] | 0;
                              if (e >>> 0 < i >>> 0)
                                Mb();
                              i = e + 12 | 0;
                              if ((k[i >> 2] | 0) != (h | 0))
                                Mb();
                              g = f + 8 | 0;
                              if ((k[g >> 2] | 0) == (h | 0)) {
                                k[i >> 2] = f;
                                k[g >> 2] = e;
                                K = f;
                                break;
                              } else
                                Mb();
                            }
 while (0);
                          if (!c)
                            break;
                          i = k[x + (a + 28 + b) >> 2] | 0;
                          g = 2264060 + (i << 2) | 0;
                          do
                            if ((h | 0) != (k[g >> 2] | 0)) {
                              if (c >>> 0 < (k[565943] | 0) >>> 0)
                                Mb();
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
                              k[565940] = k[565940] & ~(1 << i);
                              break i;
                            }
 while (0);
                          g = k[565943] | 0;
                          if (K >>> 0 < g >>> 0)
                            Mb();
                          k[K + 24 >> 2] = c;
                          i = b | 16;
                          h = k[x + (i + a) >> 2] | 0;
                          do
                            if (h)
                              if (h >>> 0 < g >>> 0)
                                Mb();
                              else {
                                k[K + 16 >> 2] = h;
                                k[h + 24 >> 2] = K;
                                break;
                              }
 while (0);
                          h = k[x + (l + i) >> 2] | 0;
                          if (!h)
                            break;
                          if (h >>> 0 < (k[565943] | 0) >>> 0)
                            Mb();
                          else {
                            k[K + 20 >> 2] = h;
                            k[h + 24 >> 2] = K;
                            break;
                          }
                        } else {
                          f = k[x + ((b | 8) + a) >> 2] | 0;
                          e = k[x + (a + 12 + b) >> 2] | 0;
                          g = 2263796 + (d << 1 << 2) | 0;
                          do
                            if ((f | 0) != (g | 0)) {
                              if (f >>> 0 < i >>> 0)
                                Mb();
                              if ((k[f + 12 >> 2] | 0) == (h | 0))
                                break;
                              Mb();
                            }
 while (0);
                          if ((e | 0) == (f | 0)) {
                            k[565939] = k[565939] & ~(1 << d);
                            break;
                          }
                          do
                            if ((e | 0) == (g | 0))
                              G = e + 8 | 0;
                            else {
                              if (e >>> 0 < i >>> 0)
                                Mb();
                              i = e + 8 | 0;
                              if ((k[i >> 2] | 0) == (h | 0)) {
                                G = i;
                                break;
                              }
                              Mb();
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
                      e = 2263796 + (g << 2) | 0;
                      f = k[565939] | 0;
                      h = 1 << h;
                      do
                        if (!(f & h)) {
                          k[565939] = f | h;
                          L = 2263796 + (g + 2 << 2) | 0;
                          M = e;
                        } else {
                          h = 2263796 + (g + 2 << 2) | 0;
                          g = k[h >> 2] | 0;
                          if (g >>> 0 >= (k[565943] | 0) >>> 0) {
                            L = h;
                            M = g;
                            break;
                          }
                          Mb();
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
                    h = 2264060 + (e << 2) | 0;
                    k[x + (o + 28) >> 2] = e;
                    k[x + (o + 20) >> 2] = 0;
                    k[x + (o + 16) >> 2] = 0;
                    g = k[565940] | 0;
                    f = 1 << e;
                    if (!(g & f)) {
                      k[565940] = g | f;
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
                        if (b >>> 0 < (k[565943] | 0) >>> 0)
                          Mb();
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
                    M = k[565943] | 0;
                    if (b >>> 0 >= M >>> 0 & N >>> 0 >= M >>> 0) {
                      k[b + 12 >> 2] = q;
                      k[c >> 2] = q;
                      k[x + (o + 8) >> 2] = b;
                      k[x + (o + 12) >> 2] = N;
                      k[x + (o + 24) >> 2] = 0;
                      break;
                    } else
                      Mb();
                  } else {
                    N = (k[565942] | 0) + m | 0;
                    k[565942] = N;
                    k[565945] = q;
                    k[x + (o + 4) >> 2] = N | 1;
                  }
 while (0);
                N = x + (p | 8) | 0;
                return N | 0;
              } else
                f = 2264204;
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
            k[565945] = x + f;
            k[565942] = N;
            k[x + (f + 4) >> 2] = N | 1;
            k[x + (a + -36) >> 2] = 40;
            k[565946] = k[566061];
            f = g + 4 | 0;
            k[f >> 2] = 27;
            k[h >> 2] = k[566051];
            k[h + 4 >> 2] = k[566052];
            k[h + 8 >> 2] = k[566053];
            k[h + 12 >> 2] = k[566054];
            k[566051] = x;
            k[566052] = a;
            k[566054] = 0;
            k[566053] = h;
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
                e = 2263796 + (g << 2) | 0;
                f = k[565939] | 0;
                h = 1 << h;
                if (f & h) {
                  c = 2263796 + (g + 2 << 2) | 0;
                  b = k[c >> 2] | 0;
                  if (b >>> 0 < (k[565943] | 0) >>> 0)
                    Mb();
                  else {
                    H = c;
                    I = b;
                  }
                } else {
                  k[565939] = f | h;
                  H = 2263796 + (g + 2 << 2) | 0;
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
              h = 2264060 + (g << 2) | 0;
              k[n + 28 >> 2] = g;
              k[n + 20 >> 2] = 0;
              k[i >> 2] = 0;
              c = k[565940] | 0;
              b = 1 << g;
              if (!(c & b)) {
                k[565940] = c | b;
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
                  if (b >>> 0 < (k[565943] | 0) >>> 0)
                    Mb();
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
              N = k[565943] | 0;
              if (b >>> 0 >= N >>> 0 & J >>> 0 >= N >>> 0) {
                k[b + 12 >> 2] = n;
                k[c >> 2] = n;
                k[n + 8 >> 2] = b;
                k[n + 12 >> 2] = J;
                k[n + 24 >> 2] = 0;
                break;
              } else
                Mb();
            }
          } else {
            N = k[565943] | 0;
            if ((N | 0) == 0 | x >>> 0 < N >>> 0)
              k[565943] = x;
            k[566051] = x;
            k[566052] = a;
            k[566054] = 0;
            k[565948] = k[566057];
            k[565947] = -1;
            c = 0;
            do {
              N = c << 1;
              M = 2263796 + (N << 2) | 0;
              k[2263796 + (N + 3 << 2) >> 2] = M;
              k[2263796 + (N + 2 << 2) >> 2] = M;
              c = c + 1 | 0;
            } while ((c | 0) != 32);
            N = x + 8 | 0;
            N = (N & 7 | 0) == 0 ? 0 : 0 - N & 7;
            M = a + -40 - N | 0;
            k[565945] = x + N;
            k[565942] = M;
            k[x + (N + 4) >> 2] = M | 1;
            k[x + (a + -36) >> 2] = 40;
            k[565946] = k[566061];
          }
 while (0);
        b = k[565942] | 0;
        if (b >>> 0 > z >>> 0) {
          M = b - z | 0;
          k[565942] = M;
          N = k[565945] | 0;
          k[565945] = N + z;
          k[N + (z + 4) >> 2] = M | 1;
          k[N + 4 >> 2] = z | 3;
          N = N + 8 | 0;
          return N | 0;
        }
      }
      N = Hb() | 0;
      k[N >> 2] = 12;
      N = 0;
      return N | 0;
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
      g = k[565943] | 0;
      if (f >>> 0 < g >>> 0)
        Mb();
      e = k[a + -4 >> 2] | 0;
      d = e & 3;
      if ((d | 0) == 1)
        Mb();
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
            Mb();
          if ((l | 0) == (k[565944] | 0)) {
            f = a + (o + -4) | 0;
            e = k[f >> 2] | 0;
            if ((e & 3 | 0) != 3) {
              u = l;
              j = m;
              break;
            }
            k[565941] = m;
            k[f >> 2] = e & -2;
            k[a + (h + 4) >> 2] = m | 1;
            k[q >> 2] = m;
            return ;
          }
          c = f >>> 3;
          if (f >>> 0 < 256) {
            d = k[a + (h + 8) >> 2] | 0;
            e = k[a + (h + 12) >> 2] | 0;
            f = 2263796 + (c << 1 << 2) | 0;
            if ((d | 0) != (f | 0)) {
              if (d >>> 0 < g >>> 0)
                Mb();
              if ((k[d + 12 >> 2] | 0) != (l | 0))
                Mb();
            }
            if ((e | 0) == (d | 0)) {
              k[565939] = k[565939] & ~(1 << c);
              u = l;
              j = m;
              break;
            }
            if ((e | 0) != (f | 0)) {
              if (e >>> 0 < g >>> 0)
                Mb();
              f = e + 8 | 0;
              if ((k[f >> 2] | 0) == (l | 0))
                b = f;
              else
                Mb();
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
                Mb();
              else {
                k[e >> 2] = 0;
                i = f;
                break;
              }
            } else {
              c = k[a + (h + 8) >> 2] | 0;
              if (c >>> 0 < g >>> 0)
                Mb();
              f = c + 12 | 0;
              if ((k[f >> 2] | 0) != (l | 0))
                Mb();
              e = d + 8 | 0;
              if ((k[e >> 2] | 0) == (l | 0)) {
                k[f >> 2] = d;
                k[e >> 2] = c;
                i = d;
                break;
              } else
                Mb();
            }
 while (0);
          if (b) {
            f = k[a + (h + 28) >> 2] | 0;
            e = 2264060 + (f << 2) | 0;
            if ((l | 0) == (k[e >> 2] | 0)) {
              k[e >> 2] = i;
              if (!i) {
                k[565940] = k[565940] & ~(1 << f);
                u = l;
                j = m;
                break;
              }
            } else {
              if (b >>> 0 < (k[565943] | 0) >>> 0)
                Mb();
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
            e = k[565943] | 0;
            if (i >>> 0 < e >>> 0)
              Mb();
            k[i + 24 >> 2] = b;
            f = k[a + (h + 16) >> 2] | 0;
            do
              if (f)
                if (f >>> 0 < e >>> 0)
                  Mb();
                else {
                  k[i + 16 >> 2] = f;
                  k[f + 24 >> 2] = i;
                  break;
                }
 while (0);
            f = k[a + (h + 20) >> 2] | 0;
            if (f)
              if (f >>> 0 < (k[565943] | 0) >>> 0)
                Mb();
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
        Mb();
      f = a + (o + -4) | 0;
      e = k[f >> 2] | 0;
      if (!(e & 1))
        Mb();
      if (!(e & 2)) {
        if ((q | 0) == (k[565945] | 0)) {
          t = (k[565942] | 0) + j | 0;
          k[565942] = t;
          k[565945] = u;
          k[u + 4 >> 2] = t | 1;
          if ((u | 0) != (k[565944] | 0))
            return ;
          k[565944] = 0;
          k[565941] = 0;
          return ;
        }
        if ((q | 0) == (k[565944] | 0)) {
          t = (k[565941] | 0) + j | 0;
          k[565941] = t;
          k[565944] = u;
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
                if (e >>> 0 < (k[565943] | 0) >>> 0)
                  Mb();
                else {
                  k[e >> 2] = 0;
                  p = f;
                  break;
                }
              } else {
                e = k[a + o >> 2] | 0;
                if (e >>> 0 < (k[565943] | 0) >>> 0)
                  Mb();
                d = e + 12 | 0;
                if ((k[d >> 2] | 0) != (q | 0))
                  Mb();
                c = f + 8 | 0;
                if ((k[c >> 2] | 0) == (q | 0)) {
                  k[d >> 2] = f;
                  k[c >> 2] = e;
                  p = f;
                  break;
                } else
                  Mb();
              }
 while (0);
            if (b) {
              f = k[a + (o + 20) >> 2] | 0;
              e = 2264060 + (f << 2) | 0;
              if ((q | 0) == (k[e >> 2] | 0)) {
                k[e >> 2] = p;
                if (!p) {
                  k[565940] = k[565940] & ~(1 << f);
                  break;
                }
              } else {
                if (b >>> 0 < (k[565943] | 0) >>> 0)
                  Mb();
                f = b + 16 | 0;
                if ((k[f >> 2] | 0) == (q | 0))
                  k[f >> 2] = p;
                else
                  k[b + 20 >> 2] = p;
                if (!p)
                  break;
              }
              f = k[565943] | 0;
              if (p >>> 0 < f >>> 0)
                Mb();
              k[p + 24 >> 2] = b;
              e = k[a + (o + 8) >> 2] | 0;
              do
                if (e)
                  if (e >>> 0 < f >>> 0)
                    Mb();
                  else {
                    k[p + 16 >> 2] = e;
                    k[e + 24 >> 2] = p;
                    break;
                  }
 while (0);
              c = k[a + (o + 12) >> 2] | 0;
              if (c)
                if (c >>> 0 < (k[565943] | 0) >>> 0)
                  Mb();
                else {
                  k[p + 20 >> 2] = c;
                  k[c + 24 >> 2] = p;
                  break;
                }
            }
          } else {
            c = k[a + o >> 2] | 0;
            d = k[a + (o | 4) >> 2] | 0;
            f = 2263796 + (b << 1 << 2) | 0;
            if ((c | 0) != (f | 0)) {
              if (c >>> 0 < (k[565943] | 0) >>> 0)
                Mb();
              if ((k[c + 12 >> 2] | 0) != (q | 0))
                Mb();
            }
            if ((d | 0) == (c | 0)) {
              k[565939] = k[565939] & ~(1 << b);
              break;
            }
            if ((d | 0) != (f | 0)) {
              if (d >>> 0 < (k[565943] | 0) >>> 0)
                Mb();
              e = d + 8 | 0;
              if ((k[e >> 2] | 0) == (q | 0))
                n = e;
              else
                Mb();
            } else
              n = d + 8 | 0;
            k[c + 12 >> 2] = d;
            k[n >> 2] = c;
          }
 while (0);
        k[u + 4 >> 2] = g | 1;
        k[u + g >> 2] = g;
        if ((u | 0) == (k[565944] | 0)) {
          k[565941] = g;
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
        f = 2263796 + (d << 2) | 0;
        b = k[565939] | 0;
        c = 1 << e;
        if (b & c) {
          c = 2263796 + (d + 2 << 2) | 0;
          b = k[c >> 2] | 0;
          if (b >>> 0 < (k[565943] | 0) >>> 0)
            Mb();
          else {
            r = c;
            s = b;
          }
        } else {
          k[565939] = b | c;
          r = 2263796 + (d + 2 << 2) | 0;
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
      c = 2264060 + (e << 2) | 0;
      k[u + 28 >> 2] = e;
      k[u + 20 >> 2] = 0;
      k[u + 16 >> 2] = 0;
      b = k[565940] | 0;
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
              if (b >>> 0 < (k[565943] | 0) >>> 0)
                Mb();
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
          s = k[565943] | 0;
          if (c >>> 0 >= s >>> 0 & t >>> 0 >= s >>> 0) {
            k[c + 12 >> 2] = u;
            k[b >> 2] = u;
            k[u + 8 >> 2] = c;
            k[u + 12 >> 2] = t;
            k[u + 24 >> 2] = 0;
            break;
          } else
            Mb();
        } else {
          k[565940] = b | d;
          k[c >> 2] = u;
          k[u + 24 >> 2] = c;
          k[u + 12 >> 2] = u;
          k[u + 8 >> 2] = u;
        }
 while (0);
      u = (k[565947] | 0) + -1 | 0;
      k[565947] = u;
      if (!u)
        b = 2264212;
      else
        return ;
      while (1) {
        b = k[b >> 2] | 0;
        if (!b)
          break;
        else
          b = b + 8 | 0;
      }
      k[565947] = -1;
      return ;
    }
    function de() {}
    function ee(a) {
      a = a | 0;
      var b = 0;
      b = a;
      while (i[b >> 0] | 0)
        b = b + 1 | 0;
      return b - a | 0;
    }
    function fe(a, b, c) {
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
    function ge(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0;
      if ((c | 0) >= 4096)
        return hb(a | 0, b | 0, c | 0) | 0;
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
    function he(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return $b[a & 63](b | 0, c | 0, d | 0) | 0;
    }
    function ie(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(0, a | 0, b | 0, c | 0) | 0;
    }
    function je(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(1, a | 0, b | 0, c | 0) | 0;
    }
    function ke(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(2, a | 0, b | 0, c | 0) | 0;
    }
    function le(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(3, a | 0, b | 0, c | 0) | 0;
    }
    function me(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(4, a | 0, b | 0, c | 0) | 0;
    }
    function ne(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(5, a | 0, b | 0, c | 0) | 0;
    }
    function oe(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(6, a | 0, b | 0, c | 0) | 0;
    }
    function pe(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(7, a | 0, b | 0, c | 0) | 0;
    }
    function qe(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(8, a | 0, b | 0, c | 0) | 0;
    }
    function re(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(9, a | 0, b | 0, c | 0) | 0;
    }
    function se(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(10, a | 0, b | 0, c | 0) | 0;
    }
    function te(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(11, a | 0, b | 0, c | 0) | 0;
    }
    function ue(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(12, a | 0, b | 0, c | 0) | 0;
    }
    function ve(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(13, a | 0, b | 0, c | 0) | 0;
    }
    function we(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(14, a | 0, b | 0, c | 0) | 0;
    }
    function xe(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(15, a | 0, b | 0, c | 0) | 0;
    }
    function ye(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(16, a | 0, b | 0, c | 0) | 0;
    }
    function ze(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(17, a | 0, b | 0, c | 0) | 0;
    }
    function Ae(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(18, a | 0, b | 0, c | 0) | 0;
    }
    function Be(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return ma(19, a | 0, b | 0, c | 0) | 0;
    }
    function Ce(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      ac[a & 63](b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function De(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(0, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Ee(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(1, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Fe(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(2, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Ge(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(3, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function He(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(4, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Ie(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(5, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Je(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(6, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Ke(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(7, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Le(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(8, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Me(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(9, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Ne(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(10, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Oe(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(11, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Pe(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(12, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Qe(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(13, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Re(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(14, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Se(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(15, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Te(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(16, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Ue(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(17, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Ve(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(18, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function We(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      oa(19, a | 0, b | 0, c | 0, d | 0, e | 0);
    }
    function Xe(a) {
      a = a | 0;
      return bc[a & 63]() | 0;
    }
    function Ye() {
      return qa(0) | 0;
    }
    function Ze() {
      return qa(1) | 0;
    }
    function _e() {
      return qa(2) | 0;
    }
    function $e() {
      return qa(3) | 0;
    }
    function af() {
      return qa(4) | 0;
    }
    function bf() {
      return qa(5) | 0;
    }
    function cf() {
      return qa(6) | 0;
    }
    function df() {
      return qa(7) | 0;
    }
    function ef() {
      return qa(8) | 0;
    }
    function ff() {
      return qa(9) | 0;
    }
    function gf() {
      return qa(10) | 0;
    }
    function hf() {
      return qa(11) | 0;
    }
    function jf() {
      return qa(12) | 0;
    }
    function kf() {
      return qa(13) | 0;
    }
    function lf() {
      return qa(14) | 0;
    }
    function mf() {
      return qa(15) | 0;
    }
    function nf() {
      return qa(16) | 0;
    }
    function of() {
      return qa(17) | 0;
    }
    function pf() {
      return qa(18) | 0;
    }
    function qf() {
      return qa(19) | 0;
    }
    function rf(a, b) {
      a = a | 0;
      b = b | 0;
      cc[a & 63](b | 0);
    }
    function sf(a) {
      a = a | 0;
      sa(0, a | 0);
    }
    function tf(a) {
      a = a | 0;
      sa(1, a | 0);
    }
    function uf(a) {
      a = a | 0;
      sa(2, a | 0);
    }
    function vf(a) {
      a = a | 0;
      sa(3, a | 0);
    }
    function wf(a) {
      a = a | 0;
      sa(4, a | 0);
    }
    function xf(a) {
      a = a | 0;
      sa(5, a | 0);
    }
    function yf(a) {
      a = a | 0;
      sa(6, a | 0);
    }
    function zf(a) {
      a = a | 0;
      sa(7, a | 0);
    }
    function Af(a) {
      a = a | 0;
      sa(8, a | 0);
    }
    function Bf(a) {
      a = a | 0;
      sa(9, a | 0);
    }
    function Cf(a) {
      a = a | 0;
      sa(10, a | 0);
    }
    function Df(a) {
      a = a | 0;
      sa(11, a | 0);
    }
    function Ef(a) {
      a = a | 0;
      sa(12, a | 0);
    }
    function Ff(a) {
      a = a | 0;
      sa(13, a | 0);
    }
    function Gf(a) {
      a = a | 0;
      sa(14, a | 0);
    }
    function Hf(a) {
      a = a | 0;
      sa(15, a | 0);
    }
    function If(a) {
      a = a | 0;
      sa(16, a | 0);
    }
    function Jf(a) {
      a = a | 0;
      sa(17, a | 0);
    }
    function Kf(a) {
      a = a | 0;
      sa(18, a | 0);
    }
    function Lf(a) {
      a = a | 0;
      sa(19, a | 0);
    }
    function Mf(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      dc[a & 63](b | 0, c | 0);
    }
    function Nf(a, b) {
      a = a | 0;
      b = b | 0;
      ua(0, a | 0, b | 0);
    }
    function Of(a, b) {
      a = a | 0;
      b = b | 0;
      ua(1, a | 0, b | 0);
    }
    function Pf(a, b) {
      a = a | 0;
      b = b | 0;
      ua(2, a | 0, b | 0);
    }
    function Qf(a, b) {
      a = a | 0;
      b = b | 0;
      ua(3, a | 0, b | 0);
    }
    function Rf(a, b) {
      a = a | 0;
      b = b | 0;
      ua(4, a | 0, b | 0);
    }
    function Sf(a, b) {
      a = a | 0;
      b = b | 0;
      ua(5, a | 0, b | 0);
    }
    function Tf(a, b) {
      a = a | 0;
      b = b | 0;
      ua(6, a | 0, b | 0);
    }
    function Uf(a, b) {
      a = a | 0;
      b = b | 0;
      ua(7, a | 0, b | 0);
    }
    function Vf(a, b) {
      a = a | 0;
      b = b | 0;
      ua(8, a | 0, b | 0);
    }
    function Wf(a, b) {
      a = a | 0;
      b = b | 0;
      ua(9, a | 0, b | 0);
    }
    function Xf(a, b) {
      a = a | 0;
      b = b | 0;
      ua(10, a | 0, b | 0);
    }
    function Yf(a, b) {
      a = a | 0;
      b = b | 0;
      ua(11, a | 0, b | 0);
    }
    function Zf(a, b) {
      a = a | 0;
      b = b | 0;
      ua(12, a | 0, b | 0);
    }
    function _f(a, b) {
      a = a | 0;
      b = b | 0;
      ua(13, a | 0, b | 0);
    }
    function $f(a, b) {
      a = a | 0;
      b = b | 0;
      ua(14, a | 0, b | 0);
    }
    function ag(a, b) {
      a = a | 0;
      b = b | 0;
      ua(15, a | 0, b | 0);
    }
    function bg(a, b) {
      a = a | 0;
      b = b | 0;
      ua(16, a | 0, b | 0);
    }
    function cg(a, b) {
      a = a | 0;
      b = b | 0;
      ua(17, a | 0, b | 0);
    }
    function dg(a, b) {
      a = a | 0;
      b = b | 0;
      ua(18, a | 0, b | 0);
    }
    function eg(a, b) {
      a = a | 0;
      b = b | 0;
      ua(19, a | 0, b | 0);
    }
    function fg(a, b) {
      a = a | 0;
      b = b | 0;
      return ec[a & 63](b | 0) | 0;
    }
    function gg(a) {
      a = a | 0;
      return wa(0, a | 0) | 0;
    }
    function hg(a) {
      a = a | 0;
      return wa(1, a | 0) | 0;
    }
    function ig(a) {
      a = a | 0;
      return wa(2, a | 0) | 0;
    }
    function jg(a) {
      a = a | 0;
      return wa(3, a | 0) | 0;
    }
    function kg(a) {
      a = a | 0;
      return wa(4, a | 0) | 0;
    }
    function lg(a) {
      a = a | 0;
      return wa(5, a | 0) | 0;
    }
    function mg(a) {
      a = a | 0;
      return wa(6, a | 0) | 0;
    }
    function ng(a) {
      a = a | 0;
      return wa(7, a | 0) | 0;
    }
    function og(a) {
      a = a | 0;
      return wa(8, a | 0) | 0;
    }
    function pg(a) {
      a = a | 0;
      return wa(9, a | 0) | 0;
    }
    function qg(a) {
      a = a | 0;
      return wa(10, a | 0) | 0;
    }
    function rg(a) {
      a = a | 0;
      return wa(11, a | 0) | 0;
    }
    function sg(a) {
      a = a | 0;
      return wa(12, a | 0) | 0;
    }
    function tg(a) {
      a = a | 0;
      return wa(13, a | 0) | 0;
    }
    function ug(a) {
      a = a | 0;
      return wa(14, a | 0) | 0;
    }
    function vg(a) {
      a = a | 0;
      return wa(15, a | 0) | 0;
    }
    function wg(a) {
      a = a | 0;
      return wa(16, a | 0) | 0;
    }
    function xg(a) {
      a = a | 0;
      return wa(17, a | 0) | 0;
    }
    function yg(a) {
      a = a | 0;
      return wa(18, a | 0) | 0;
    }
    function zg(a) {
      a = a | 0;
      return wa(19, a | 0) | 0;
    }
    function Ag(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      fc[a & 63](b | 0, c | 0, d | 0);
    }
    function Bg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(0, a | 0, b | 0, c | 0);
    }
    function Cg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(1, a | 0, b | 0, c | 0);
    }
    function Dg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(2, a | 0, b | 0, c | 0);
    }
    function Eg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(3, a | 0, b | 0, c | 0);
    }
    function Fg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(4, a | 0, b | 0, c | 0);
    }
    function Gg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(5, a | 0, b | 0, c | 0);
    }
    function Hg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(6, a | 0, b | 0, c | 0);
    }
    function Ig(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(7, a | 0, b | 0, c | 0);
    }
    function Jg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(8, a | 0, b | 0, c | 0);
    }
    function Kg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(9, a | 0, b | 0, c | 0);
    }
    function Lg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(10, a | 0, b | 0, c | 0);
    }
    function Mg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(11, a | 0, b | 0, c | 0);
    }
    function Ng(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(12, a | 0, b | 0, c | 0);
    }
    function Og(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(13, a | 0, b | 0, c | 0);
    }
    function Pg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(14, a | 0, b | 0, c | 0);
    }
    function Qg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(15, a | 0, b | 0, c | 0);
    }
    function Rg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(16, a | 0, b | 0, c | 0);
    }
    function Sg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(17, a | 0, b | 0, c | 0);
    }
    function Tg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(18, a | 0, b | 0, c | 0);
    }
    function Ug(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ya(19, a | 0, b | 0, c | 0);
    }
    function Vg(a) {
      a = a | 0;
      gc[a & 63]();
    }
    function Wg() {
      Aa(0);
    }
    function Xg() {
      Aa(1);
    }
    function Yg() {
      Aa(2);
    }
    function Zg() {
      Aa(3);
    }
    function _g() {
      Aa(4);
    }
    function $g() {
      Aa(5);
    }
    function ah() {
      Aa(6);
    }
    function bh() {
      Aa(7);
    }
    function ch() {
      Aa(8);
    }
    function dh() {
      Aa(9);
    }
    function eh() {
      Aa(10);
    }
    function fh() {
      Aa(11);
    }
    function gh() {
      Aa(12);
    }
    function hh() {
      Aa(13);
    }
    function ih() {
      Aa(14);
    }
    function jh() {
      Aa(15);
    }
    function kh() {
      Aa(16);
    }
    function lh() {
      Aa(17);
    }
    function mh() {
      Aa(18);
    }
    function nh() {
      Aa(19);
    }
    function oh(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      return hc[a & 63](b | 0, c | 0, d | 0, e | 0) | 0;
    }
    function ph(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(0, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function qh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(1, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function rh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(2, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function sh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(3, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function th(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(4, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function uh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(5, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function vh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(6, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function wh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(7, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function xh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(8, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function yh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(9, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function zh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(10, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Ah(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(11, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Bh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(12, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Ch(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(13, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Dh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(14, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Eh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(15, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Fh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(16, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Gh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(17, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Hh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(18, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Ih(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Ca(19, a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function Jh(a, b, c, d, e, f, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      g = g | 0;
      ic[a & 63](b | 0, c | 0, d | 0, e | 0, f | 0, g | 0);
    }
    function Kh(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(0, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Lh(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(1, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Mh(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(2, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Nh(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(3, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Oh(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(4, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Ph(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(5, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Qh(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(6, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Rh(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(7, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Sh(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(8, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Th(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(9, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Uh(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(10, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Vh(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(11, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Wh(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(12, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Xh(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(13, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Yh(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(14, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function Zh(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(15, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function _h(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(16, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function $h(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(17, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function ai(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(18, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function bi(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      Ea(19, a | 0, b | 0, c | 0, d | 0, e | 0, f | 0);
    }
    function ci(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      return jc[a & 63](b | 0, c | 0) | 0;
    }
    function di(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(0, a | 0, b | 0) | 0;
    }
    function ei(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(1, a | 0, b | 0) | 0;
    }
    function fi(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(2, a | 0, b | 0) | 0;
    }
    function gi(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(3, a | 0, b | 0) | 0;
    }
    function hi(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(4, a | 0, b | 0) | 0;
    }
    function ii(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(5, a | 0, b | 0) | 0;
    }
    function ji(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(6, a | 0, b | 0) | 0;
    }
    function ki(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(7, a | 0, b | 0) | 0;
    }
    function li(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(8, a | 0, b | 0) | 0;
    }
    function mi(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(9, a | 0, b | 0) | 0;
    }
    function ni(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(10, a | 0, b | 0) | 0;
    }
    function oi(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(11, a | 0, b | 0) | 0;
    }
    function pi(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(12, a | 0, b | 0) | 0;
    }
    function qi(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(13, a | 0, b | 0) | 0;
    }
    function ri(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(14, a | 0, b | 0) | 0;
    }
    function si(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(15, a | 0, b | 0) | 0;
    }
    function ti(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(16, a | 0, b | 0) | 0;
    }
    function ui(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(17, a | 0, b | 0) | 0;
    }
    function vi(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(18, a | 0, b | 0) | 0;
    }
    function wi(a, b) {
      a = a | 0;
      b = b | 0;
      return Ga(19, a | 0, b | 0) | 0;
    }
    function xi(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      kc[a & 63](b | 0, c | 0, d | 0, e | 0);
    }
    function yi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(0, a | 0, b | 0, c | 0, d | 0);
    }
    function zi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(1, a | 0, b | 0, c | 0, d | 0);
    }
    function Ai(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(2, a | 0, b | 0, c | 0, d | 0);
    }
    function Bi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(3, a | 0, b | 0, c | 0, d | 0);
    }
    function Ci(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(4, a | 0, b | 0, c | 0, d | 0);
    }
    function Di(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(5, a | 0, b | 0, c | 0, d | 0);
    }
    function Ei(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(6, a | 0, b | 0, c | 0, d | 0);
    }
    function Fi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(7, a | 0, b | 0, c | 0, d | 0);
    }
    function Gi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(8, a | 0, b | 0, c | 0, d | 0);
    }
    function Hi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(9, a | 0, b | 0, c | 0, d | 0);
    }
    function Ii(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(10, a | 0, b | 0, c | 0, d | 0);
    }
    function Ji(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(11, a | 0, b | 0, c | 0, d | 0);
    }
    function Ki(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(12, a | 0, b | 0, c | 0, d | 0);
    }
    function Li(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(13, a | 0, b | 0, c | 0, d | 0);
    }
    function Mi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(14, a | 0, b | 0, c | 0, d | 0);
    }
    function Ni(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(15, a | 0, b | 0, c | 0, d | 0);
    }
    function Oi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(16, a | 0, b | 0, c | 0, d | 0);
    }
    function Pi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(17, a | 0, b | 0, c | 0, d | 0);
    }
    function Qi(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(18, a | 0, b | 0, c | 0, d | 0);
    }
    function Ri(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      Ia(19, a | 0, b | 0, c | 0, d | 0);
    }
    function Si(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ja(0);
      return 0;
    }
    function Ti(a, b, c, d, e) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      ja(1);
    }
    function Ui() {
      ja(2);
      return 0;
    }
    function Vi(a) {
      a = a | 0;
      ja(3);
    }
    function Wi(a, b) {
      a = a | 0;
      b = b | 0;
      ja(4);
    }
    function Xi(a, b) {
      a = a | 0;
      b = b | 0;
      cb(a | 0, b | 0);
    }
    function Yi(a) {
      a = a | 0;
      ja(5);
      return 0;
    }
    function Zi(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      ja(6);
    }
    function _i() {
      ja(7);
    }
    function $i() {
      $a();
    }
    function aj(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      ja(8);
      return 0;
    }
    function bj(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      return Zb(a | 0, b | 0, c | 0, d | 0) | 0;
    }
    function cj(a, b, c, d, e, f) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      f = f | 0;
      ja(9);
    }
    function dj(a, b) {
      a = a | 0;
      b = b | 0;
      ja(10);
      return 0;
    }
    function ej(a, b) {
      a = a | 0;
      b = b | 0;
      return Kb(a | 0, b | 0) | 0;
    }
    function fj(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      ja(11);
    }
    function gj(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      mb(a | 0, b | 0, c | 0, d | 0);
    }
    var $b = [Si, Si, ie, Si, je, Si, ke, Si, le, Si, me, Si, ne, Si, oe, Si, pe, Si, qe, Si, re, Si, se, Si, te, Si, ue, Si, ve, Si, we, Si, xe, Si, ye, Si, ze, Si, Ae, Si, Be, Si, Kd, Ld, Md, Sd, Si, Si, Si, Si, Si, Si, Si, Si, Si, Si, Si, Si, Si, Si, Si, Si, Si, Si];
    var ac = [Ti, Ti, De, Ti, Ee, Ti, Fe, Ti, Ge, Ti, He, Ti, Ie, Ti, Je, Ti, Ke, Ti, Le, Ti, Me, Ti, Ne, Ti, Oe, Ti, Pe, Ti, Qe, Ti, Re, Ti, Se, Ti, Te, Ti, Ue, Ti, Ve, Ti, We, Ti, Zd, Yd, Vd, Ti, Ti, Ti, Ti, Ti, Ti, Ti, Ti, Ti, Ti, Ti, Ti, Ti, Ti, Ti, Ti, Ti, Ti, Ti];
    var bc = [Ui, Ui, Ye, Ui, Ze, Ui, _e, Ui, $e, Ui, af, Ui, bf, Ui, cf, Ui, df, Ui, ef, Ui, ff, Ui, gf, Ui, hf, Ui, jf, Ui, kf, Ui, lf, Ui, mf, Ui, nf, Ui, of, Ui, pf, Ui, qf, Ui, Rc, Qc, cd, Ui, Ui, Ui, Ui, Ui, Ui, Ui, Ui, Ui, Ui, Ui, Ui, Ui, Ui, Ui, Ui, Ui, Ui, Ui];
    var cc = [Vi, Vi, sf, Vi, tf, Vi, uf, Vi, vf, Vi, wf, Vi, xf, Vi, yf, Vi, zf, Vi, Af, Vi, Bf, Vi, Cf, Vi, Df, Vi, Ef, Vi, Ff, Vi, Gf, Vi, Hf, Vi, If, Vi, Jf, Vi, Kf, Vi, Lf, Vi, Bd, Ed, Cd, Dd, Fd, Gd, Hd, Id, Jd, wc, Vi, Vi, Vi, Vi, Vi, Vi, Vi, Vi, Vi, Vi, Vi, Vi];
    var dc = [Wi, Wi, Nf, Wi, Of, Wi, Pf, Wi, Qf, Wi, Rf, Wi, Sf, Wi, Tf, Wi, Uf, Wi, Vf, Wi, Wf, Wi, Xf, Wi, Yf, Wi, Zf, Wi, _f, Wi, $f, Wi, ag, Wi, bg, Wi, cg, Wi, dg, Wi, eg, Wi, Xi, Mc, od, Wi, Wi, Wi, Wi, Wi, Wi, Wi, Wi, Wi, Wi, Wi, Wi, Wi, Wi, Wi, Wi, Wi, Wi, Wi];
    var ec = [Yi, Yi, gg, Yi, hg, Yi, ig, Yi, jg, Yi, kg, Yi, lg, Yi, mg, Yi, ng, Yi, og, Yi, pg, Yi, qg, Yi, rg, Yi, sg, Yi, tg, Yi, ug, Yi, vg, Yi, wg, Yi, xg, Yi, yg, Yi, zg, Yi, xc, Vc, nd, Yi, Yi, Yi, Yi, Yi, Yi, Yi, Yi, Yi, Yi, Yi, Yi, Yi, Yi, Yi, Yi, Yi, Yi, Yi];
    var fc = [Zi, Zi, Bg, Zi, Cg, Zi, Dg, Zi, Eg, Zi, Fg, Zi, Gg, Zi, Hg, Zi, Ig, Zi, Jg, Zi, Kg, Zi, Lg, Zi, Mg, Zi, Ng, Zi, Og, Zi, Pg, Zi, Qg, Zi, Rg, Zi, Sg, Zi, Tg, Zi, Ug, Zi, zc, Zi, Zi, Zi, Zi, Zi, Zi, Zi, Zi, Zi, Zi, Zi, Zi, Zi, Zi, Zi, Zi, Zi, Zi, Zi, Zi, Zi];
    var gc = [_i, _i, Wg, _i, Xg, _i, Yg, _i, Zg, _i, _g, _i, $g, _i, ah, _i, bh, _i, ch, _i, dh, _i, eh, _i, fh, _i, gh, _i, hh, _i, ih, _i, jh, _i, kh, _i, lh, _i, mh, _i, nh, _i, $i, uc, Tc, hd, jd, gd, Nc, _i, _i, _i, _i, _i, _i, _i, _i, _i, _i, _i, _i, _i, _i, _i];
    var hc = [aj, aj, ph, aj, qh, aj, rh, aj, sh, aj, th, aj, uh, aj, vh, aj, wh, aj, xh, aj, yh, aj, zh, aj, Ah, aj, Bh, aj, Ch, aj, Dh, aj, Eh, aj, Fh, aj, Gh, aj, Hh, aj, Ih, aj, bj, aj, aj, aj, aj, aj, aj, aj, aj, aj, aj, aj, aj, aj, aj, aj, aj, aj, aj, aj, aj, aj];
    var ic = [cj, cj, Kh, cj, Lh, cj, Mh, cj, Nh, cj, Oh, cj, Ph, cj, Qh, cj, Rh, cj, Sh, cj, Th, cj, Uh, cj, Vh, cj, Wh, cj, Xh, cj, Yh, cj, Zh, cj, _h, cj, $h, cj, ai, cj, bi, cj, ae, $d, _d, cj, cj, cj, cj, cj, cj, cj, cj, cj, cj, cj, cj, cj, cj, cj, cj, cj, cj, cj];
    var jc = [dj, dj, di, dj, ei, dj, fi, dj, gi, dj, hi, dj, ii, dj, ji, dj, ki, dj, li, dj, mi, dj, ni, dj, oi, dj, pi, dj, qi, dj, ri, dj, si, dj, ti, dj, ui, dj, vi, dj, wi, dj, ej, yc, dj, dj, dj, dj, dj, dj, dj, dj, dj, dj, dj, dj, dj, dj, dj, dj, dj, dj, dj, dj];
    var kc = [fj, fj, yi, fj, zi, fj, Ai, fj, Bi, fj, Ci, fj, Di, fj, Ei, fj, Fi, fj, Gi, fj, Hi, fj, Ii, fj, Ji, fj, Ki, fj, Li, fj, Mi, fj, Ni, fj, Oi, fj, Pi, fj, Qi, fj, Ri, fj, Od, Pd, Rd, gj, fj, fj, fj, fj, fj, fj, fj, fj, fj, fj, fj, fj, fj, fj, fj, fj, fj, fj];
    return {
      _retro_cheat_set: Oc,
      _strlen: ee,
      _free: ce,
      _retro_load_game: fd,
      _retro_get_memory_data: Uc,
      _memset: fe,
      _retro_unserialize: ed,
      _malloc: be,
      _memcpy: ge,
      ___getTypeName: vd,
      _retro_get_system_info: $c,
      _retro_serialize: dd,
      _retro_get_system_av_info: ad,
      _retro_load_game_special: Sc,
      __GLOBAL__sub_I_libretro_emscripten_cpp: Ac,
      __GLOBAL__sub_I_bind_cpp: xd,
      runPostSets: de,
      _emscripten_replace_memory: _emscripten_replace_memory,
      stackAlloc: lc,
      stackSave: mc,
      stackRestore: nc,
      establishStackSpace: oc,
      setThrew: pc,
      setTempRet0: sc,
      getTempRet0: tc,
      dynCall_iiii: he,
      dynCall_viiiii: Ce,
      dynCall_i: Xe,
      dynCall_vi: rf,
      dynCall_vii: Mf,
      dynCall_ii: fg,
      dynCall_viii: Ag,
      dynCall_v: Vg,
      dynCall_iiiii: oh,
      dynCall_viiiiii: Jh,
      dynCall_iii: ci,
      dynCall_viiii: xi
    };
  })(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
  var _retro_cheat_set = Module["_retro_cheat_set"] = asm["_retro_cheat_set"];
  var _strlen = Module["_strlen"] = asm["_strlen"];
  var __GLOBAL__sub_I_bind_cpp = Module["__GLOBAL__sub_I_bind_cpp"] = asm["__GLOBAL__sub_I_bind_cpp"];
  var _free = Module["_free"] = asm["_free"];
  var __GLOBAL__sub_I_libretro_emscripten_cpp = Module["__GLOBAL__sub_I_libretro_emscripten_cpp"] = asm["__GLOBAL__sub_I_libretro_emscripten_cpp"];
  var _emscripten_replace_memory = Module["_emscripten_replace_memory"] = asm["_emscripten_replace_memory"];
  var _retro_load_game = Module["_retro_load_game"] = asm["_retro_load_game"];
  var _retro_get_memory_data = Module["_retro_get_memory_data"] = asm["_retro_get_memory_data"];
  var _memset = Module["_memset"] = asm["_memset"];
  var _retro_unserialize = Module["_retro_unserialize"] = asm["_retro_unserialize"];
  var _malloc = Module["_malloc"] = asm["_malloc"];
  var _memcpy = Module["_memcpy"] = asm["_memcpy"];
  var ___getTypeName = Module["___getTypeName"] = asm["___getTypeName"];
  var _retro_get_system_info = Module["_retro_get_system_info"] = asm["_retro_get_system_info"];
  var _retro_serialize = Module["_retro_serialize"] = asm["_retro_serialize"];
  var _retro_get_system_av_info = Module["_retro_get_system_av_info"] = asm["_retro_get_system_av_info"];
  var _retro_load_game_special = Module["_retro_load_game_special"] = asm["_retro_load_game_special"];
  var runPostSets = Module["runPostSets"] = asm["runPostSets"];
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
  var i64Math = null;
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
