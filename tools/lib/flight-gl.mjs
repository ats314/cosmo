/* Recording geometry target only. Real shader/pixel checks belong to Chromium. */
import assert from 'node:assert/strict';

export function flightGL() {
  let nextEnum = 100, uploaded = 0, draws = 0, lost = false;
  const enums = {}, original = { program: { sky: true }, buffer: { triangle: true } };
  let program = original.program, buffer = original.buffer;
  const enabled = new Set(), attributes = new Map();
  const noOp = () => {};
  const target = {
    drawingBufferWidth: 390, drawingBufferHeight: 844,
    createShader: () => ({}), shaderSource: noOp, compileShader: noOp, getShaderParameter: () => true,
    createProgram: () => ({}), createBuffer: () => ({}), attachShader: noOp, bindAttribLocation: noOp,
    linkProgram: noOp, getProgramParameter: () => true, getUniformLocation: (_p, name) => ({ name }),
    getParameter(key) { if (key === gl.CURRENT_PROGRAM) return program; if (key === gl.ARRAY_BUFFER_BINDING) return buffer; return 1; },
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
    bufferData(_key, data) { for (const value of data) assert(Number.isFinite(value), 'flight uploads non-finite geometry'); uploaded += data.length; },
    uniform1f: noOp, uniform2f: noOp, uniform3f: noOp, blendFuncSeparate: noOp, blendEquation: noOp, blendEquationSeparate: noOp,
    drawArrays(_kind, _start, count) { assert(count > 0 && count <= 12500, 'flight exceeds its geometry budget'); draws++; },
    isContextLost: () => lost, deleteShader: noOp, deleteProgram: noOp, deleteBuffer: noOp,
  };
  const gl = new Proxy(target, { get(obj, key) {
    if (key in obj) return obj[key];
    if (typeof key === 'string' && /^[A-Z_0-9]+$/.test(key)) return enums[key] ??= nextEnum++;
    throw new Error(`Unrecorded flight WebGL operation: ${String(key)}`);
  } });
  return { gl,
    contextLost(value) { lost = value; },
    verify() {
      assert.equal(program, original.program, 'flight strands its GPU program');
      assert.equal(buffer, original.buffer, 'flight strands its geometry buffer');
      assert.equal(enabled.size, 0, 'flight strands altered GPU capabilities');
      assert.equal(attributes.get(0), true, 'flight loses the sky triangle attribute');
      assert(draws > 0 && uploaded > 0, 'actual flight renderer issued no geometry');
      return draws;
    },
  };
}
