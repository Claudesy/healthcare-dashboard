import "server-only";

// ⚠️  FILE INI HANYA UNTUK LOCAL DEVELOPMENT
// Production credentials WAJIB diset via env var CREW_ACCESS_USERS_JSON
// Format JSON: [{"username":"...","password":"...","displayName":"...","role":"..."}]
// Jangan pernah commit password nyata ke file ini.

interface CrewUser {
  username: string;
  password: string;
  displayName: string;
  role: string;
}

export const CREW_USERS: CrewUser[] = [
  { username: "ferdi-balowerti", password: "CHANGE_ME_VIA_ENV", displayName: "Ferdi Balowerti", role: "KEPALA_PUSKESMAS" },
  { username: "ferdi", password: "CHANGE_ME_VIA_ENV", displayName: "dr. Ferdi Iskandar", role: "DOKTER" },
  { username: "joseph", password: "CHANGE_ME_VIA_ENV", displayName: "Joseph Arianto", role: "DOKTER" },
  { username: "cahyo", password: "CHANGE_ME_VIA_ENV", displayName: "Tri Cahyo", role: "PERAWAT" },
  { username: "efildan", password: "CHANGE_ME_VIA_ENV", displayName: "Efildan", role: "PERAWAT" },
];
