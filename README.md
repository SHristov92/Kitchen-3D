# Kitchen 3D

A browser app for planning a kitchen. Draw the room on the left, furnish it from the
object library, and walk through it in 3D on the right.

## Features

- **Room editor (2D plan)**: rectangle, L-shape, alcove and angled presets, or any
  outline you like. Drag corners and walls, double-click a wall to add a corner, click a
  wall to type its exact length. Wall height, thickness and colours are editable.
- **Object library**: about 190 objects in collapsible groups with search (by name, series or
  width, e.g. "METOD 60") and an All / IKEA / Basic filter. It includes about 140 items from the
  IKEA kitchen range (METOD/MAXIMERA, ENHET and KNOXHULT cabinets, appliances, sinks and taps,
  worktops, islands and trolleys, shelving, tables and seating) at their standard sizes, all
  drawn with simple parametric models. Click or drag an object onto the plan; objects snap
  against walls and neighbours. Size, height off the floor, rotation and colour can be changed per object.
- **Doors and windows**: snap into a wall and cut an opening in it in the 3D view. Doors show
  their swing on the plan.
- **3D view**: an overview (walls between you and the room fade out) and a first-person
  walk mode with collision. The orange marker on the plan is where you stand.
- **Projects**: saved automatically in the browser (IndexedDB). Several projects can be
  kept, duplicated and deleted. Export/Import uses a JSON file
  (`*.kitchen.json`) so a plan can be backed up or moved to another computer.
- Undo/redo for every edit.

Live version: https://shristov92.github.io/Kitchen-3D/ (built and deployed by
`.github/workflows/deploy.yml` on every push to `main`; the repo's Pages source must be
set to **GitHub Actions**).

## Running it

```bash
npm install
npm run dev      # development server at http://localhost:5173
npm test         # unit tests (geometry, snapping, project files)
npm run build    # static build in dist/, works from any folder or static host
```

## Ad slot (Google AdSense)

The bottom of the object library has a 250 × 250 ad slot. Until it is set up it shows a
neutral "Ad space" placeholder and loads nothing from Google. To turn it on, create a
fixed-size 250 × 250 display ad unit in AdSense and fill in `ADSENSE` in `src/ads.js`:

```js
export const ADSENSE = {
  client: 'ca-pub-1234567890123456', // publisher ID
  slot: '1234567890',                // ad unit ID
};
```

AdSense also needs the site approved and an `ads.txt` at the domain root, which a GitHub
Pages project site (`username.github.io/Kitchen-3D`) cannot serve on its own.

## Controls

| Where | Action |
| --- | --- |
| Plan | Drag empty space or right-drag to pan, scroll to zoom, `F` to fit |
| Plan | `Delete` removes the selected object or corner, `R` / `Shift+R` rotates, arrows nudge (`Shift` = 10 cm), `Ctrl+D` duplicates |
| Plan | Hold `Alt` while dragging to turn snapping off |
| Walk mode | `W A S D` or arrow keys to move, `Q` / `E` to turn, drag to look, `Shift` to go faster |
| Anywhere | `Ctrl+Z` undo, `Ctrl+Shift+Z` / `Ctrl+Y` redo |

## Project file format

```json
{
  "kind": "kitchen-3d-project",
  "exportedAt": "2026-11-05T10:00:00.000Z",
  "project": {
    "schemaVersion": 1,
    "id": "proj_…",
    "name": "My kitchen",
    "room": {
      "points": [{ "x": 0, "y": 0 }, { "x": 400, "y": 0 }, { "x": 400, "y": 300 }, { "x": 0, "y": 300 }],
      "wallHeight": 260, "wallThickness": 12, "floorColor": "#c8b7a0", "wallColor": "#f4f1ea"
    },
    "items": [
      { "id": "item_…", "type": "base-60", "x": 30, "y": 30, "rotation": 0,
        "w": 60, "d": 60, "h": 90, "elevation": 0, "color": "#f2efe8" }
    ],
    "viewer": { "x": 200, "y": 220, "heading": 180 }
  }
}
```

All lengths are centimetres. The plan uses x to the right and y downwards; an object's
`x`/`y` is its centre, `rotation` is in degrees and its front faces local +y.

## Code layout

| File | Purpose |
| --- | --- |
| `src/main.js` | App start-up, toolbar, autosave, import/export, keyboard |
| `src/editor2d.js` | Canvas plan editor |
| `src/view3d.js` | Three.js scene, overview and walk modes, 3D object models |
| `src/catalog.js` | The object library, doors and windows |
| `src/catalog-ikea.js` | IKEA kitchen items |
| `src/panels.js` | Room, library and selection side panels |
| `src/model.js` | Project data, room presets, validation of imported files |
| `src/geometry.js`, `src/snapping.js` | 2D maths and wall/neighbour snapping |
| `src/storage.js` | IndexedDB persistence |
| `src/store.js` | Current project, selection, undo/redo |
