// src/mapRotation.ts
import { createComponent, createSystem, Types } from "@iwsdk/core";

const AXES = {
  X: "X",
  Y: "Y",
  Z: "Z",
} as const;

export const Rotation = createComponent("Rotation", {
  speed: { type: Types.Float32, default: 0.05 },
  axis: { type: Types.Enum, enum: AXES, default: AXES.Y },
});

export class MapRotationSystem extends createSystem({
  rotatingEntities: { required: [Rotation] },
}) {
  update(delta: number): void {
    this.queries.rotatingEntities.entities.forEach((entity) => {
      const mesh = entity.object3D;
      if (!mesh || !mesh.visible) return;

      const speed = entity.getValue(Rotation, "speed") as number;
      const axis = entity.getValue(Rotation, "axis") as keyof typeof AXES;

      const rotationAmount = delta * speed;

      if (axis === "Y") {
        mesh.rotateY(rotationAmount);
      } else if (axis === "X") {
        mesh.rotateX(rotationAmount);
      } else if (axis === "Z") {
        mesh.rotateZ(rotationAmount);
      }
    });
  }
}