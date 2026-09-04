import { backendApi } from './api';
import {
  EcosystemResponse,
  GachaPullResponse,
  CodexResponse,
  UserFish
} from '../types';

/**
 * Fetch current user ecosystem state, water health, and living fishes
 */
export async function fetchEcosystem(): Promise<EcosystemResponse> {
  return backendApi.get<EcosystemResponse>('/api/ecosystem');
}

/**
 * Drop food flake or super pellet into the ecosystem
 */
export async function feedEcosystem(foodType: 'flake' | 'super_pellet'): Promise<EcosystemResponse> {
  return backendApi.post<EcosystemResponse>('/api/ecosystem/feed', { food_type: foodType });
}

/**
 * Pull gacha (1 or 10 dives)
 */
export async function pullGacha(count: 1 | 10): Promise<GachaPullResponse> {
  return backendApi.post<GachaPullResponse>('/api/gacha/pull', { count });
}

/**
 * Fetch complete Marine Codex collection progress
 */
export async function fetchCodex(): Promise<CodexResponse> {
  return backendApi.get<CodexResponse>('/api/gacha/codex');
}

/**
 * Update fish nickname or favorite status
 */
export async function updateFish(
  fishId: number,
  data: { nickname?: string; is_favorite?: boolean }
): Promise<UserFish> {
  return backendApi.patch<UserFish>(`/api/ecosystem/fishes/${fishId}`, data);
}

export const ecosystemService = {
  fetchEcosystem,
  feedEcosystem,
  pullGacha,
  fetchCodex,
  updateFish
};

export default ecosystemService;
