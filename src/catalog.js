// The object library. Sizes are in centimetres: w = width, d = depth, h = height,
// elevation = height of the object's bottom above the floor.
// `style` selects how the object is drawn in 3D (see view3d.js).

import { IKEA_CATALOG } from './catalog-ikea.js';

export const CATEGORIES = [
  { id: 'opening', name: 'Doors & windows' },
  { id: 'base', name: 'Base cabinets' },
  { id: 'wall', name: 'Wall cabinets' },
  { id: 'tall', name: 'Tall units' },
  { id: 'appliance', name: 'Appliances' },
  { id: 'sink', name: 'Sinks & taps' },
  { id: 'worktop', name: 'Worktops' },
  { id: 'island', name: 'Islands & trolleys' },
  { id: 'storage', name: 'Shelves & rails' },
  { id: 'furniture', name: 'Tables & seating' },
];

const FRONT = '#f2efe8';
const STEEL = '#c9ccd0';

// Doors and windows sit inside a wall (opening: true): they snap into the wall's
// thickness and cut a hole in it in the 3D view.
const DOOR = '#f7f5f0';
const OPENINGS = [
  { type: 'door-70', name: 'Door 70', w: 70, h: 205, style: 'door', color: DOOR },
  { type: 'door-80', name: 'Door 80', w: 80, h: 205, style: 'door', color: DOOR },
  { type: 'door-90', name: 'Door 90', w: 90, h: 205, style: 'door', color: DOOR },
  { type: 'door-double-140', name: 'Double door 140', w: 140, h: 205, style: 'door', color: DOOR, look: { leaves: 2 } },
  { type: 'door-glass-90', name: 'Glazed door 90', w: 90, h: 215, style: 'door', color: DOOR, look: { glass: true } },
  { type: 'door-sliding-160', name: 'Patio sliding door 160', w: 160, h: 215, style: 'door', color: '#3a3d42', look: { sliding: true } },
  { type: 'door-pocket-80', name: 'Sliding pocket door 80', w: 80, h: 205, style: 'door', color: DOOR, look: { pocket: true } },
  { type: 'passage-90', name: 'Open doorway 90', w: 90, h: 210, style: 'passage', color: '#e9e4da' },
  { type: 'arch-120', name: 'Wide opening 120', w: 120, h: 220, style: 'passage', color: '#e9e4da' },
  { type: 'window-60', name: 'Window 60×120', w: 60, h: 120, elevation: 95, style: 'window', color: DOOR },
  { type: 'window-120', name: 'Window 120×140', w: 120, h: 140, elevation: 90, style: 'window', color: DOOR, look: { panes: 2 } },
  { type: 'window-180', name: 'Window 180×140', w: 180, h: 140, elevation: 90, style: 'window', color: DOOR, look: { panes: 3 } },
  { type: 'window-kitchen-100', name: 'Window above worktop 100×100', w: 100, h: 100, elevation: 110, style: 'window', color: DOOR, look: { panes: 2 } },
].map((o) => ({ category: 'opening', d: 12, opening: true, ...o }));

export const CATALOG = [
  ...OPENINGS,
  { type: 'base-30', category: 'base', name: 'Base cabinet 30', w: 30, d: 60, h: 90, style: 'base', color: FRONT },
  { type: 'base-40', category: 'base', name: 'Base cabinet 40', w: 40, d: 60, h: 90, style: 'base', color: FRONT },
  { type: 'base-60', category: 'base', name: 'Base cabinet 60', w: 60, d: 60, h: 90, style: 'base', color: FRONT },
  { type: 'base-80', category: 'base', name: 'Base cabinet 80', w: 80, d: 60, h: 90, style: 'base', color: FRONT },
  { type: 'drawers-60', category: 'base', name: 'Drawer unit 60', w: 60, d: 60, h: 90, style: 'drawers', color: FRONT },
  { type: 'corner-base', category: 'base', name: 'Corner base 90', w: 90, d: 60, h: 90, style: 'base', color: FRONT },
  { type: 'island', category: 'base', name: 'Kitchen island', w: 180, d: 90, h: 90, style: 'island', color: '#3e5c76' },

  { type: 'wall-40', category: 'wall', name: 'Wall cabinet 40', w: 40, d: 35, h: 72, elevation: 145, style: 'wall', color: FRONT },
  { type: 'wall-60', category: 'wall', name: 'Wall cabinet 60', w: 60, d: 35, h: 72, elevation: 145, style: 'wall', color: FRONT },
  { type: 'wall-80', category: 'wall', name: 'Wall cabinet 80', w: 80, d: 35, h: 72, elevation: 145, style: 'wall', color: FRONT },
  { type: 'shelf-80', category: 'wall', name: 'Open shelf 80', w: 80, d: 25, h: 3, elevation: 150, style: 'shelf', color: '#b08a5a' },

  { type: 'tall-60', category: 'tall', name: 'Tall cabinet 60', w: 60, d: 60, h: 217, style: 'tall', color: FRONT },
  { type: 'oven-tower', category: 'tall', name: 'Oven tower 60', w: 60, d: 60, h: 217, style: 'oventower', color: FRONT },

  { type: 'fridge', category: 'appliance', name: 'Fridge-freezer', w: 70, d: 70, h: 200, style: 'fridge', color: STEEL },
  { type: 'range', category: 'appliance', name: 'Cooker with hob', w: 60, d: 60, h: 90, style: 'stove', color: STEEL },
  { type: 'hob-base', category: 'appliance', name: 'Hob on base unit', w: 60, d: 60, h: 90, style: 'hob', color: FRONT },
  { type: 'dishwasher', category: 'appliance', name: 'Dishwasher', w: 60, d: 60, h: 90, style: 'dishwasher', color: FRONT },
  { type: 'hood', category: 'appliance', name: 'Cooker hood', w: 60, d: 50, h: 60, elevation: 160, style: 'hood', color: STEEL },
  { type: 'microwave', category: 'appliance', name: 'Microwave', w: 50, d: 38, h: 30, elevation: 90, style: 'microwave', color: '#2b2d31' },

  { type: 'sink-60', category: 'sink', name: 'Sink unit 60', w: 60, d: 60, h: 90, style: 'sink', color: FRONT },
  { type: 'sink-80', category: 'sink', name: 'Sink unit 80', w: 80, d: 60, h: 90, style: 'sink', color: FRONT },
  { type: 'sink-double', category: 'sink', name: 'Double sink 120', w: 120, d: 60, h: 90, style: 'sink2', color: FRONT },

  { type: 'table-4', category: 'furniture', name: 'Dining table 4', w: 120, d: 80, h: 75, style: 'table', color: '#a77b4f' },
  { type: 'table-6', category: 'furniture', name: 'Dining table 6', w: 180, d: 90, h: 75, style: 'table', color: '#a77b4f' },
  { type: 'chair', category: 'furniture', name: 'Chair', w: 45, d: 50, h: 90, style: 'chair', color: '#6b4f36' },
  { type: 'stool', category: 'furniture', name: 'Bar stool', w: 40, d: 40, h: 75, style: 'stool', color: '#333333' },
  ...IKEA_CATALOG,
];

const BY_TYPE = new Map(CATALOG.map((c) => [c.type, c]));

export function catalogEntry(type) {
  return BY_TYPE.get(type);
}

/**
 * Does a catalog entry match every search word? Words are matched against the name,
 * brand and series; a plain number like "60" matches a width or a number in the name.
 */
export function matchesSearch(c, words) {
  const text = [c.name, c.brand, c.series, c.type].filter(Boolean).join(' ').toLowerCase();
  const numbers = new Set([String(c.w), ...(c.name.match(/\d+/g) ?? [])]);
  return words.every((w) => (/^\d+$/.test(w) ? numbers.has(w) : text.includes(w)));
}
