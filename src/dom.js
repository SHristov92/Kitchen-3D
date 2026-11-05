/** Tiny element helper: h('div', { class: 'x', onclick: fn }, child, 'text'). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** A labelled number input that commits on change (Enter or blur). */
export function numberField(label, value, onCommit, { min, max, step = 1, unit = 'cm', key } = {}) {
  const input = h('input', {
    type: 'number', value: fmt(value), step, min, max,
    dataset: key ? { key } : undefined,
    onchange: () => {
      const v = parseFloat(input.value);
      if (Number.isFinite(v)) onCommit(clamp(v, min, max));
      else input.value = fmt(value);
    },
    onkeydown: (e) => { if (e.key === 'Enter') input.blur(); },
  });
  return h('label', { class: 'field' }, h('span', {}, label), h('div', { class: 'input-unit' }, input, unit && h('em', {}, unit)));
}

export function fmt(v) {
  return Number.isFinite(v) ? String(Math.round(v * 10) / 10) : '';
}

function clamp(v, min, max) {
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return v;
}
