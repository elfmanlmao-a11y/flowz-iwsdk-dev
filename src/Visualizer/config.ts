import { PlayerVisualizerConfig, RequiredConfig } from './types';

export function createConfig(userCfg: Partial<PlayerVisualizerConfig> = {}): RequiredConfig {
  return {
    dataUrl: userCfg.dataUrl ?? 'https://flowz-iwsdk-dev.onrender.com/data',
    useMock: userCfg.useMock ?? false,
    updateInterval: userCfg.updateInterval ?? 100,
    playerRadius: userCfg.playerRadius ?? 1,
    playerColor: userCfg.playerColor ?? 0xff0000,
    debugMode: userCfg.debugMode ?? false,
    boundingBox: userCfg.boundingBox,
    showBounds: userCfg.showBounds ?? false,
    labelHeight: userCfg.labelHeight ?? 5,
    labelFontSize: userCfg.labelFontSize ?? 5,
    labelColor: userCfg.labelColor ?? 0x00ff00,
    trailEnabled: userCfg.trailEnabled ?? true,
    trailLength: userCfg.trailLength ?? 40,
    trailOpacity: userCfg.trailOpacity ?? 0.9,
    trailWidth: userCfg.trailWidth ?? 0.4,
  };
}