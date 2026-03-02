export interface CrewAccessUser {
  username: string;
  displayName: string;
}

export interface CrewAccessSession {
  username: string;
  displayName: string;
  issuedAt: number;
  expiresAt: number;
}

export const CREW_ACCESS_SESSION_KEY = "puskesmas:crew-access:v1";
export const CREW_ACCESS_COOKIE_NAME = "puskesmas_crew_session";
export const CREW_ACCESS_SESSION_TTL_SECONDS = 60 * 60 * 12;
