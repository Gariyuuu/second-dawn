// Mission roster drawn from a plausible international crew (Earth's last diverse cross-section).
export const MALE_FIRST_NAMES = [
  "James", "Wei", "Arjun", "Kwame", "Mateo", "Noah", "Sione", "Dmitri", "Kenji",
  "Elias", "Tomás", "Rafael", "Omar", "Andrei", "Hiroshi", "Sami", "Lucas",
  "Idris", "Viktor", "Amadi", "Tane", "Felix", "Kaveh", "Bilal", "Sven",
  "Nikolai", "Diego", "Ravi", "Chidi", "Gustavo", "Yusuf", "Aleksander",
];

export const FEMALE_FIRST_NAMES = [
  "Amara", "Yuki", "Sofia", "Priya", "Elena", "Naledi", "Mei", "Isabela",
  "Freya", "Layla", "Ingrid", "Aroha", "Chiara", "Zainab", "Noor", "Katarina",
  "Ana", "Fatima", "Saoirse", "Ingrid", "Malia", "Rina", "Camila", "Thandiwe",
  "Yasmin", "Petra", "Ines", "Amaya", "Leilani", "Sana", "Ottilie",
];

export const SURNAMES = [
  "Voss", "Okafor", "Nakamura", "Rossi", "Petrov", "Silva", "Adeyemi",
  "Kowalski", "Nguyen", "Haddad", "Larsen", "Moreau", "Singh", "Baptiste",
  "Kimura", "Reyes", "Fischer", "Osei", "Torres", "Yang", "Kaur", "Novak",
  "Andersson", "Diallo", "Marchetti", "Ibrahim", "Sato", "Costa", "Lindqvist",
  "Malik", "Popescu", "Chen",
];

export function generateFullName(sex: "male" | "female", pick: <T>(arr: readonly T[]) => T) {
  const first = sex === "male" ? pick(MALE_FIRST_NAMES) : pick(FEMALE_FIRST_NAMES);
  const last = pick(SURNAMES);
  return `${first} ${last}`;
}
