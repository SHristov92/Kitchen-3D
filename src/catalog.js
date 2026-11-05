// The object library. Sizes are in centimetres: w = width, d = depth, h = height,
// elevation = height of the object's bottom above the floor.
// `style` selects how the object is drawn in 3D (see view3d.js).

export const CATEGORIES = [
  { id: 'base', name: 'Base cabinets' },
  { id: 'wall', name: 'Wall cabinets' },
  { id: 'tall', name: 'Tall units' },
  { id: 'appliance', name: 'Appliances' },
  { id: 'sink', name: 'Sinks' },
  { id: 'furniture', name: 'Furniture' },
];

const FRONT = '#f2efe8';
const STEEL = '#c9ccd0';

export const CATALOG = [
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
];

const BY_TYPE = new Map(CATALOG.map((c) => [c.type, c]));

export function catalogEntry(type) {
  return BY_TYPE.get(type);
}

/** Objects that sit on the floor against a wall and get a worktop. */
export const COUNTERTOP_STYLES = new Set(['base', 'drawers', 'sink', 'sink2', 'hob', 'dishwasher', 'island']);
