const BASE_URL = "https://flowz-iwsdk-dev.onrender.com";

export async function startReplayRecording() {
  await fetch(`${BASE_URL}/replay/start`, { method: "POST" });
}

export async function stopReplayRecording() {
  await fetch(`${BASE_URL}/replay/stop`, { method: "POST" });
}

export async function listReplays() {
  const res = await fetch(`${BASE_URL}/replay/list`);
  return res.json();
}

export async function loadReplay(id: string) {
  const res = await fetch(`${BASE_URL}/replay/${id}`);
  return res.json();
}
