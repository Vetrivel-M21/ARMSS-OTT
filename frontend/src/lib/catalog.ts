export type Maturity = "U" | "PG" | "13+" | "16+" | "18+" | "A";
export type TitleKind = "film" | "series" | "documentary" | "live";
export type Badge = "4K" | "HDR" | "Atmos" | "IMAX" | "AD" | "CC" | "Tamil" | "Telugu" | "Hindi";
export type Language = "Tamil" | "Telugu" | "Hindi" | "English" | "Multi";
export type Tone =
  | "ice"
  | "fog"
  | "signal"
  | "ember"
  | "orbit"
  | "choir"
  | "marble"
  | "velvet"
  | "mesa"
  | "after"
  | "ink"
  | "forest"
  | "copper"
  | "court"
  | "bloom"
  | "sky"
  | "moss"
  | "pixel"
  | "live";

export type Person = { name: string; role: string };

export type Episode = {
  id: string;
  season: number;
  number: number;
  title: string;
  runtime: number;
  synopsis: string;
};

export type Title = {
  id: string;
  title: string;
  kind: TitleKind;
  year: number;
  maturity: Maturity;
  runtimeMin: number;
  seasons?: number;
  genres: string[];
  logline: string;
  synopsis: string;
  match: number;
  badges: Badge[];
  language?: Language;
  poster?: string;
  backdrop?: string;
  trailer?: string;
  tone: Tone;
  letter: string;
  featured?: boolean;
  rank?: number;
  trending?: boolean;
  fresh?: boolean;
  original?: boolean;
  required_tier?: "free" | "standard" | "premium";
  videoUrl?: string;
  comingSoon?: { date: string; label: string };
  kids?: boolean;
  live?: { channel: string; sport: string };
  cast: Person[];
  director?: string;
  creators?: string[];
  episodes?: Episode[];
  similar: string[];
};

function eps(
  prefix: string,
  season: number,
  items: [string, number, string][],
): Episode[] {
  return items.map(([title, runtime, synopsis], i) => ({
    id: `${prefix}-s${season}e${i + 1}`,
    season,
    number: i + 1,
    title,
    runtime,
    synopsis,
  }));
}

export const DEFAULT_SAMPLE_TRAILERS: Record<string, string> = {
  vikram: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  master: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "ponniyin-selvan-1": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "ponniyin-selvan-2": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "soorarai-pottru": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "jai-bhim": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "sarpatta-parambarai": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "suzhal-vortex": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "chutti-chutties": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "sun-tv-live": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  leo: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  jailer: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  vettaiyan: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
};

const RAW_STATIC_TITLES: Title[] = [
  {
    id: "vikram",
    title: "Vikram",
    kind: "film",
    year: 2022,
    maturity: "A",
    runtimeMin: 174,
    genres: ["Action", "Thriller"],
    logline: "A special agent is sent to investigate a series of masked killings — and uncovers a conspiracy that shakes the state.",
    synopsis: "Retired cop Amar teams up with a lethal special agent Vikram to dismantle a drug cartel run by an enigmatic gangster. Kamal Haasan delivers a career-defining performance in Lokesh Kanagaraj's explosive action universe film.",
    match: 99,
    badges: ["4K", "HDR", "Atmos", "CC"],
    language: "Tamil",
    tone: "ember",
    letter: "V",
    featured: true,
    rank: 1,
    trending: true,
    original: true,
    director: "Lokesh Kanagaraj",
    cast: [
      { name: "Kamal Haasan", role: "Vikram" },
      { name: "Fahadh Faasil", role: "Santhanam" },
      { name: "Vijay Sethupathi", role: "Rolex" },
    ],
    similar: ["master", "vettaiyan", "jailer", "leo"],
  },
  {
    id: "master",
    title: "Master",
    kind: "film",
    year: 2021,
    maturity: "A",
    runtimeMin: 179,
    genres: ["Action", "Drama", "Thriller"],
    logline: "A college professor with a troubled past squares off against a ruthless gangster in a juvenile detention centre.",
    synopsis: "JD, an alcoholic professor, is sent to oversee a juvenile detention facility where Bhavani, a vicious gangster, is using children as weapons. Thalapathy Vijay's mass entertainer directed by Lokesh Kanagaraj.",
    match: 97,
    badges: ["4K", "HDR", "CC"],
    language: "Tamil",
    tone: "velvet",
    letter: "M",
    featured: true,
    rank: 2,
    trending: true,
    original: true,
    director: "Lokesh Kanagaraj",
    cast: [
      { name: "Vijay", role: "JD" },
      { name: "Vijay Sethupathi", role: "Bhavani" },
      { name: "Malavika Mohanan", role: "Charulatha" },
    ],
    similar: ["vikram", "leo", "beast", "vettaiyan"],
  },
  {
    id: "ponniyin-selvan-1",
    title: "Ponniyin Selvan: I",
    kind: "film",
    year: 2022,
    maturity: "PG",
    runtimeMin: 167,
    genres: ["Historical", "Drama", "Epic"],
    logline: "A warrior-spy races across the Chola empire to unmask a conspiracy threatening the royal throne.",
    synopsis: "Based on Kalki Krishnamurthy's beloved Tamil novel, this Mani Ratnam epic follows Vallavaraiyan Vandiyathevan as he navigates royal intrigue, war, and betrayal across a magnificent Chola kingdom. An ARMSS Original production.",
    match: 98,
    badges: ["4K", "HDR", "Atmos", "IMAX", "CC"],
    language: "Tamil",
    tone: "marble",
    letter: "P",
    featured: true,
    rank: 3,
    trending: true,
    original: true,
    director: "Mani Ratnam",
    cast: [
      { name: "Vikram", role: "Aditya Karikalan" },
      { name: "Karthi", role: "Vandiyathevan" },
      { name: "Jayam Ravi", role: "Arulmozhi Varman" },
      { name: "Trisha", role: "Kundavai" },
      { name: "Aishwarya Lekshmi", role: "Poonguzhali" },
    ],
    similar: ["ponniyin-selvan-2", "soorarai-pottru", "jai-bhim", "vikram"],
  },
  {
    id: "ponniyin-selvan-2",
    title: "Ponniyin Selvan: II",
    kind: "film",
    year: 2023,
    maturity: "PG",
    runtimeMin: 152,
    genres: ["Historical", "Drama", "Epic"],
    logline: "The Chola prince Arulmozhi Varman rises to claim his destiny as the future Raja Raja Cholan.",
    synopsis: "The conclusion of Mani Ratnam's grand Chola epic. Conspiracies deepen, alliances shift, and the fate of the empire rests on one man's choice between ambition and dharma. A visual masterpiece.",
    match: 96,
    badges: ["4K", "HDR", "Atmos", "IMAX", "CC"],
    language: "Tamil",
    tone: "marble",
    letter: "P",
    featured: true,
    rank: 4,
    original: true,
    director: "Mani Ratnam",
    cast: [
      { name: "Vikram", role: "Aditya Karikalan" },
      { name: "Jayam Ravi", role: "Arulmozhi Varman" },
      { name: "Karthi", role: "Vandiyathevan" },
      { name: "Aishwarya Rai", role: "Nandini" },
    ],
    similar: ["ponniyin-selvan-1", "soorarai-pottru", "vikram", "jai-bhim"],
  },
  {
    id: "soorarai-pottru",
    title: "Soorarai Pottru",
    kind: "film",
    year: 2020,
    maturity: "PG",
    runtimeMin: 153,
    genres: ["Drama", "Biographical"],
    logline: "A determined man from rural Tamil Nadu fights to bring affordable air travel to ordinary Indians.",
    synopsis: "Inspired by the life of Captain G.R. Gopinath, founder of Air Deccan. Maara fights the system, his own class barriers, and a powerful airline mogul to fulfil his dream. A stirring, award-winning drama.",
    match: 97,
    badges: ["4K", "HDR", "CC", "AD"],
    language: "Tamil",
    tone: "sky",
    letter: "S",
    featured: true,
    rank: 5,
    trending: true,
    original: true,
    director: "Sudha Kongara",
    cast: [
      { name: "Suriya", role: "Nedumaaran Rajangam (Maara)" },
      { name: "Aparna Balamurali", role: "Bommi" },
      { name: "Paresh Rawal", role: "Paresh Goswami" },
    ],
    similar: ["jai-bhim", "sarpatta-parambarai", "96", "vikram"],
  },
  {
    id: "jai-bhim",
    title: "Jai Bhim",
    kind: "film",
    year: 2021,
    maturity: "16+",
    runtimeMin: 164,
    genres: ["Legal Drama", "Social"],
    logline: "A fearless lawyer takes on the Tamil Nadu police to find a missing tribal man and expose custodial torture.",
    synopsis: "Based on a true 1995 legal case. Advocate Chandru fights for Sengeni, a Irula tribal woman whose husband vanished after police custody. A powerful, unflinching indictment of caste violence and judicial courage.",
    match: 99,
    badges: ["4K", "HDR", "CC", "AD"],
    language: "Tamil",
    tone: "signal",
    letter: "J",
    featured: true,
    rank: 6,
    trending: true,
    original: true,
    director: "T.J. Gnanavel",
    cast: [
      { name: "Suriya", role: "Advocate Chandru" },
      { name: "Lijomol Jose", role: "Sengeni" },
      { name: "Manikandan", role: "Rajakannu" },
    ],
    similar: ["soorarai-pottru", "sarpatta-parambarai", "96", "vikram"],
  },
  {
    id: "sarpatta-parambarai",
    title: "Sarpatta Parambarai",
    kind: "film",
    year: 2021,
    maturity: "16+",
    runtimeMin: 173,
    genres: ["Sports", "Drama", "Action"],
    logline: "In 1970s North Madras, a young boxer fights for honour — and for his clan's survival in the boxing ring.",
    synopsis: "Kabilan, a reluctant boxer, rises through the brutal boxing culture of 1970s Madras. Set against the political rivalry between two clans — Sarpatta and Idiyappa — this Pa. Ranjith film is a thundering period epic.",
    match: 96,
    badges: ["4K", "HDR", "CC"],
    language: "Tamil",
    tone: "copper",
    letter: "S",
    rank: 7,
    trending: true,
    original: true,
    director: "Pa. Ranjith",
    cast: [
      { name: "Arya", role: "Kabilan" },
      { name: "Pasupathi", role: "Rangan Vaathiyar" },
      { name: "Dushara Vijayan", role: "Mary" },
    ],
    similar: ["jai-bhim", "soorarai-pottru", "vettaiyan", "vikram"],
  },
  {
    id: "vettaiyan",
    title: "Vettaiyan",
    kind: "film",
    year: 2024,
    maturity: "A",
    runtimeMin: 170,
    genres: ["Action", "Thriller", "Social"],
    logline: "A veteran police officer wages a one-man war against a broken judicial system to protect the innocent.",
    synopsis: "Adhikesavan, a powerful senior police officer, takes the law into his own hands when the courts fail the people. A thought-provoking action thriller by T.J. Gnanavel, starring Rajinikanth at his reflective best.",
    match: 95,
    badges: ["4K", "HDR", "Atmos", "CC"],
    language: "Tamil",
    tone: "forest",
    letter: "V",
    featured: true,
    rank: 8,
    trending: true,
    fresh: true,
    original: true,
    director: "T.J. Gnanavel",
    cast: [
      { name: "Rajinikanth", role: "Adhikesavan" },
      { name: "Fahadh Faasil", role: "Deputy CM" },
      { name: "Rana Daggubati", role: "SP Vetri" },
    ],
    similar: ["jailer", "vikram", "jai-bhim", "leo"],
  },
  {
    id: "jailer",
    title: "Jailer",
    kind: "film",
    year: 2023,
    maturity: "A",
    runtimeMin: 168,
    genres: ["Action", "Comedy", "Thriller"],
    logline: "A retired jailer comes back into action when his son, a policeman, goes missing in a dangerous drug bust.",
    synopsis: "Tiger Muthuvel Pandian, a retired jailer, is forced out of retirement when his son is killed. He hunts down the gangster empire responsible. Superstar Rajinikanth in a mass entertainer by Nelson Dilipkumar.",
    match: 93,
    badges: ["4K", "HDR", "Atmos", "CC"],
    language: "Tamil",
    tone: "ember",
    letter: "J",
    rank: 9,
    trending: true,
    fresh: true,
    original: true,
    director: "Nelson Dilipkumar",
    cast: [
      { name: "Rajinikanth", role: "Tiger Muthuvel Pandian" },
      { name: "Mohanlal", role: "Muthuvel Pandian" },
      { name: "Shivarajkumar", role: "Varma" },
    ],
    similar: ["vettaiyan", "vikram", "master", "leo"],
  },
  {
    id: "96",
    title: "96",
    kind: "film",
    year: 2018,
    maturity: "PG",
    runtimeMin: 158,
    genres: ["Romance", "Drama"],
    logline: "Two childhood sweethearts reunite at a school reunion — and the memories of first love flood back.",
    synopsis: "Ram and Janu, childhood lovers separated by time and circumstance, meet again at their 30th school reunion. A gentle, heartbreaking portrait of nostalgia and the love that never fully leaves us. C. Prem Kumar's debut masterpiece.",
    match: 99,
    badges: ["HDR", "CC", "AD"],
    language: "Tamil",
    tone: "bloom",
    letter: "9",
    rank: 10,
    fresh: true,
    original: true,
    director: "C. Prem Kumar",
    cast: [
      { name: "Vijay Sethupathi", role: "Ram" },
      { name: "Trisha Krishnan", role: "Janu" },
    ],
    similar: ["soorarai-pottru", "jai-bhim", "mersal", "bigil"],
  },
  {
    id: "mersal",
    title: "Mersal",
    kind: "film",
    year: 2017,
    maturity: "PG",
    runtimeMin: 167,
    genres: ["Action", "Drama", "Masala"],
    logline: "A doctor-turned-magician uncovers the corrupt network that destroyed his father — and takes devastating revenge.",
    synopsis: "Three characters, one actor. Vijay plays a dual role — a vengeful underworld magician and an idealistic doctor — both hunting the same corrupt politician. Director Atlee's blockbuster on the broken healthcare system.",
    match: 91,
    badges: ["4K", "HDR", "CC"],
    language: "Tamil",
    tone: "velvet",
    letter: "M",
    trending: true,
    original: true,
    director: "Atlee",
    cast: [
      { name: "Vijay", role: "Vetrimaaran / Maaran / Daniel" },
      { name: "S.J. Suryah", role: "Nalan" },
      { name: "Samantha", role: "Sathya" },
    ],
    similar: ["bigil", "theri", "master", "beast"],
  },
  {
    id: "bigil",
    title: "Bigil",
    kind: "film",
    year: 2019,
    maturity: "PG",
    runtimeMin: 179,
    genres: ["Sports", "Action", "Drama"],
    logline: "A gangster's son coaches a women's football team to the national championship — while settling old scores.",
    synopsis: "Michael (Vijay) balances his underworld legacy and a mission to lead a women's football team to glory. Director Atlee delivers a crowd-pleasing sports drama with powerful messages about women's empowerment.",
    match: 89,
    badges: ["4K", "HDR", "CC"],
    language: "Tamil",
    tone: "forest",
    letter: "B",
    original: true,
    director: "Atlee",
    cast: [
      { name: "Vijay", role: "Michael / Rayappan" },
      { name: "Nayanthara", role: "Coach Angela" },
    ],
    similar: ["mersal", "master", "theri", "sarpatta-parambarai"],
  },
  {
    id: "theri",
    title: "Theri",
    kind: "film",
    year: 2016,
    maturity: "PG",
    runtimeMin: 171,
    genres: ["Action", "Family", "Thriller"],
    logline: "A police officer hiding his identity must resurface to protect his daughter and bring down a ruthless politician.",
    synopsis: "Joseph Kuruvilla, a superintending police officer in witness protection, is forced to reveal himself when his daughter is threatened. Vijay + Atlee deliver a family-friendly action film with powerful emotional beats.",
    match: 88,
    badges: ["4K", "CC"],
    language: "Tamil",
    tone: "sky",
    letter: "T",
    original: true,
    director: "Atlee",
    cast: [
      { name: "Vijay", role: "Joseph Kuruvilla" },
      { name: "Amy Jackson", role: "Mahathi" },
    ],
    similar: ["bigil", "mersal", "master", "jailer"],
  },
  {
    id: "beast",
    title: "Beast",
    kind: "film",
    year: 2022,
    maturity: "A",
    runtimeMin: 153,
    genres: ["Action", "Comedy"],
    logline: "A rogue RAW agent is trapped inside a mall taken over by terrorists — and wipes them out, one floor at a time.",
    synopsis: "Veera Raghavan, a traumatised RAW agent, accidentally becomes the hostages' only hope when terrorists seize a Chennai mall. Nelson Dilipkumar's genre-blending commercial entertainer.",
    match: 84,
    badges: ["4K", "HDR", "CC"],
    language: "Tamil",
    tone: "ember",
    letter: "B",
    director: "Nelson Dilipkumar",
    cast: [
      { name: "Vijay", role: "Veera Raghavan" },
      { name: "Selvaraghavan", role: "RAW Chief" },
    ],
    similar: ["master", "mersal", "jailer", "vikram"],
  },
  {
    id: "leo",
    title: "Leo",
    kind: "film",
    year: 2023,
    maturity: "A",
    runtimeMin: 164,
    genres: ["Action", "Thriller"],
    logline: "A mild-mannered cafe owner in a hill station is hunted by a drug cartel — and turns out to be someone they should fear.",
    synopsis: "Parthiban, a quiet family man, is mistaken for a dangerous criminal. What unfolds reveals his true past — and an unstoppable fury. Lokesh Kanagaraj's LCU continues with Vijay at its centre.",
    match: 92,
    badges: ["4K", "HDR", "Atmos", "CC"],
    language: "Tamil",
    tone: "forest",
    letter: "L",
    trending: true,
    fresh: true,
    original: true,
    director: "Lokesh Kanagaraj",
    cast: [
      { name: "Vijay", role: "Parthiban / Leo Das" },
      { name: "Sanjay Dutt", role: "Harold Das" },
      { name: "Trisha", role: "Sathya" },
    ],
    similar: ["vikram", "master", "vettaiyan", "jailer"],
  },
  {
    id: "suzhal-vortex",
    title: "Suzhal – The Vortex",
    kind: "series",
    year: 2022,
    maturity: "16+",
    runtimeMin: 45,
    seasons: 2,
    genres: ["Crime", "Thriller", "Drama"],
    logline: "A young woman disappears during a village festival — and two cops uncover a web of ancient secrets.",
    synopsis: "Set in a fictional Tamil Nadu temple town during festival season, Suzhal is Amazon Prime's landmark Tamil original. Two detectives investigate a missing person case that spirals into a dark conspiracy rooted in caste, ritual, and power.",
    match: 97,
    badges: ["4K", "HDR", "CC", "AD"],
    language: "Tamil",
    tone: "forest",
    letter: "S",
    featured: true,
    trending: true,
    fresh: true,
    original: true,
    creators: ["Pushkar", "Gayatri"],
    cast: [
      { name: "Kathir", role: "Sakkarai" },
      { name: "Aishwarya Rajesh", role: "Nithya" },
      { name: "Sriya Reddy", role: "Radha" },
    ],
    episodes: eps("suzhal", 1, [
      ["Malai Malar", 46, "A girl vanishes on the last night of the festival. The town carries on."],
      ["The Pit", 44, "A body surfaces near the temple pond. Nithya and Sakkarai disagree."],
      ["Fire Walk", 47, "The festival's darkest ritual hides a witness."],
      ["The Informer", 43, "A local politician's aide knows more than he admits."],
      ["Deep Root", 48, "Caste, land, and a decades-old crime converge."],
      ["Vortex", 52, "The truth unravels in the temple courtyard."],
    ]),
    similar: ["erpatha-nimidam", "thiravam", "jai-bhim", "vettaiyan"],
  },
  {
    id: "erpatha-nimidam",
    title: "Erumbu",
    kind: "series",
    year: 2023,
    maturity: "13+",
    runtimeMin: 38,
    seasons: 1,
    genres: ["Drama", "Family"],
    logline: "A struggling middle-class family in Chennai fights to keep their house — and their dignity.",
    synopsis: "Murugan, a factory worker, faces layoff as his eldest daughter prepares for NEET. An intimate portrait of aspirational Tamil Nadu — chawl politics, school pressure, and the weight of being the first in the family to dream big.",
    match: 93,
    badges: ["HDR", "CC", "AD"],
    language: "Tamil",
    tone: "copper",
    letter: "E",
    trending: true,
    original: true,
    creators: ["Manoj Beedha"],
    cast: [
      { name: "Thambi Ramaiah", role: "Murugan" },
      { name: "Lijomol Jose", role: "Kavitha" },
    ],
    episodes: eps("erumbu", 1, [
      ["Iruppu Nilai", 37, "The factory announces retrenchment. Murugan hides the letter."],
      ["Hall Ticket", 38, "NEET exam day. The auto-rickshaw breaks down."],
      ["Notice", 36, "An eviction notice arrives at the chawl."],
      ["The Interview", 40, "Murugan attends a job interview in a different city."],
      ["Vazhikatti", 39, "The family weighs leaving Chennai forever."],
    ]),
    similar: ["suzhal-vortex", "jai-bhim", "96", "soorarai-pottru"],
  },
  {
    id: "thiravam",
    title: "Thiravam",
    kind: "series",
    year: 2024,
    maturity: "16+",
    runtimeMin: 50,
    seasons: 1,
    genres: ["Political", "Thriller"],
    logline: "A whistleblower inside the Tamil Nadu bureaucracy goes public — and a ruthless administration closes in.",
    synopsis: "IAS officer Kavitha Devi leaks classified files about a dam construction scam. The next 72 hours become a race between justice and the state machinery determined to silence her. A tight political thriller.",
    match: 91,
    badges: ["4K", "HDR", "CC"],
    language: "Tamil",
    tone: "signal",
    letter: "T",
    fresh: true,
    original: true,
    creators: ["Arivazhagan Venkatachalam"],
    cast: [
      { name: "Aditi Balan", role: "Kavitha Devi" },
      { name: "Prashanth", role: "Minister Ravi Kumar" },
    ],
    episodes: eps("thiravam", 1, [
      ["The File", 50, "Kavitha photographs the classified report."],
      ["Leak", 48, "The document is published by midnight. Two phones ring at once."],
      ["Hunt", 52, "The surveillance net tightens around the district collector's office."],
      ["Evidence", 49, "A key witness agrees to speak — then disappears."],
      ["Verdict", 54, "The High Court bench reconvenes under extraordinary pressure."],
    ]),
    similar: ["suzhal-vortex", "jai-bhim", "vettaiyan", "erpatha-nimidam"],
  },
  {
    id: "rajini-legend",
    title: "Rajinikanth: The Legend of Superstar",
    kind: "documentary",
    year: 2023,
    maturity: "PG",
    runtimeMin: 92,
    genres: ["Documentary", "Biography"],
    logline: "From Bangalore bus conductor to the god of Indian cinema — the full, unfiltered story of Superstar Rajinikanth.",
    synopsis: "Through rare archival footage, interviews with Mani Ratnam, Shankar, S.P. Balasubrahmanyam and family members, this documentary traces Rajinikanth's astonishing journey from poverty to becoming the most beloved film star in South Asia.",
    match: 95,
    badges: ["4K", "HDR", "CC", "AD"],
    language: "Tamil",
    tone: "ember",
    letter: "R",
    trending: true,
    fresh: true,
    original: true,
    director: "Prashanth Neel",
    cast: [{ name: "Rajinikanth", role: "Himself" }],
    similar: ["vettaiyan", "jailer", "vikram", "soorarai-pottru"],
  },
  {
    id: "nalladhu-nadakkum",
    title: "Nalladhu Nadakkum",
    kind: "documentary",
    year: 2024,
    maturity: "U",
    runtimeMin: 78,
    genres: ["Documentary", "Culture"],
    logline: "A journey through Tamil Nadu's living traditions — from Jallikattu arenas to Carnatic kutcheris.",
    synopsis: "Shot across eight months in Madurai, Thanjavur, Kanyakumari, and the Nilgiris, this documentary celebrates the cultural heartbeat of Tamil Nadu — ancient rituals, folk arts, street food, and the people keeping them alive.",
    match: 90,
    badges: ["4K", "HDR", "CC", "AD"],
    language: "Tamil",
    tone: "bloom",
    letter: "N",
    original: true,
    fresh: true,
    director: "Leena Manimekalai",
    cast: [{ name: "Leena Manimekalai", role: "Director" }],
    similar: ["rajini-legend", "soorarai-pottru", "96", "jai-bhim"],
  },
  {
    id: "sun-tv-live",
    title: "Sun TV Live",
    kind: "live",
    year: 2026,
    maturity: "PG",
    runtimeMin: 120,
    genres: ["Entertainment", "Live"],
    logline: "Tamil Nadu's number one GEC — live serials, news, and prime time entertainment.",
    synopsis: "ARMSS Sport brings you Sun TV's live prime time feed including mega serials, game shows, and breaking Tamil Nadu news as it happens.",
    match: 80,
    badges: ["HDR", "CC"],
    language: "Tamil",
    tone: "live",
    letter: "S",
    trending: true,
    live: { channel: "ARMSS Live 1", sport: "GEC" },
    cast: [{ name: "Sun TV Anchors", role: "Hosts" }],
    similar: ["vijay-tv-live", "kalaignar-live", "ipl-live"],
  },
  {
    id: "vijay-tv-live",
    title: "Vijay TV Live",
    kind: "live",
    year: 2026,
    maturity: "PG",
    runtimeMin: 120,
    genres: ["Entertainment", "Live"],
    logline: "Bigg Boss Tamil, Super Singer, and more — live from STAR Vijay.",
    synopsis: "Watch Vijay TV's popular reality shows and serials live on ARMSS. From Bigg Boss Tamil eviction night to Super Singer finals — watch it as it happens.",
    match: 78,
    badges: ["HDR"],
    language: "Tamil",
    tone: "live",
    letter: "V",
    live: { channel: "ARMSS Live 2", sport: "GEC" },
    cast: [{ name: "Vijay TV Hosts", role: "Hosts" }],
    similar: ["sun-tv-live", "kalaignar-live", "ipl-live"],
  },
  {
    id: "ipl-live",
    title: "IPL 2026 — Live Cricket",
    kind: "live",
    year: 2026,
    maturity: "U",
    runtimeMin: 210,
    genres: ["Sports", "Live"],
    logline: "The Indian Premier League — live ball-by-ball action with expert commentary.",
    synopsis: "ARMSS Sport presents IPL 2026. Chennai Super Kings vs Mumbai Indians. Full match coverage with Tamil commentary, ball-by-ball updates, and expert analysis from former internationals.",
    match: 85,
    badges: ["4K", "HDR", "Atmos", "CC"],
    language: "Tamil",
    tone: "live",
    letter: "I",
    trending: true,
    live: { channel: "ARMSS Sport", sport: "Cricket" },
    cast: [
      { name: "Tamil Commentary Team", role: "Commentators" },
      { name: "Dinesh Karthik", role: "Expert" },
    ],
    similar: ["tnpl-live", "sun-tv-live", "vijay-tv-live"],
  },
  {
    id: "tnpl-live",
    title: "TNPL 2026 — Tamil Nadu Premier League",
    kind: "live",
    year: 2026,
    maturity: "U",
    runtimeMin: 180,
    genres: ["Sports", "Live"],
    logline: "Tamil Nadu's biggest T20 cricket tournament — live.",
    synopsis: "ARMSS Sport presents TNPL 2026. District-based teams, local heroes, and passionate crowds make this the most exciting domestic cricket in Tamil Nadu. All matches live.",
    match: 76,
    badges: ["4K", "CC"],
    language: "Tamil",
    tone: "live",
    letter: "T",
    live: { channel: "ARMSS Sport 2", sport: "Cricket" },
    cast: [{ name: "TNPL Commentary", role: "Commentators" }],
    similar: ["ipl-live", "sun-tv-live"],
  },
  {
    id: "kalaignar-live",
    title: "Kalaignar TV Live",
    kind: "live",
    year: 2026,
    maturity: "PG",
    runtimeMin: 120,
    genres: ["Entertainment", "Live"],
    logline: "Political debate, Tamil news and cultural programming — live.",
    synopsis: "ARMSS Live brings Kalaignar TV's prime time feed — political discussions, Tamil Nadu assembly updates, and cultural shows.",
    match: 72,
    badges: ["CC"],
    language: "Tamil",
    tone: "live",
    letter: "K",
    live: { channel: "ARMSS Live 3", sport: "News & GEC" },
    cast: [{ name: "Kalaignar Anchors", role: "Hosts" }],
    similar: ["sun-tv-live", "vijay-tv-live", "ipl-live"],
  },
  {
    id: "chutti-chutties",
    title: "Chutti Chutties",
    kind: "series",
    year: 2024,
    maturity: "U",
    runtimeMin: 22,
    seasons: 1,
    genres: ["Family", "Comedy"],
    logline: "Three mischievous kids in a Chennai apartment block solve neighbourhood mysteries together.",
    synopsis: "Anu, Vimal, and Chinnu — neighbours aged 7-10 — form the Chutti Detective Agency. Every episode is a self-contained mystery solved with curiosity, teamwork, and plenty of kozhukattai. Made for Tamil kids.",
    match: 96,
    badges: ["HDR", "CC", "AD"],
    language: "Tamil",
    tone: "sky",
    letter: "C",
    kids: true,
    original: true,
    fresh: true,
    creators: ["ARMSS Kids Studio"],
    cast: [
      { name: "Anu", role: "Voice" },
      { name: "Vimal", role: "Voice" },
      { name: "Chinnu", role: "Voice" },
    ],
    episodes: eps("chutti", 1, [
      ["Kayabam Enna?", 22, "The terrace garden's tomatoes keep vanishing."],
      ["Missing Cycle", 21, "Vimal's new cycle disappears on Pongal day."],
      ["The Secret Drawer", 23, "An old house reveals a locked box."],
      ["Colour Contest", 22, "Someone is copying Anu's kolam designs."],
      ["Night of the Kite", 24, "A kite gets stuck — and leads somewhere wonderful."],
    ]),
    similar: ["naattu-kili", "pillai-pesu", "nalladhu-nadakkum"],
  },
  {
    id: "naattu-kili",
    title: "Naattu Kili",
    kind: "series",
    year: 2025,
    maturity: "U",
    runtimeMin: 18,
    seasons: 2,
    genres: ["Family", "Nature"],
    logline: "A sparrow from a Chennai park makes friends with animals from across Tamil Nadu.",
    synopsis: "Kili the sparrow sets off from Nungambakkam Park to find her missing friend — meeting a temple elephant in Madurai, a fishing cat near Pichavaram, and a sea turtle in Rameswaram. Beautiful animation celebrating Tamil Nadu's wildlife.",
    match: 97,
    badges: ["HDR", "CC", "AD"],
    language: "Tamil",
    tone: "moss",
    letter: "N",
    kids: true,
    original: true,
    creators: ["ARMSS Kids Studio"],
    cast: [
      { name: "Kili", role: "Voice" },
      { name: "Gajendra", role: "Voice" },
    ],
    similar: ["chutti-chutties", "pillai-pesu", "nalladhu-nadakkum"],
  },
  {
    id: "pillai-pesu",
    title: "Pillai Pesu",
    kind: "series",
    year: 2026,
    maturity: "U",
    runtimeMin: 15,
    seasons: 1,
    genres: ["Family", "Educational"],
    logline: "Tamil letters, numbers, and colours come alive as friendly characters in every episode.",
    synopsis: "A preschool learning series where each Tamil letter is a character with a story, a sound, and a friendship. Gentle pacing, bright colour, and simple Tamil for ages 3-6.",
    match: 94,
    badges: ["HDR", "CC"],
    language: "Tamil",
    tone: "pixel",
    letter: "P",
    kids: true,
    original: true,
    fresh: true,
    creators: ["ARMSS Kids Studio"],
    cast: [{ name: "Akshara", role: "Voice" }],
    similar: ["naattu-kili", "chutti-chutties"],
  },
  {
    id: "varisu",
    title: "Varisu",
    kind: "film",
    year: 2023,
    maturity: "PG",
    runtimeMin: 164,
    genres: ["Family", "Drama", "Action"],
    logline: "A carefree youngest son must step up to save his billionaire family's crumbling business empire.",
    synopsis: "Vijay Rajendran, the youngest son of a business tycoon, returns home after years away and must battle jealous half-brothers, corporate rivals, and his own reluctance to lead. A warm family drama with trademark Vijay energy.",
    match: 86,
    badges: ["4K", "HDR", "CC"],
    language: "Tamil",
    tone: "marble",
    letter: "V",
    director: "Vamshi Paidipally",
    cast: [
      { name: "Vijay", role: "Vijay Rajendran" },
      { name: "Rashmika Mandanna", role: "Meenakshi" },
    ],
    similar: ["bigil", "mersal", "theri", "master"],
  },
  {
    id: "thalaivar-169",
    title: "Thalaivar 169",
    kind: "film",
    year: 2026,
    maturity: "A",
    runtimeMin: 0,
    genres: ["Action", "Drama"],
    logline: "Rajinikanth's 169th film — a landmark untitled project from director Prashanth Neel.",
    synopsis: "The most awaited Tamil film of 2026. Details under wraps. What is known: Rajinikanth, Prashanth Neel, a period backdrop, and a score by Ravi Basrur. Releasing exclusively on ARMSS OTT.",
    match: 0,
    badges: ["4K", "HDR", "Atmos", "IMAX"],
    language: "Tamil",
    tone: "ember",
    letter: "T",
    original: true,
    comingSoon: { date: "2026-12-25", label: "25 December 2026" },
    director: "Prashanth Neel",
    cast: [{ name: "Rajinikanth", role: "Lead" }],
    similar: ["vettaiyan", "jailer", "vikram"],
  },
  {
    id: "kanguva",
    title: "Kanguva",
    kind: "film",
    year: 2026,
    maturity: "A",
    runtimeMin: 0,
    genres: ["Action", "Historical", "Fantasy"],
    logline: "A warrior from an ancient kingdom and a bounty hunter in the present share one destiny across centuries.",
    synopsis: "Director Siva's massive pan-India epic starring Suriya in a dual timeline — one set in an ancient Tamil kingdom, one in the modern world. VFX-heavy, grandly scaled, and releasing on ARMSS OTT.",
    match: 0,
    badges: ["4K", "HDR", "Atmos", "IMAX"],
    language: "Tamil",
    tone: "mesa",
    letter: "K",
    original: true,
    comingSoon: { date: "2026-11-14", label: "14 November 2026" },
    director: "Siva",
    cast: [
      { name: "Suriya", role: "Kanguva / François" },
      { name: "Bobby Deol", role: "Villain" },
    ],
    similar: ["ponniyin-selvan-1", "soorarai-pottru", "vikram"],
  },
];

export const INITIAL_STATIC_TITLES: Title[] = RAW_STATIC_TITLES.map((t) => ({
  ...t,
  trailer: t.trailer || DEFAULT_SAMPLE_TRAILERS[t.id] || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
}));

export const TITLES: Title[] = [...INITIAL_STATIC_TITLES];

export const TITLE_BY_ID: Record<string, Title> = Object.fromEntries(
  TITLES.map((t) => [t.id, t]),
);

/**
 * Merges dynamic titles from the Go backend database into the client catalog.
 * Overwrites existing static metadata when backend overrides exist (e.g. tier changes),
 * and dynamically injects new titles added via the Admin CMS.
 */
export function syncBackendTitles(backendTitles: any[]): Title[] {
  if (!backendTitles || !Array.isArray(backendTitles)) return TITLES;

  const titleMap = new Map<string, Title>();
  // 1. Seed with default catalog
  for (const t of INITIAL_STATIC_TITLES) {
    titleMap.set(t.id, { ...t });
  }

  // 2. Merge backend titles
  for (const bt of backendTitles) {
    if (!bt || !bt.id) continue;
    const existing = titleMap.get(bt.id);

    const genres = Array.isArray(bt.genres)
      ? bt.genres
      : typeof bt.genres === "string" && bt.genres
        ? bt.genres.split(",").map((s: string) => s.trim()).filter(Boolean)
        : existing?.genres || ["Action"];

    const badges = Array.isArray(bt.badges)
      ? bt.badges
      : typeof bt.badges === "string" && bt.badges
        ? bt.badges.split(",").map((s: string) => s.trim()).filter(Boolean)
        : existing?.badges || ["HD", "Tamil"];

    const titleStr = bt.title || existing?.title || bt.id;
    const updated: Title = {
      id: bt.id,
      title: titleStr,
      kind: (bt.kind as TitleKind) || existing?.kind || "film",
      year: bt.year || existing?.year || 2024,
      maturity: (bt.maturity as Maturity) || existing?.maturity || "U",
      runtimeMin: bt.runtime_min || existing?.runtimeMin || 120,
      match: bt.match || bt.match_percent || existing?.match || 95,
      logline: bt.logline || existing?.logline || "",
      synopsis: bt.synopsis || existing?.synopsis || bt.logline || "",
      poster: bt.poster || existing?.poster || "/posters/default.jpg",
      backdrop: bt.backdrop || existing?.backdrop || bt.poster || "/backdrops/default.jpg",
      trailer: bt.trailer || existing?.trailer || DEFAULT_SAMPLE_TRAILERS[bt.id] || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
      tone: (bt.tone as Tone) || existing?.tone || "ember",
      letter: titleStr.charAt(0).toUpperCase(),
      original: bt.original !== undefined ? Boolean(bt.original) : existing?.original ?? false,
      kids: bt.kids !== undefined ? Boolean(bt.kids) : existing?.kids ?? false,
      required_tier: (bt.required_tier || existing?.required_tier || "free") as "free" | "standard" | "premium",
      genres,
      badges: badges as Badge[],
      cast: existing?.cast || [],
      director: existing?.director || "",
      creators: existing?.creators,
      episodes: existing?.episodes,
      seasons: existing?.seasons,
      comingSoon: existing?.comingSoon,
      featured: existing?.featured ?? (!existing ? true : false),
      rank: existing?.rank,
      trending: existing?.trending ?? (!existing ? true : false),
      fresh: existing?.fresh ?? (!existing ? true : false),
      similar: existing?.similar || ["vikram", "master", "ponniyin-selvan-1"],
    };

    titleMap.set(bt.id, updated);
  }

  // Update exported arrays in-place so all callers and references stay live
  TITLES.length = 0;
  TITLES.push(...Array.from(titleMap.values()));

  for (const k of Object.keys(TITLE_BY_ID)) {
    delete TITLE_BY_ID[k];
  }
  for (const [id, t] of titleMap.entries()) {
    TITLE_BY_ID[id] = t;
  }

  return TITLES;
}

export const GENRES = [
  "Action",
  "Drama",
  "Thriller",
  "Romance",
  "Historical",
  "Comedy",
  "Family",
  "Sports",
  "Social",
  "Legal Drama",
  "Documentary",
  "Political",
  "Biography",
  "Entertainment",
  "Live",
] as const;

export type ProfileId = "arjun" | "kids";

export function getTitle(id: string) {
  return TITLE_BY_ID[id];
}

export function isKidsSafe(t: Title) {
  return t.kids || t.maturity === "U" || (t.maturity === "PG" && t.kind !== "live");
}

export function visibleTitles(profile: ProfileId | null) {
  if (profile === "kids") return TITLES.filter((t) => t.kids);
  return TITLES.filter((t) => !t.comingSoon && !t.kids);
}

export function comingSoon() {
  return TITLES.filter((t) => t.comingSoon);
}

export function liveNow() {
  return TITLES.filter((t) => t.kind === "live");
}

export function searchTitles(q: string, profile: ProfileId | null) {
  const query = q.trim().toLowerCase();
  const pool = profile === "kids" ? TITLES.filter((t) => t.kids) : TITLES;
  if (!query) return pool.filter((t) => !t.comingSoon);
  return pool.filter((t) => {
    const hay = [
      t.title,
      t.logline,
      t.synopsis,
      t.kind,
      t.language,
      t.director,
      ...(t.creators ?? []),
      ...t.genres,
      ...t.cast.map((c) => c.name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(query);
  });
}

export function similarTitles(t: Title, profile: ProfileId | null) {
  const ids = t.similar;
  return ids
    .map(getTitle)
    .filter((x): x is Title => Boolean(x))
    .filter((x) => (profile === "kids" ? x.kids : !x.kids || x.id === t.id));
}

export const TONE_CLASS: Record<Tone, string> = {
  ice: "bg-tone-ice",
  fog: "bg-tone-fog",
  signal: "bg-tone-signal",
  ember: "bg-tone-ember",
  orbit: "bg-tone-orbit",
  choir: "bg-tone-choir",
  marble: "bg-tone-marble",
  velvet: "bg-tone-velvet",
  mesa: "bg-tone-mesa",
  after: "bg-tone-after",
  ink: "bg-tone-ink",
  forest: "bg-tone-forest",
  copper: "bg-tone-copper",
  court: "bg-tone-court",
  bloom: "bg-tone-bloom",
  sky: "bg-tone-sky",
  moss: "bg-tone-moss",
  pixel: "bg-tone-pixel",
  live: "bg-tone-live",
};

export function kindLabel(kind: TitleKind) {
  if (kind === "film") return "Film";
  if (kind === "series") return "Web Series";
  if (kind === "documentary") return "Documentary";
  return "Live";
}
