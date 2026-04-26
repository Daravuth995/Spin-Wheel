export const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxKSDSZm-iM9dTqT_noZ_EC1DV-lFcIinJGt-2sIdBCcWbfahyx_8uOKsEbenaeQMKa/exec";

export interface Prize {
  Emoji: string;
  PrizeName: string;
  RewardPoints: number;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  name?: string;
  points?: number;
}

export interface SlotConfigResponse {
  spinCost: number;
  prizes: Prize[];
}

export interface SpinResponse {
  success: boolean;
  message?: string;
  emoji?: string;
  prize?: string;
  change?: number;
  remaining?: number;
  hitJackpot?: boolean;
}

export interface RestrictionResponse {
  message?: string;
}

async function postForm<T>(payload: Record<string, string>): Promise<T> {
  const formData = new FormData();
  for (const [k, v] of Object.entries(payload)) {
    formData.append(k, v);
  }
  const res = await fetch(ENDPOINT, { method: "POST", body: formData });
  return res.json() as Promise<T>;
}

export function login(id: string, password: string) {
  return postForm<LoginResponse>({ action: "login", id, password });
}

export function getSlotConfig() {
  return postForm<SlotConfigResponse>({ action: "getSlotConfig" });
}

export function handleCardGame(id: string, password: string) {
  return postForm<SpinResponse>({
    action: "handleCardGame",
    id,
    password,
  });
}

export function getRestrictionMessage(id: string) {
  return postForm<RestrictionResponse>({
    action: "getRestrictionMessage",
    id,
  });
}
