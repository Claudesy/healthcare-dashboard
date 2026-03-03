import "server-only";

interface CrewUser {
  username: string;
  password: string;
  displayName: string;
  role: string;
}

export const CREW_USERS: CrewUser[] = [
  { username: "ferdi-balowerti", password: "Balowerti#8", displayName: "Ferdi Balowerti", role: "KEPALA_PUSKESMAS" },
  { username: "ferdi", password: "fer123456", displayName: "dr. Ferdi Iskandar", role: "DOKTER" },
  { username: "joseph", password: "jos123456", displayName: "Joseph Arianto", role: "DOKTER" },
  { username: "cahyo", password: "cah123456", displayName: "Tri Cahyo", role: "PERAWAT" },
  { username: "efildan", password: "efi123456", displayName: "Efildan", role: "PERAWAT" },
];
