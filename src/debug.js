// Performance readout, shown when the page is opened with ?debug in the address.

/** Time each call of obj[name] and keep a running average in stats[key]. */
function timeMethod(obj, name, stats, key) {
  const orig = obj[name].bind(obj);
  obj[name] = (...args) => {
    const t = performance.now();
    try { return orig(...args); } finally {
      const ms = performance.now() - t;
      stats[key] = { last: ms, count: (stats[key]?.count ?? 0) + 1 };
    }
  };
}

export function startDebugOverlay({ view, editor }) {
  const gl = view.renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const stats = {};
  let lost = 0;
  view.canvas.addEventListener('webglcontextlost', () => { lost++; });
  timeMethod(view, 'rebuild', stats, 'rebuild3d');
  timeMethod(view.renderer, 'render', stats, 'render3d');
  timeMethod(editor, 'draw', stats, 'draw2d');
  let longTasks = 0; let longMs = 0;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) { longTasks++; longMs += e.duration; }
    }).observe({ type: 'longtask', buffered: true });
  } catch { /* not supported */ }

  // Would the browser give us a GPU context if we refused a software one?
  let caveat = 'n/a';
  try {
    const t = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    caveat = t ? 'hardware context OK' : 'refused (software only for this page)';
    t?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* ignore */ }
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:9999;margin:0;padding:8px 10px;'
    + 'background:rgba(0,0,0,.78);color:#e8ffe8;font:11px/1.45 ui-monospace,monospace;border-radius:6px;'
    + 'pointer-events:none;white-space:pre;max-width:60vw;overflow:hidden';
  document.body.append(box);

  let frames = 0; let last = performance.now(); let prev = {};
  const loop = () => { frames++; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  setInterval(() => {
    const now = performance.now();
    const secs = (now - last) / 1000;
    const rate = (k) => (((stats[k]?.count ?? 0) - (prev[k] ?? 0)) / secs).toFixed(0);
    const ms = (k) => (stats[k] ? stats[k].last.toFixed(1) : '-');
    const info = view.renderer.info;
    const c = view.renderer.domElement;
    box.textContent = [
      `GPU: ${gpu}`,
      `screen fps: ${(frames / secs).toFixed(0)}   devicePixelRatio: ${window.devicePixelRatio}`,
      `3D canvas: ${c.width}x${c.height}   renders/s: ${rate('render3d')}   last render: ${ms('render3d')} ms`,
      `3D draw calls: ${info.render.calls}   triangles: ${info.render.triangles}   shaders: ${info.programs.length}`,
      `3D rebuild: ${ms('rebuild3d')} ms (${rate('rebuild3d')}/s)   2D draw: ${ms('draw2d')} ms (${rate('draw2d')}/s)`,
      `GPU context lost: ${lost}x   failIfMajorPerformanceCaveat test: ${caveat}`,
      `long tasks: ${longTasks} (${(longMs / 1000).toFixed(1)} s total)`,
      `page: ${location.protocol}//${location.host}   secure context: ${window.isSecureContext}`,
      `browser: ${navigator.userAgent}`,
    ].join('\n');
    prev = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, v.count]));
    frames = 0; last = now;
  }, 1000);
}
