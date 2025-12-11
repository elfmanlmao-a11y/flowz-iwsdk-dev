export type RiotPlatform =
  | 'NA1' | 'BR1' | 'EUN1' | 'EUW1' | 'KR' | 'LA1' | 'LA2' | 'OC1' | 'TR1' | 'RU' | 'JP1' | 'PH2' | 'SG2' | 'TH2' | 'TW2' | 'VN2' | 'AMERICAS' | 'ASIA' | 'EUROPE';

export interface RiotSummoner {
  id: string; // encryptedSummonerId
  accountId: string;
  puuid: string;
  name: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

export interface RiotSpectatorParticipant {
  teamId: number;
  summonerId: string; // encryptedSummonerId
  summonerName: string;
  championId: number;
  spell1Id: number;
  spell2Id: number;
  bot: boolean;
  perks?: any;
}

export interface RiotCurrentGameInfo {
  gameId: number;
  mapId: number;
  gameMode: string;
  gameType: string;
  gameQueueConfigId?: number;
  participants: RiotSpectatorParticipant[];
}
