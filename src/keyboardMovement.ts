import { createSystem } from "@iwsdk/core";
import { Vector3 } from "@iwsdk/core";

export class KeyboardMovementSystem extends createSystem({}) {
  private keys: Set<string> = new Set();
  private forward = new Vector3();
  private right = new Vector3();
  private tmp = new Vector3();
  private enabled = true;

  init() {
    // Listen for keyboard events
    const onKeyDown = (e: KeyboardEvent) => this.keys.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Store listeners so we can remove them on destroy
    (this as any)._km_onKeyDown = onKeyDown;
    (this as any)._km_onKeyUp = onKeyUp;
  }

  update(delta: number) {
    if (!this.enabled) return;

    const camera: any = this.world.camera;
    if (!camera) return;

    // Movement speed meters per second
    const moveSpeed = 2.0;

    // Reset movement vector
    this.tmp.set(0, 0, 0);

    // Get forward (camera's -Z) and compute horizontal forward
    camera.getWorldDirection(this.forward as any);
    this.forward.y = 0;
    this.forward.normalize();

    // Right vector = forward x up
    this.right.crossVectors(this.forward as any, new Vector3(0, 1, 0)).normalize();

    // WASD / arrow keys
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) {
      this.tmp.add(this.forward as any);
    }
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) {
      this.tmp.sub(this.forward as any);
    }
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) {
      this.tmp.sub(this.right as any);
    }
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) {
      this.tmp.add(this.right as any);
    }

    // Vertical movement: Space up, Shift down
    if (this.keys.has("Space")) {
      this.tmp.y += 1;
    }
    if (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) {
      this.tmp.y -= 1;
    }

    if (this.tmp.lengthSq() === 0) return;

    this.tmp.normalize().multiplyScalar(moveSpeed * delta);

    // Apply movement to camera position
    camera.position.add(this.tmp as any);
  }

  destroy() {
    const onKeyDown = (this as any)._km_onKeyDown;
    const onKeyUp = (this as any)._km_onKeyUp;
    if (onKeyDown) window.removeEventListener("keydown", onKeyDown);
    if (onKeyUp) window.removeEventListener("keyup", onKeyUp);
    this.keys.clear();
    this.enabled = false;
  }
}
