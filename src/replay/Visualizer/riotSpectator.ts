import { RiotPlatform, RiotSpectatorParticipant, RiotCurrentGameInfo, RiotSummoner, RiotMatch, RiotMatchParticipant } from './riotTypes';

function platformToHost(platform: RiotPlatform): string {
  return `${platform.toLowerCase()}.api.riotgames.com`;
}

export class RiotSpectatorClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(host: string, path: string): Promise<T> {
    const url = `https://${host}${path}`;
    const res = await fetch(url, {
      headers: { 'X-Riot-Token': this.apiKey },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Riot API ${res.status} ${res.statusText}: ${text}`);
    }
    return (await res.json()) as T;
  }

  async fetchSummonerByName(platform: RiotPlatform, summonerName: string): Promise<RiotSummoner> {
    const host = platformToHost(platform);
    const path = `/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`;
    return this.request<RiotSummoner>(host, path);
  }

  async fetchActiveGameBySummonerId(platform: RiotPlatform, encryptedSummonerId: string): Promise<RiotCurrentGameInfo> {
    const host = platformToHost(platform);
    const path = `/lol/spectator/v4/active-games/by-summoner/${encodeURIComponent(encryptedSummonerId)}`;
    return this.request<RiotCurrentGameInfo>(host, path);
  }

  async fetchActiveGameBySummonerName(platform: RiotPlatform, summonerName: string): Promise<RiotCurrentGameInfo> {
    const summ = await this.fetchSummonerByName(platform, summonerName);
    return this.fetchActiveGameBySummonerId(platform, summ.id);
  }
}

export interface VisualizerPlayer {
  id: string;
  name: string;
  championId: number;
  teamId: number;
  spells: number[];
  bot: boolean;
}

export function parseCurrentGameToVisualizerPlayers(game: RiotCurrentGameInfo): VisualizerPlayer[] {
  return game.participants.map((p: RiotSpectatorParticipant) => ({
    id: p.summonerId,
    name: p.summonerName,
    championId: p.championId,
    teamId: p.teamId,
    spells: [p.spell1Id, p.spell2Id],
    bot: !!p.bot,
  }));
}

export function parseMatchToVisualizerPlayers(match: RiotMatch): VisualizerPlayer[] {
  return match.info.participants.map((p: RiotMatchParticipant) => ({
    id: p.puuid,
    name: p.summonerName,
    championId: p.championId,
    teamId: p.teamId,
    spells: [], // Match data doesn't include spells; could add from static data if needed
    bot: false,
  }));
}

