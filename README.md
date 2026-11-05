# Kitchen 3D

A browser app for planning a kitchen. Draw the room on the left, furnish it from the
object library, and walk through it in 3D on the right.

## Features

- **Room editor (2D plan)**: rectangle, L-shape, alcove and angled presets, or any
  outline you like. Drag corners and walls, double-click a wall to add a corner, click a
  wall to type its exact length. Wall height, thickness and colours are editable.
- **Object library**: base, wall and tall cabinets, appliances (fridge, cooker, hob,
  dishwasher, hood, microwave), sinks and furniture. Click or drag an object onto the plan;
  it snaps against the nearest wall and lines up with its neighbours. Size, height off the
  floor, rotation and colour can be changed per object.
- **3D view**: an overview (walls between you and the room fade out) and a first-person
  walk mode with collision. The orange marker on the plan is where you stand.
- **Projects**: saved automatically in the browser (IndexedDB). Several projects can be
  kept, duplicated and deleted. Export/Import uses a JSON file
  (`*.kitchen.json`) so a plan can be backed up or moved to another computer.
- Undo/redo for every edit.

## Running it

```bash
npm install
npm run dev      # development server at http://localhost:5173
npm test         # unit tests (geometry, snapping, project files)
npm run build    # static build in dist/, works from any folder or static host
```

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
| `src/catalog.js` | The object library |
| `src/panels.js` | Room, library and selection side panels |
| `src/model.js` | Project data, room presets, validation of imported files |
| `src/geometry.js`, `src/snapping.js` | 2D maths and wall/neighbour snapping |
| `src/storage.js` | IndexedDB persistence |
| `src/store.js` | Current project, selection, undo/redo |
