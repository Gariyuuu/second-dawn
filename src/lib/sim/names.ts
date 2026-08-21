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

// Names coined on the planet — drawn from local landmarks, weather, and colony
// vocabulary rather than Earth ancestry. Later generations increasingly use these.
export const OFFWORLD_MALE_NAMES = [
  "Ardo", "Vesk", "Calen", "Torin", "Rhen", "Marrow", "Oshen", "Dray",
  "Kell", "Sunder", "Bram", "Corvane", "Aleth", "Fenn", "Halo", "Rook",
];

export const OFFWORLD_FEMALE_NAMES = [
  "Vell", "Ashen", "Sera", "Lume", "Ondra", "Wren", "Cindre", "Maren",
  "Talla", "Sable", "Ivree", "Nova", "Ryne", "Solen", "Delve", "Peregrine",
];

// Surnames that come from work, place, or an ancestor's deed rather than Earth lineage.
export const OFFWORLD_SURNAME_ROOTS = [
  "Dustborn", "Farrow", "Longwater", "Ridgewalk", "Emberkeep", "Stonecut",
  "Firstfield", "Highmast", "Ashfall", "Deepwell", "Quietvale", "Ironhand",
];

export function generateOffworldName(
  sex: "male" | "female",
  pick: <T>(arr: readonly T[]) => T,
  inheritedSurname?: string
) {
  const first = sex === "male" ? pick(OFFWORLD_MALE_NAMES) : pick(OFFWORLD_FEMALE_NAMES);
  return `${first} ${inheritedSurname ?? pick(OFFWORLD_SURNAME_ROOTS)}`;
}
