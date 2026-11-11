import type { AnyCircuitElement } from "circuit-json"

// Minimal geometry, not a motor model: a tall part under a 28 mm board and a
// second part beyond its edge. OBJ dimensions are deliberately absent from CAD
// metadata, as they are for imported motor models in real assemblies.
const boxObj = [
  "v -10 -10 -30",
  "v 10 -10 -30",
  "v 10 10 -30",
  "v -10 10 -30",
  "v -10 -10 30",
  "v 10 -10 30",
  "v 10 10 30",
  "v -10 10 30",
  "f 1 3 2",
  "f 1 4 3",
  "f 5 6 7",
  "f 5 7 8",
  "f 1 2 6",
  "f 1 6 5",
  "f 2 3 7",
  "f 2 7 6",
  "f 3 4 8",
  "f 3 8 7",
  "f 4 1 5",
  "f 4 5 8",
].join("\n")

export const tallAssembly: AnyCircuitElement[] = [
  {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 0, y: 0 },
    width: 28,
    height: 28,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  },
  {
    type: "cad_component",
    cad_component_id: "tall-part",
    source_component_id: "tall-part-source",
    model_obj_url: `data:text/plain,${encodeURIComponent(boxObj)}`,
    model_board_normal_direction: "z+",
    model_origin_position: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: -32 },
    rotation: { x: 0, y: 0, z: 0 },
    model_object_fit: "contain_within_bounds",
    anchor_alignment: "center",
  },
  {
    type: "cad_component",
    cad_component_id: "off-board-part",
    source_component_id: "off-board-source",
    model_obj_url: `data:text/plain,${encodeURIComponent(boxObj.replace(/^v (\S+) (\S+) (\S+)$/gm, (_, x, y, z) => `v ${Number(x) * 0.6} ${y} ${Number(z) / 6}`))}`,
    model_board_normal_direction: "z+",
    model_origin_position: { x: 0, y: 0, z: 0 },
    position: { x: 42, y: 0, z: 6 },
    size: { x: 12, y: 20, z: 10 },
    rotation: { x: 0, y: 0, z: 0 },
    model_object_fit: "contain_within_bounds",
    anchor_alignment: "center",
  },
]
