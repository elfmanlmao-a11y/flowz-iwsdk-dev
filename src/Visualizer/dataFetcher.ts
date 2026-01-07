import { PlayerData } from './types';

export class DataFetcher {
  constructor(
    private dataUrl: "https://flowz-iwsdk-dev.onrender.com",
    private useMock: boolean,
    private debugMode: boolean = false
  ) {}

  private getMock(): PlayerData[] {
    return [
      { name: 'P1', x: 1983.85, y: -9436.94, z: 2688.65, velocity: { x: 50, y: 0, z: 30 } },
      { name: 'P2', x: 9215.21, y: 9232.86, z: -11263.97, velocity: { x: -20, y: 40, z: 0 } },
    ];
  }

  async fetch(): Promise<PlayerData[]> {
    if (this.useMock) return this.getMock();

    try {
      const res = await fetch(this.dataUrl, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.players ?? [];
    } catch (e) {
      if (this.debugMode) console.error('Data fetch failed', e);
      return [];
    }
  }
}