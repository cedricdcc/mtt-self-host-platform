import { backendApi } from "./api";
import { Event, EventTeam, EventStatsResponse } from "../types";

export interface EventSource {
  source_id: number;
  name: string;
  source_type: string;
}

export async function fetchEvents(): Promise<Event[]> {
  return backendApi.get<Event[]>("/events");
}

export async function fetchEventSources(): Promise<EventSource[]> {
  return backendApi.get<EventSource[]>("/events/sources");
}

export async function fetchEventDetails(eventId: string): Promise<Event> {
  return backendApi.get<Event>(`/events/${eventId}`);
}

export async function createEvent(data: {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  sourceId?: string;
  targetLanguage?: string;
  targetCount?: number;
  rewardTitle?: string;
  hasTeams?: boolean;
}): Promise<Event> {
  return backendApi.post<Event>("/events", data);
}

export async function createEventTeam(eventId: string, name: string, imageUrl?: string): Promise<EventTeam> {
  return backendApi.post<EventTeam>(`/events/${eventId}/teams`, { name, imageUrl });
}

export async function updateEventStatus(eventId: string, status: string): Promise<Event> {
  return backendApi.patch<Event>(`/events/${eventId}/status`, { status });
}

export async function joinEventTeam(eventId: string, joinCode: string): Promise<{ success: boolean; teamId: string }> {
  return backendApi.post<{ success: boolean; teamId: string }>(`/events/${eventId}/join`, { joinCode });
}

export async function deleteEvent(eventId: string): Promise<{ success: boolean; message: string }> {
  return backendApi.delete<{ success: boolean; message: string }>(`/events/${eventId}`);
}

export async function deleteTeam(eventId: string, teamId: string): Promise<{ success: boolean; message: string }> {
  return backendApi.delete<{ success: boolean; message: string }>(`/events/${eventId}/teams/${teamId}`);
}

export async function setFeaturedEvent(eventId?: string | null, isFeatured: boolean = true): Promise<{ success: boolean; event: Event | null }> {
  const url = (eventId && eventId !== "none") ? `/events/${eventId}/featured` : `/events/featured`;
  return backendApi.patch<{ success: boolean; event: Event | null }>(url, {
    isFeatured: isFeatured && !!eventId && eventId !== "none",
    eventId: eventId || null,
  });
}

export async function fetchUserTitles(userId: number | string): Promise<import("../types").UserTitle[]> {
  return backendApi.get<import("../types").UserTitle[]>(`/users/${userId}/titles`);
}

export async function equipUserTitle(rewardId: string | null): Promise<{ success: boolean; titles: import("../types").UserTitle[] }> {
  return backendApi.post<{ success: boolean; titles: import("../types").UserTitle[] }>("/users/titles/equip", { rewardId });
}

export async function settleEventRewards(eventId: string): Promise<{ settled: boolean; teamName?: string; awardedCount?: number; userIds?: number[]; reason?: string }> {
  return backendApi.post<{ settled: boolean; teamName?: string; awardedCount?: number; userIds?: number[]; reason?: string }>(`/events/${eventId}/settle`, {});
}

export const fetchEventStats = async (
  eventId: string,
  resolution: string = 'smart',
  userOnly: boolean = false
): Promise<EventStatsResponse> => {
  return backendApi.get<EventStatsResponse>(`/events/${eventId}/stats?resolution=${resolution}&userOnly=${userOnly}`);
};



