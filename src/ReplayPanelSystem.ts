import {
  createSystem,
  PanelUI,
  PanelDocument,
  eq,
  UIKitDocument,
  UIKit,
} from "@iwsdk/core";

import {
  startReplayRecording,
  stopReplayRecording
} from "./replayApi";

export class ReplayPanelSystem extends createSystem({
  replayPanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", "/ui/replay.json")],
  },
}) {
  init() {
    this.queries.replayPanel.subscribe("qualify", (entity) => {
      const document = PanelDocument.data.document[entity.index] as UIKitDocument;
      if (!document) return;

      const startBtn = document.getElementById("start-recording") as UIKit.Text;
      const stopBtn = document.getElementById("stop-recording") as UIKit.Text;

      startBtn?.addEventListener("click", async () => {
        console.log("[Replay] Start recording");
        await startReplayRecording();
      });

      stopBtn?.addEventListener("click", async () => {
        console.log("[Replay] Stop recording");
        await stopReplayRecording();
      });
    });
  }
}
