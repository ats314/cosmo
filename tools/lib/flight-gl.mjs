/* Recording geometry target only. Real shader/pixel checks belong to Chromium. */
import assert from 'node:assert/strict';

export function flightGL() {
  let nextEnum = 100, uploaded = 0, draws = 0, lost = false;
  let geometry = [], maxVertices = 0;
  const uniforms = {};
  const enums = {}, original = { program: { sky: true }, buffer: { triangle: true } };
  let program = original.program, buffer = original.buffer;
  let textureUnit, flip = true, premultiply = true;
  const skyTexture = { skyMaterial: true }, spareTexture = { priorUnit3: true };
  const bindings = new Map(), textures = new Set();
  const currentUnit = () => textureUnit ?? gl.TEXTURE2;
  const binding = () => bindings.has(currentUnit()) ? bindings.get(currentUnit()) :
    currentUnit() === gl.TEXTURE3 ? spareTexture : skyTexture;
  const enabled = new Set(), attributes = new Map();
  const noOp = () => {};
  const recordUniform = (location, ...values) => {
    assert(values.every(Number.isFinite), `flight uploads a non-finite ${location.name} uniform`);
    uniforms[location.name] = values;
  };
  const target = {
    drawingBufferWidth: 390, drawingBufferHeight: 844,
    createShader: () => ({}), shaderSource: noOp, compileShader: noOp, getShaderParameter: () => true,
    createProgram: () => ({}), createBuffer: () => ({}), attachShader: noOp, bindAttribLocation: noOp,
    linkProgram: noOp, getProgramParameter: () => true, getUniformLocation: (_p, name) => ({ name }),
    getParameter(key) {
      if (key === gl.CURRENT_PROGRAM) return program;
      if (key === gl.ARRAY_BUFFER_BINDING) return buffer;
      if (key === gl.ACTIVE_TEXTURE) return currentUnit();
      if (key === gl.TEXTURE_BINDING_2D) return binding();
      if (key === gl.UNPACK_FLIP_Y_WEBGL) return flip;
      if (key === gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL) return premultiply;
      return 1;
    },
    activeTexture: unit => { textureUnit = unit; },
    createTexture() { const texture = {}; textures.add(texture); return texture; },
    deleteTexture: texture => { textures.delete(texture); },
    bindTexture: (_target, texture) => { bindings.set(currentUnit(), texture); },
    texParameteri: noOp,
    pixelStorei(key, value) {
      if (key === gl.UNPACK_FLIP_Y_WEBGL) flip = value;
      if (key === gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL) premultiply = value;
    },
    texImage2D(...args) {
      assert(textures.has(binding()), 'texture upload targets an unowned texture');
      if (args.length === 6 && args[5].failUpload) throw new Error('image upload failed');
    },
    isEnabled: key => enabled.has(key), enable: key => enabled.add(key), disable: key => enabled.delete(key),
    getVertexAttrib(index, key) {
      if (key === gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING) return original.buffer;
      if (key === gl.VERTEX_ATTRIB_ARRAY_ENABLED) return index === 0;
      if (key === gl.VERTEX_ATTRIB_ARRAY_SIZE) return 2;
      if (key === gl.VERTEX_ATTRIB_ARRAY_TYPE) return gl.FLOAT;
      return 0;
    },
    getVertexAttribOffset: () => 0,
    useProgram: value => { program = value; }, bindBuffer: (_key, value) => { buffer = value; },
    enableVertexAttribArray: index => attributes.set(index, true), disableVertexAttribArray: index => attributes.set(index, false),
    vertexAttribPointer: noOp,
    bufferData(_key, data) {
      for (const value of data) assert(Number.isFinite(value), 'flight uploads non-finite geometry');
      assert.equal(data.length % 11, 0, 'flight uploads an incomplete vertex');
      geometry = Array.from(data); uploaded += data.length;
    },
    uniform1i: recordUniform, uniform1f: recordUniform, uniform2f: recordUniform, uniform3f: recordUniform,
    blendFuncSeparate: noOp, blendEquation: noOp, blendEquationSeparate: noOp,
    drawArrays(_kind, start, count) {
      assert(count > 0 && count <= 12500, 'flight exceeds its geometry budget');
      assert(start + count <= geometry.length / 11, 'flight draws beyond the uploaded buffer');
      maxVertices = Math.max(maxVertices, count); draws++;
    },
    isContextLost: () => lost, deleteShader: noOp, deleteProgram: noOp, deleteBuffer: noOp,
  };
  const gl = new Proxy(target, { get(obj, key) {
    if (key in obj) return obj[key];
    if (typeof key === 'string' && /^[A-Z_0-9]+$/.test(key)) return enums[key] ??= nextEnum++;
    throw new Error(`Unrecorded flight WebGL operation: ${String(key)}`);
  } });
  return { gl,
    snapshot() {
      return { geometry: geometry.slice(), uniforms: structuredClone(uniforms), draws, maxVertices, textures: textures.size };
    },
    contextLost(value) { lost = value; },
    verify() {
      assert.equal(program, original.program, 'flight strands its GPU program');
      assert.equal(buffer, original.buffer, 'flight strands its geometry buffer');
      assert.equal(currentUnit(), gl.TEXTURE2, 'flight strands its texture unit');
      assert.equal(binding(), skyTexture, 'flight changes the active sky material');
      assert.equal(bindings.get(gl.TEXTURE3), spareTexture, 'flight strands its Earth texture');
      assert.equal(flip, true, 'flight changes the shared image orientation');
      assert.equal(premultiply, true, 'flight changes shared alpha handling');
      assert.equal(enabled.size, 0, 'flight strands altered GPU capabilities');
      assert.equal(attributes.get(0), true, 'flight loses the sky triangle attribute');
      assert(draws > 0 && uploaded > 0, 'actual flight renderer issued no geometry');
      return draws;
    },
  };
}
