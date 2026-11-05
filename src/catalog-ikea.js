// IKEA kitchen range: ~100 popular items, drawn with our own parametric models.
// Names are IKEA product names; sizes are in cm and follow IKEA's published standard
// sizes (METOD frames: base 80 cm + 8 cm legs + 3.8 cm worktop ≈ 92 cm, wall 37 cm deep,
// high cabinets 228 cm incl. legs). Appliance and furniture sizes are rounded to the
// nearest cm from IKEA listings and can differ slightly between countries and versions.
//
// Extra fields used here:
//   brand / series  shown in the library and searchable
//   label           short text drawn on the 2D plan
//   look            options for the 3D model (see BUILDERS in view3d.js)

const WHITE = '#f4f3ef';
const GREY = '#9aa1a6';
const STEEL = '#c9ccd0';
const BLACK = '#2b2d31';
const OAK = '#c49a6c';
const BIRCH = '#d9b98c';
const WALNUT = '#6f4e37';
const STONE_WHITE = '#e8e6e1';
const STONE_DARK = '#4a4c4f';

const BASE_H = 92; // 80 frame + 8 legs + 3.8 worktop, rounded
const WALL_D = 37;
const TALL_H = 228;
const WALL_TOP = 228; // wall cabinets line up with the top of the high cabinets

const items = [];
// Generic appliances without an IKEA name are listed with the range but not branded.
const GENERIC = new Set(['Freestanding', 'Countertop', 'Quartz']);
const add = (series, type, name, rest) => items.push({
  ...(GENERIC.has(series) ? {} : { brand: 'IKEA', series }), type: `ikea-${type}`, name, ...rest,
});

// ---------- METOD base cabinets ----------
for (const w of [20, 30, 40, 60, 80]) {
  add('METOD', `metod-base-${w}`, `METOD base cabinet ${w}, shelves`, {
    category: 'base', label: `Base ${w}`, w, d: 60, h: BASE_H, style: 'base', color: WHITE,
    look: { cols: w >= 80 ? 2 : 1 },
  });
}
for (const w of [40, 60, 80]) {
  add('METOD/MAXIMERA', `metod-2dr-${w}`, `METOD base cabinet ${w}, 2 drawers`, {
    category: 'base', label: `${w} 2 drw`, w, d: 60, h: BASE_H, style: 'drawers', color: WHITE, look: { rows: 2 },
  });
  add('METOD/MAXIMERA', `metod-3dr-${w}`, `METOD base cabinet ${w}, 3 drawers`, {
    category: 'base', label: `${w} 3 drw`, w, d: 60, h: BASE_H, style: 'drawers', color: WHITE, look: { rows: 3 },
  });
}
for (const w of [40, 60]) {
  add('METOD/MAXIMERA', `metod-4dr-${w}`, `METOD base cabinet ${w}, 4 drawers`, {
    category: 'base', label: `${w} 4 drw`, w, d: 60, h: BASE_H, style: 'drawers', color: WHITE, look: { rows: 4 },
  });
}
add('METOD', 'metod-pullout-20', 'METOD base cabinet 20, pull-out', {
  category: 'base', label: 'Pull-out 20', w: 20, d: 60, h: BASE_H, style: 'base', color: WHITE,
});
add('METOD', 'metod-wire-40', 'METOD base cabinet 40, wire baskets', {
  category: 'base', label: 'Baskets 40', w: 40, d: 60, h: BASE_H, style: 'drawers', color: WHITE, look: { rows: 1 },
});
add('METOD', 'metod-corner-128', 'METOD corner base cabinet 128×68', {
  category: 'base', label: 'Corner 128', w: 128, d: 68, h: BASE_H, style: 'blindcorner', color: WHITE,
});
add('METOD', 'metod-corner-88', 'METOD corner base cabinet 88×88, carousel', {
  category: 'base', label: 'Corner 88', w: 88, d: 88, h: BASE_H, style: 'corner', color: WHITE,
});
add('METOD', 'metod-oven-base-60', 'METOD base cabinet 60 for built-in oven', {
  category: 'base', label: 'Oven base', w: 60, d: 60, h: BASE_H, style: 'ovenbase', color: WHITE,
});
add('METOD', 'metod-hob-base-60', 'METOD base cabinet 60 with induction hob', {
  category: 'base', label: 'Hob base', w: 60, d: 60, h: BASE_H, style: 'hob', color: WHITE, look: { rows: 3 },
});
add('ENHET', 'enhet-base-60', 'ENHET base cabinet 60, 2 doors', {
  category: 'base', label: 'ENHET 60', w: 60, d: 62, h: 79, style: 'base', color: WHITE, look: { cols: 2 },
});
add('ENHET', 'enhet-base-80', 'ENHET base cabinet 80, 2 doors', {
  category: 'base', label: 'ENHET 80', w: 80, d: 62, h: 79, style: 'base', color: WHITE, look: { cols: 2 },
});
add('ENHET', 'enhet-drawers-60', 'ENHET base cabinet 60, 3 drawers', {
  category: 'base', label: 'ENHET drw', w: 60, d: 62, h: 79, style: 'drawers', color: WHITE, look: { rows: 3 },
});
add('KNOXHULT', 'knoxhult-base-120', 'KNOXHULT base cabinet 120, doors and drawer', {
  category: 'base', label: 'KNOXHULT 120', w: 120, d: 61, h: 91, style: 'base', color: GREY, look: { cols: 2, drawer: true },
});
add('KNOXHULT', 'knoxhult-drawers-40', 'KNOXHULT base cabinet 40, drawers', {
  category: 'base', label: 'KNOXHULT drw', w: 40, d: 61, h: 91, style: 'drawers', color: GREY, look: { rows: 3 },
});

// ---------- METOD wall cabinets ----------
for (const w of [20, 30, 40, 60, 80]) {
  add('METOD', `metod-wall-${w}x80`, `METOD wall cabinet ${w}×80, shelves`, {
    category: 'wall', label: `Wall ${w}×80`, w, d: WALL_D, h: 80, elevation: WALL_TOP - 80, style: 'wall', color: WHITE,
    look: { cols: w >= 80 ? 2 : 1 },
  });
}
for (const w of [40, 60, 80]) {
  add('METOD', `metod-wall-${w}x100`, `METOD wall cabinet ${w}×100, shelves`, {
    category: 'wall', label: `Wall ${w}×100`, w, d: WALL_D, h: 100, elevation: 248 - 100, style: 'wall', color: WHITE,
    look: { cols: w >= 80 ? 2 : 1 },
  });
}
for (const w of [60, 80]) {
  add('METOD', `metod-wall-${w}x40`, `METOD wall cabinet ${w}×40, lift-up door`, {
    category: 'wall', label: `Wall ${w}×40`, w, d: WALL_D, h: 40, elevation: WALL_TOP - 40, style: 'wall', color: WHITE,
    look: { cols: 1, lift: true },
  });
  add('METOD', `metod-wall-${w}x60`, `METOD wall cabinet ${w}×60, lift-up door`, {
    category: 'wall', label: `Wall ${w}×60`, w, d: WALL_D, h: 60, elevation: WALL_TOP - 60, style: 'wall', color: WHITE,
    look: { cols: 1, lift: true },
  });
}
for (const [w, hh] of [[40, 80], [80, 80], [40, 100]]) {
  add('METOD', `metod-wall-glass-${w}x${hh}`, `METOD wall cabinet ${w}×${hh}, glass doors`, {
    category: 'wall', label: `Glass ${w}×${hh}`, w, d: WALL_D, h: hh, elevation: (hh === 100 ? 248 : WALL_TOP) - hh,
    style: 'wall', color: WHITE, look: { cols: w >= 80 ? 2 : 1, glass: true },
  });
}
add('METOD', 'metod-wall-corner-68', 'METOD corner wall cabinet 68×68×80', {
  category: 'wall', label: 'Corner wall', w: 68, d: 68, h: 80, elevation: WALL_TOP - 80, style: 'wallcorner', color: WHITE,
});
add('METOD', 'metod-wall-hood-60', 'METOD wall cabinet 60×40 for extractor hood', {
  category: 'wall', label: 'Hood cab', w: 60, d: WALL_D, h: 40, elevation: WALL_TOP - 40, style: 'wall', color: WHITE,
  look: { cols: 1, lift: true },
});
add('KNOXHULT', 'knoxhult-wall-60', 'KNOXHULT wall cabinet 60×75', {
  category: 'wall', label: 'KNOXHULT 60', w: 60, d: 31, h: 75, elevation: 150, style: 'wall', color: GREY, look: { cols: 2 },
});
add('KNOXHULT', 'knoxhult-wall-120', 'KNOXHULT wall cabinet 120×75', {
  category: 'wall', label: 'KNOXHULT 120', w: 120, d: 31, h: 75, elevation: 150, style: 'wall', color: GREY, look: { cols: 2 },
});
add('ENHET', 'enhet-wall-60', 'ENHET wall cabinet 60×75, 2 doors', {
  category: 'wall', label: 'ENHET wall', w: 60, d: 32, h: 75, elevation: 150, style: 'wall', color: WHITE, look: { cols: 2 },
});

// ---------- METOD high cabinets ----------
for (const w of [40, 60, 80]) {
  add('METOD', `metod-high-${w}`, `METOD high cabinet ${w}×228, shelves`, {
    category: 'tall', label: `High ${w}`, w, d: 60, h: TALL_H, style: 'tall', color: WHITE, look: { cols: w >= 80 ? 2 : 1 },
  });
}
add('METOD', 'metod-high-60x208', 'METOD high cabinet 60×208, shelves', {
  category: 'tall', label: 'High 208', w: 60, d: 60, h: 208, style: 'tall', color: WHITE,
});
add('METOD', 'metod-high-pantry-40', 'METOD high cabinet 40, pull-out pantry', {
  category: 'tall', label: 'Pantry 40', w: 40, d: 60, h: TALL_H, style: 'tall', color: WHITE, look: { splits: [] },
});
add('METOD', 'metod-high-fridge-60', 'METOD high cabinet 60 for fridge/freezer', {
  category: 'tall', label: 'Fridge cab', w: 60, d: 60, h: TALL_H, style: 'tall', color: WHITE, look: { splits: [0.42, 0.88] },
});
add('METOD', 'metod-high-oven-60', 'METOD high cabinet 60 for oven', {
  category: 'tall', label: 'Oven tower', w: 60, d: 60, h: TALL_H, style: 'oventower', color: WHITE,
});
add('METOD', 'metod-high-oven-micro-60', 'METOD high cabinet 60 for oven + microwave', {
  category: 'tall', label: 'Oven+micro', w: 60, d: 60, h: TALL_H, style: 'ovenmicro', color: WHITE,
});
add('ENHET', 'enhet-high-60', 'ENHET high cabinet 60×204, 2 doors', {
  category: 'tall', label: 'ENHET high', w: 60, d: 62, h: 204, style: 'tall', color: WHITE,
});

// ---------- appliances ----------
add('LAGAN', 'lagan-fridge-55', 'LAGAN fridge/freezer, freestanding 55', {
  category: 'appliance', label: 'LAGAN fridge', w: 55, d: 57, h: 143, style: 'fridge', color: WHITE, look: { split: 0.68 },
});
add('LAGAN', 'lagan-fridge-60', 'LAGAN fridge/freezer, freestanding 60', {
  category: 'appliance', label: 'LAGAN fridge', w: 60, d: 64, h: 186, style: 'fridge', color: WHITE,
});
add('LAGAN', 'lagan-fridge-small', 'LAGAN fridge with freezer compartment', {
  category: 'appliance', label: 'LAGAN mini', w: 50, d: 51, h: 85, style: 'fridge', color: WHITE, look: { split: 0 },
});
add('FORKYLD', 'forkyld-integrated', 'FORKYLD integrated fridge/freezer', {
  category: 'appliance', label: 'FORKYLD', w: 54, d: 55, h: 177, style: 'tall', color: WHITE, look: { splits: [0.38], plinth: false },
});
add('Freestanding', 'american-fridge', 'American fridge-freezer, side by side', {
  category: 'appliance', label: 'US fridge', w: 91, d: 72, h: 178, style: 'fridge', color: STEEL, look: { sideBySide: true },
});
add('LAGAN', 'lagan-oven', 'LAGAN oven, built-in 60', {
  category: 'appliance', label: 'LAGAN oven', w: 60, d: 56, h: 60, elevation: 82, style: 'oven', color: WHITE,
});
add('MATTRADITION', 'mattradition-oven', 'MATTRADITION oven, built-in 60', {
  category: 'appliance', label: 'Oven', w: 60, d: 56, h: 60, elevation: 82, style: 'oven', color: BLACK,
});
add('FINSMAKARE', 'finsmakare-oven', 'FINSMAKARE oven, built-in 60', {
  category: 'appliance', label: 'Oven', w: 60, d: 56, h: 60, elevation: 82, style: 'oven', color: STEEL,
});
add('LAGAN', 'lagan-hob-ceramic', 'LAGAN ceramic hob 58', {
  category: 'appliance', label: 'Hob', w: 58, d: 51, h: 1, elevation: BASE_H, style: 'hobonly', color: BLACK,
});
add('LAGAN', 'lagan-hob-gas', 'LAGAN gas hob, 4 burners 58', {
  category: 'appliance', label: 'Gas hob', w: 58, d: 50, h: 4, elevation: BASE_H, style: 'hobonly', color: STEEL, look: { gas: true },
});
add('BALANSERAD', 'balanserad-induction-59', 'BALANSERAD induction hob 59', {
  category: 'appliance', label: 'Induction', w: 59, d: 52, h: 1, elevation: BASE_H, style: 'hobonly', color: BLACK,
});
add('MATTRADITION', 'mattradition-induction-78', 'MATTRADITION induction hob 78', {
  category: 'appliance', label: 'Induction 78', w: 78, d: 52, h: 1, elevation: BASE_H, style: 'hobonly', color: BLACK,
});
add('TILLREDA', 'tillreda-portable', 'TILLREDA portable induction hob, 1 zone', {
  category: 'appliance', label: 'TILLREDA', w: 29, d: 36, h: 6, elevation: BASE_H, style: 'hobonly', color: BLACK, look: { zones: 1 },
});
add('LAGAN', 'lagan-dishwasher-60', 'LAGAN integrated dishwasher 60', {
  category: 'appliance', label: 'Dishwasher', w: 60, d: 60, h: BASE_H, style: 'dishwasher', color: WHITE,
});
add('MEDELSTOR', 'medelstor-dishwasher-45', 'MEDELSTOR integrated dishwasher 45', {
  category: 'appliance', label: 'DW 45', w: 45, d: 60, h: BASE_H, style: 'dishwasher', color: WHITE,
});
add('Freestanding', 'dishwasher-free-60', 'Freestanding dishwasher 60', {
  category: 'appliance', label: 'Dishwasher', w: 60, d: 60, h: 85, style: 'appliancebox', color: WHITE, look: { panel: true },
});
add('Freestanding', 'cooker-60', 'Freestanding electric cooker 60', {
  category: 'appliance', label: 'Cooker', w: 60, d: 60, h: 90, style: 'stove', color: WHITE,
});
add('Freestanding', 'range-90', 'Range cooker 90', {
  category: 'appliance', label: 'Range 90', w: 90, d: 60, h: 90, style: 'stove', color: STEEL,
});
add('LUFTIG', 'luftig-hood-60', 'LUFTIG wall-mounted extractor hood 60', {
  category: 'appliance', label: 'Hood 60', w: 60, d: 50, h: 70, elevation: 158, style: 'hood', color: STEEL,
});
add('UNDERVERK', 'underverk-hood-80', 'UNDERVERK wall-mounted extractor hood 80', {
  category: 'appliance', label: 'Hood 80', w: 80, d: 50, h: 70, elevation: 158, style: 'hood', color: STEEL,
});
add('MATTRADITION', 'mattradition-hood-90', 'MATTRADITION wall-mounted extractor hood 90', {
  category: 'appliance', label: 'Hood 90', w: 90, d: 50, h: 70, elevation: 158, style: 'hood', color: BLACK,
});
add('LUFTIG', 'luftig-hood-island', 'LUFTIG island extractor hood 90', {
  category: 'appliance', label: 'Island hood', w: 90, d: 60, h: 80, elevation: 160, style: 'hood', color: STEEL, look: { island: true },
});
add('LUFTIG', 'luftig-hood-integrated', 'LUFTIG integrated extractor hood 60', {
  category: 'appliance', label: 'Integr. hood', w: 60, d: 28, h: 4, elevation: WALL_TOP - 40 - 4, style: 'hoodflat', color: STEEL,
});
add('MATTRADITION', 'mattradition-microwave', 'MATTRADITION microwave, built-in 60', {
  category: 'appliance', label: 'Microwave', w: 60, d: 40, h: 39, elevation: 145, style: 'microwave', color: BLACK,
});
add('VÄRMD', 'varmd-microwave', 'VÄRMD microwave, countertop', {
  category: 'appliance', label: 'Microwave', w: 45, d: 36, h: 26, elevation: BASE_H, style: 'microwave', color: WHITE,
});
add('Countertop', 'kettle', 'Electric kettle', {
  category: 'appliance', label: 'Kettle', w: 22, d: 16, h: 25, elevation: BASE_H, style: 'canister', color: STEEL,
});
add('Countertop', 'coffee-machine', 'Coffee machine', {
  category: 'appliance', label: 'Coffee', w: 24, d: 38, h: 35, elevation: BASE_H, style: 'appliancebox', color: BLACK,
});

// ---------- sinks and taps ----------
add('HAVSEN', 'havsen-60', 'HAVSEN farmhouse sink 1 bowl on METOD 60', {
  category: 'sink', label: 'HAVSEN 60', w: 60, d: 60, h: BASE_H, style: 'apron', color: WHITE,
});
add('HAVSEN', 'havsen-80', 'HAVSEN farmhouse sink 2 bowls on METOD 80', {
  category: 'sink', label: 'HAVSEN 80', w: 80, d: 60, h: BASE_H, style: 'apron', color: WHITE, look: { bowls: 2 },
});
add('METOD', 'metod-sink-60', 'METOD sink base cabinet 60', {
  category: 'sink', label: 'Sink 60', w: 60, d: 60, h: BASE_H, style: 'sink', color: WHITE,
});
add('METOD', 'metod-sink-80', 'METOD sink base cabinet 80', {
  category: 'sink', label: 'Sink 80', w: 80, d: 60, h: BASE_H, style: 'sink', color: WHITE,
});
add('METOD', 'metod-sink-120', 'METOD sink base cabinet 120, 2 bowls', {
  category: 'sink', label: 'Sink 120', w: 120, d: 60, h: BASE_H, style: 'sink2', color: WHITE,
});
add('NORRSJÖN', 'norrsjon-1', 'NORRSJÖN inset sink, 1 bowl', {
  category: 'sink', label: 'Sink', w: 56, d: 46, h: 1, elevation: BASE_H, style: 'sinktop', color: STEEL,
});
add('NORRSJÖN', 'norrsjon-2', 'NORRSJÖN inset sink, 2 bowls', {
  category: 'sink', label: 'Sink 2', w: 78, d: 46, h: 1, elevation: BASE_H, style: 'sinktop', color: STEEL, look: { bowls: 2 },
});
add('BOHOLMEN', 'boholmen-1', 'BOHOLMEN inset sink, 1 bowl with drainer', {
  category: 'sink', label: 'Sink+drain', w: 86, d: 50, h: 1, elevation: BASE_H, style: 'sinktop', color: STEEL, look: { drainer: true },
});
add('FYNDIG', 'fyndig-1', 'FYNDIG inset sink, 1 bowl', {
  category: 'sink', label: 'FYNDIG', w: 46, d: 40, h: 1, elevation: BASE_H, style: 'sinktop', color: STEEL,
});
add('LILLVIKEN', 'lillviken-1', 'LILLVIKEN inset sink, 1 bowl', {
  category: 'sink', label: 'LILLVIKEN', w: 56, d: 46, h: 1, elevation: BASE_H, style: 'sinktop', color: STEEL,
});
add('KILSVIKEN', 'kilsviken-1', 'KILSVIKEN inset sink, 1 bowl, black quartz', {
  category: 'sink', label: 'KILSVIKEN', w: 56, d: 48, h: 1, elevation: BASE_H, style: 'sinktop', color: BLACK,
});
add('GLITTRAN', 'glittran-tap', 'GLITTRAN kitchen mixer tap', {
  category: 'sink', label: 'Tap', w: 6, d: 22, h: 30, elevation: BASE_H, style: 'tap', color: STEEL,
});
add('ÄLMAREN', 'almaren-tap', 'ÄLMAREN kitchen mixer tap', {
  category: 'sink', label: 'Tap', w: 6, d: 22, h: 38, elevation: BASE_H, style: 'tap', color: STEEL,
});
add('LUNDSKÄR', 'lundskar-tap', 'LUNDSKÄR kitchen mixer tap, black', {
  category: 'sink', label: 'Tap', w: 6, d: 22, h: 35, elevation: BASE_H, style: 'tap', color: BLACK,
});

// ---------- worktops ----------
const WT = (series, slug, name, color, lengths, thick = 3.8) => {
  for (const len of lengths) {
    add(series, `${slug}-${len}`, `${name} ${len}×63.5`, {
      category: 'worktop', label: `${series} ${len}`, w: len, d: 63.5, h: thick, elevation: 88.3, style: 'worktop', color,
    });
  }
};
WT('KARLBY', 'karlby-walnut', 'KARLBY worktop, walnut', WALNUT, [186, 246]);
WT('KARLBY', 'karlby-oak', 'KARLBY worktop, oak', OAK, [186, 246]);
WT('EKBACKEN', 'ekbacken-white', 'EKBACKEN worktop, white marble effect', STONE_WHITE, [186, 246], 2.8);
WT('EKBACKEN', 'ekbacken-dark', 'EKBACKEN worktop, dark grey', STONE_DARK, [186, 246], 2.8);
WT('SÄLJAN', 'saljan-white', 'SÄLJAN worktop, white', '#f1f0ec', [186, 246]);
WT('HAMMARP', 'hammarp-birch', 'HAMMARP worktop, birch', BIRCH, [186, 246]);
WT('MÖLLEKULLA', 'mollekulla-oak', 'MÖLLEKULLA worktop, oak', OAK, [186]);
add('SKOGSÅ', 'skogsa-oak-246', 'SKOGSÅ worktop, oak 246×63.5', { category: 'worktop', label: 'SKOGSÅ 246', w: 246, d: 63.5, h: 3.8, elevation: 88.3, style: 'worktop', color: '#b98b5c' });
add('Quartz', 'island-top-quartz', 'Quartz island worktop 200×100', { category: 'worktop', label: 'Island top', w: 200, d: 100, h: 3, elevation: 89, style: 'worktop', color: STONE_WHITE });

// ---------- islands and trolleys ----------
add('VADHOLMA', 'vadholma', 'VADHOLMA kitchen island 126×79', {
  category: 'island', label: 'VADHOLMA', w: 126, d: 79, h: 90, style: 'opentable', color: BLACK, look: { top: OAK, shelves: 1 },
});
add('TORNVIKEN', 'tornviken', 'TORNVIKEN kitchen island 126×77', {
  category: 'island', label: 'TORNVIKEN', w: 126, d: 77, h: 90, style: 'island', color: '#ece7da', look: { top: OAK },
});
add('STENSTORP', 'stenstorp', 'STENSTORP kitchen trolley 79×51', {
  category: 'island', label: 'STENSTORP', w: 79, d: 51, h: 90, style: 'opentable', color: WHITE, look: { top: OAK, shelves: 1 },
});
add('FÖRHÖJA', 'forhoja', 'FÖRHÖJA kitchen trolley 100×43', {
  category: 'island', label: 'FÖRHÖJA', w: 100, d: 43, h: 90, style: 'opentable', color: BIRCH, look: { shelves: 1 },
});
add('BEKVÄM', 'bekvam-trolley', 'BEKVÄM kitchen trolley 58×50', {
  category: 'island', label: 'BEKVÄM', w: 58, d: 50, h: 85, style: 'opentable', color: BIRCH, look: { shelves: 2 },
});
add('RÅSKOG', 'raskog', 'RÅSKOG trolley 35×45', {
  category: 'island', label: 'RÅSKOG', w: 35, d: 45, h: 78, style: 'rack', color: '#3f6f6a', look: { shelves: 3 },
});
add('NISSAFORS', 'nissafors', 'NISSAFORS trolley 50×30', {
  category: 'island', label: 'NISSAFORS', w: 50, d: 30, h: 83, style: 'rack', color: BLACK, look: { shelves: 3 },
});
add('METOD', 'metod-island-180', 'METOD island 180×90, 3 base cabinets', {
  category: 'island', label: 'Island 180', w: 180, d: 90, h: BASE_H, style: 'island', color: WHITE,
});
add('METOD', 'metod-island-240', 'METOD island 240×100 with overhang', {
  category: 'island', label: 'Island 240', w: 240, d: 100, h: BASE_H, style: 'island', color: '#3e5c76', look: { top: STONE_WHITE },
});

// ---------- shelves, rails and storage ----------
add('BOTKYRKA', 'botkyrka-80', 'BOTKYRKA wall shelf 80×20', {
  category: 'storage', label: 'Shelf 80', w: 80, d: 20, h: 4, elevation: 150, style: 'shelf', color: WHITE,
});
add('LACK', 'lack-110', 'LACK wall shelf 110×26', {
  category: 'storage', label: 'Shelf 110', w: 110, d: 26, h: 5, elevation: 150, style: 'shelf', color: BLACK,
});
add('KUNGSFORS', 'kungsfors-shelf-80', 'KUNGSFORS shelf with rail 80', {
  category: 'storage', label: 'Shelf+rail', w: 80, d: 26, h: 15, elevation: 140, style: 'railshelf', color: STEEL,
});
add('HULTARP', 'hultarp-rail-60', 'HULTARP rail 60', {
  category: 'storage', label: 'Rail 60', w: 60, d: 3, h: 3, elevation: 125, style: 'rail', color: STEEL,
});
add('HULTARP', 'hultarp-rail-100', 'HULTARP rail 100', {
  category: 'storage', label: 'Rail 100', w: 100, d: 3, h: 3, elevation: 125, style: 'rail', color: STEEL,
});
add('KUNGSFORS', 'kungsfors-rail-80', 'KUNGSFORS suspension rail 80', {
  category: 'storage', label: 'Rail 80', w: 80, d: 3, h: 3, elevation: 125, style: 'rail', color: STEEL,
});
add('OMAR', 'omar-92', 'OMAR shelving unit 92×36×181', {
  category: 'storage', label: 'OMAR', w: 92, d: 36, h: 181, style: 'rack', color: STEEL, look: { shelves: 5 },
});
add('BROR', 'bror-85', 'BROR shelving unit 85×40×190', {
  category: 'storage', label: 'BROR', w: 85, d: 40, h: 190, style: 'rack', color: BLACK, look: { shelves: 4, top: OAK },
});
add('IVAR', 'ivar-89', 'IVAR shelving unit 89×30×179', {
  category: 'storage', label: 'IVAR', w: 89, d: 30, h: 179, style: 'rack', color: '#d8c3a0', look: { shelves: 5 },
});
add('KALLAX', 'kallax-2x4', 'KALLAX shelving unit 77×39×147', {
  category: 'storage', label: 'KALLAX', w: 77, d: 39, h: 147, style: 'cubes', color: WHITE, look: { cols: 2, rows: 4 },
});
add('HEMNES', 'hemnes-sideboard', 'HEMNES sideboard 157×47×88', {
  category: 'storage', label: 'Sideboard', w: 157, d: 47, h: 88, style: 'base', color: WHITE, look: { cols: 3, countertop: false, drawer: true },
});

// ---------- tables, chairs and stools ----------
add('INGATORP', 'ingatorp', 'INGATORP extendable table 110×78', {
  category: 'furniture', label: 'INGATORP', w: 110, d: 78, h: 74, style: 'table', color: WHITE,
});
add('MELLTORP', 'melltorp', 'MELLTORP table 125×75', {
  category: 'furniture', label: 'MELLTORP', w: 125, d: 75, h: 74, style: 'table', color: WHITE,
});
add('LISABO', 'lisabo-table', 'LISABO table 140×78', {
  category: 'furniture', label: 'LISABO', w: 140, d: 78, h: 74, style: 'table', color: BIRCH,
});
add('EKEDALEN', 'ekedalen', 'EKEDALEN extendable table 120×80', {
  category: 'furniture', label: 'EKEDALEN', w: 120, d: 80, h: 75, style: 'table', color: '#5a3e2b',
});
add('VOXLÖV', 'voxlov', 'VOXLÖV dining table 180×90', {
  category: 'furniture', label: 'VOXLÖV', w: 180, d: 90, h: 74, style: 'table', color: '#cfa06b',
});
add('NORDEN', 'norden', 'NORDEN gateleg table 152×80', {
  category: 'furniture', label: 'NORDEN', w: 152, d: 80, h: 74, style: 'table', color: WHITE,
});
add('DOCKSTA', 'docksta', 'DOCKSTA round table Ø103', {
  category: 'furniture', label: 'DOCKSTA', w: 103, d: 103, h: 75, style: 'roundtable', color: WHITE,
});
add('JOKKMOKK', 'jokkmokk', 'JOKKMOKK table 118×74', {
  category: 'furniture', label: 'JOKKMOKK', w: 118, d: 74, h: 74, style: 'table', color: '#b5875a',
});
add('NORRÅKER', 'norraker-bar', 'NORRÅKER bar table 74×74', {
  category: 'furniture', label: 'Bar table', w: 74, d: 74, h: 102, style: 'table', color: BIRCH,
});
add('TEODORES', 'teodores', 'TEODORES chair', {
  category: 'furniture', label: 'Chair', w: 46, d: 51, h: 80, style: 'chair', color: WHITE,
});
add('ADDE', 'adde', 'ADDE chair', {
  category: 'furniture', label: 'Chair', w: 39, d: 47, h: 77, style: 'chair', color: BLACK,
});
add('STEFAN', 'stefan', 'STEFAN chair', {
  category: 'furniture', label: 'Chair', w: 42, d: 49, h: 90, style: 'chair', color: '#4a3527',
});
add('INGOLF', 'ingolf-chair', 'INGOLF chair', {
  category: 'furniture', label: 'Chair', w: 43, d: 52, h: 91, style: 'chair', color: WHITE,
});
add('LISABO', 'lisabo-chair', 'LISABO chair', {
  category: 'furniture', label: 'Chair', w: 45, d: 51, h: 76, style: 'chair', color: BIRCH,
});
add('ODGER', 'odger', 'ODGER chair', {
  category: 'furniture', label: 'Chair', w: 45, d: 51, h: 81, style: 'chair', color: '#7b8b8e',
});
add('INGOLF', 'ingolf-bar', 'INGOLF bar stool with backrest 63', {
  category: 'furniture', label: 'Bar stool', w: 40, d: 45, h: 91, style: 'chair', color: WHITE, look: { seat: 63 },
});
add('FRANKLIN', 'franklin-bar', 'FRANKLIN bar stool with backrest, foldable 63', {
  category: 'furniture', label: 'Bar stool', w: 44, d: 45, h: 95, style: 'chair', color: BLACK, look: { seat: 63 },
});
add('GLENN', 'glenn-bar', 'GLENN bar stool 66', {
  category: 'furniture', label: 'Bar stool', w: 46, d: 46, h: 77, style: 'stool', color: WHITE,
});
add('STIG', 'stig-bar', 'STIG bar stool 74', {
  category: 'furniture', label: 'Bar stool', w: 36, d: 36, h: 74, style: 'stool', color: BLACK,
});
add('KYRRE', 'kyrre', 'KYRRE stool', {
  category: 'furniture', label: 'Stool', w: 35, d: 35, h: 45, style: 'stool', color: BIRCH,
});
add('FROSTA', 'frosta', 'FROSTA stool', {
  category: 'furniture', label: 'Stool', w: 35, d: 35, h: 45, style: 'stool', color: BIRCH,
});
add('BEKVÄM', 'bekvam-step', 'BEKVÄM step stool', {
  category: 'furniture', label: 'Step stool', w: 43, d: 40, h: 50, style: 'table', color: BIRCH,
});

export const IKEA_CATALOG = items;
