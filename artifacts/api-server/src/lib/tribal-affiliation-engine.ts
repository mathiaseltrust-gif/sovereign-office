/**
 * Ancestral Tribal Affiliation Logic Engine
 *
 * Given an ancestor record (name, location, time period), this engine:
 *   1. Detects which US state/region the ancestor lived in
 *   2. Applies a historical knowledge base of tribal territories per era
 *   3. Overlays removal acts, treaties, and relocation events active during
 *      their lifetime
 *   4. Produces structured reasoning — which nations, why, what happened
 *
 * Data sources baked into this engine:
 *   - BIA Historical Research Division tribal territory records
 *   - Federal Indian law statutes (25 U.S.C.)
 *   - Treaty cession records (NARA / Kappler's Indian Affairs: Laws & Treaties)
 *   - Indian Removal Act (4 Stat. 411, 1830)
 *   - Dawes Act (24 Stat. 388, 1887)
 *   - Indian Reorganization Act (48 Stat. 984, 1934)
 *   - Native Land Digital (nativeland.ca) regional correlations
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AffiliationMatch {
  tribalNation: string;
  confidence: "confirmed" | "high" | "moderate" | "inferred";
  basis: string;
  activeEra: string;
  removalImpact: string | null;
  treaties: string[];
  survivingCommunity: string | null;
}

export interface RemovalContext {
  event: string;
  year: number | string;
  federalBasis: string;
  impact: string;
  affectedNations: string[];
  originRegion: string;
  destinationRegion: string;
}

export interface TribalAffiliationResult {
  ancestorId: number;
  fullName: string;
  detectedState: string | null;
  detectedRegion: RegionKey | null;
  lifespan: { birth: number | null; death: number | null; estimated: boolean };
  era: string;
  affiliations: AffiliationMatch[];
  removalContext: RemovalContext[];
  reasoning: string[];
  logicSummary: string;
  recommendations: string[];
  confidence: "confirmed" | "high" | "moderate" | "inferred";
  dataSignals: string[];
}

export interface AncestorInput {
  id: number;
  fullName: string;
  birthYear?: number | null;
  deathYear?: number | null;
  tribalNation?: string | null;
  birthPlace?: string | null;
  deathPlace?: string | null;
  locationAddress?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  notes?: string | null;
  generationalPosition?: number | null;
  /** Locations from known descendants — used as corroborating geographic evidence */
  descendantLocations?: string[];
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

type RegionKey =
  | "southeast"
  | "northeast"
  | "great_lakes"
  | "great_plains"
  | "northern_plains"
  | "southwest"
  | "pacific_northwest"
  | "california"
  | "intermountain_west"
  | "alaska"
  | "indian_territory"
  | "appalachia";

interface NationEntry {
  name: string;
  activeFrom: number | null;
  activeTo: number | null;
  notes: string;
  treaties: string[];
  survivingCommunity: string | null;
  removalEventIds: string[];
}

interface RegionEntry {
  label: string;
  states: string[];
  nations: NationEntry[];
}

const REGIONS: Record<RegionKey, RegionEntry> = {
  southeast: {
    label: "Southeastern United States",
    states: ["georgia", "alabama", "mississippi", "tennessee", "south carolina", "florida", "louisiana", "arkansas"],
    nations: [
      {
        name: "Cherokee Nation",
        activeFrom: null,
        activeTo: 1838,
        notes: "Occupied the southern Appalachians and surrounding territories. Removed via Trail of Tears 1838–1839.",
        treaties: ["Treaty of New Echota (1835)", "Treaty of Hopewell (1785)", "Treaty of Holston (1791)"],
        survivingCommunity: "Eastern Band of Cherokee Indians (NC) — those who remained or returned",
        removalEventIds: ["TRAIL_OF_TEARS", "REMOVAL_ACT_1830"],
      },
      {
        name: "Choctaw Nation",
        activeFrom: null,
        activeTo: 1833,
        notes: "First nation removed under the Indian Removal Act. Occupied central and southern Mississippi and western Alabama.",
        treaties: ["Treaty of Dancing Rabbit Creek (1830)", "Treaty of Doak's Stand (1820)"],
        survivingCommunity: "Mississippi Band of Choctaw Indians — those who remained",
        removalEventIds: ["REMOVAL_ACT_1830", "CHOCTAW_REMOVAL"],
      },
      {
        name: "Creek (Muscogee) Nation",
        activeFrom: null,
        activeTo: 1836,
        notes: "Occupied central Alabama and parts of Georgia. Removed under the Treaty of Cusseta (1832) and forcibly expelled 1836.",
        treaties: ["Treaty of Cusseta (1832)", "Treaty of Fort Jackson (1814)"],
        survivingCommunity: "Poarch Band of Creek Indians (AL) — federally recognized surviving community",
        removalEventIds: ["REMOVAL_ACT_1830", "CREEK_REMOVAL"],
      },
      {
        name: "Chickasaw Nation",
        activeFrom: null,
        activeTo: 1837,
        notes: "Occupied northern Mississippi and western Tennessee. Negotiated removal under the Treaty of Pontotoc Creek (1832).",
        treaties: ["Treaty of Pontotoc Creek (1832)", "Treaty of Hopewell (1786)"],
        survivingCommunity: null,
        removalEventIds: ["REMOVAL_ACT_1830", "CHICKASAW_REMOVAL"],
      },
      {
        name: "Seminole Nation",
        activeFrom: null,
        activeTo: 1858,
        notes: "Occupied Florida. Fought three Seminole Wars against removal. Most removed by 1842; a band never surrendered and remains in Florida.",
        treaties: ["Treaty of Payne's Landing (1832)", "Treaty of Fort Gibson (1833)"],
        survivingCommunity: "Seminole Tribe of Florida and Miccosukee Tribe — never surrendered",
        removalEventIds: ["REMOVAL_ACT_1830", "SEMINOLE_WARS"],
      },
      {
        name: "Catawba Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied piedmont Carolina. Maintained reservation in South Carolina through the Treaty of Nation Ford (1840).",
        treaties: ["Treaty of Nation Ford (1840)"],
        survivingCommunity: "Catawba Indian Nation — federally recognized, York County SC",
        removalEventIds: [],
      },
    ],
  },

  appalachia: {
    label: "Appalachian Mountains",
    states: ["north carolina", "virginia", "west virginia", "kentucky"],
    nations: [
      {
        name: "Cherokee Nation (Eastern Band)",
        activeFrom: null,
        activeTo: null,
        notes: "Eastern Band remained in North Carolina mountains through the Qualla Boundary land purchase by Tsali and others who evaded removal.",
        treaties: ["Treaty of New Echota (1835) — Eastern Band refused to recognize"],
        survivingCommunity: "Eastern Band of Cherokee Indians — Qualla Boundary, Cherokee NC",
        removalEventIds: ["TRAIL_OF_TEARS"],
      },
      {
        name: "Shawnee Nation",
        activeFrom: null,
        activeTo: 1831,
        notes: "Historically ranged through Kentucky, Ohio, and Tennessee valleys. Multiple bands removed to Kansas and Oklahoma.",
        treaties: ["Treaty of Fort Finney (1786)", "Treaty of Cape Girardeau (1825)"],
        survivingCommunity: "Shawnee Tribe (OK), Absentee Shawnee, Eastern Shawnee — federally recognized",
        removalEventIds: ["REMOVAL_ACT_1830"],
      },
    ],
  },

  northeast: {
    label: "Northeastern United States",
    states: ["new york", "pennsylvania", "new jersey", "massachusetts", "connecticut", "rhode island", "vermont", "new hampshire", "maine", "maryland", "delaware"],
    nations: [
      {
        name: "Haudenosaunee Confederacy (Iroquois — Seneca, Cayuga, Onondaga, Oneida, Mohawk, Tuscarora)",
        activeFrom: null,
        activeTo: null,
        notes: "The Six Nations Confederacy occupied central and western New York. After the Sullivan-Clinton Campaign (1779) and 1794 Treaty of Canandaigua, most Haudenosaunee were confined to reservations within New York or removed to Canada/Oklahoma.",
        treaties: ["Treaty of Canandaigua (1794)", "Treaty of Paris (1783)"],
        survivingCommunity: "Seneca Nation, Oneida Indian Nation, Onondaga Nation, St. Regis Mohawk — all present-day NY reservations",
        removalEventIds: ["SULLIVAN_CLINTON"],
      },
      {
        name: "Lenape (Delaware) Nation",
        activeFrom: null,
        activeTo: 1860,
        notes: "Original people of the Delaware River valley (Pennsylvania, New Jersey, New York). Multiple forced relocations: PA → OH → IN → KS → OK over 1680–1866.",
        treaties: ["Treaty of Fort Pitt (1778) — first treaty in US history", "Treaty of 1866"],
        survivingCommunity: "Delaware Nation and Delaware Tribe of Indians (OK) — federally recognized",
        removalEventIds: ["LENAPE_FORCED_MIGRATION"],
      },
      {
        name: "Wampanoag Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied coastal Massachusetts and Rhode Island. King Philip's War (1675) was the most devastating conflict in New England's history per capita.",
        treaties: [],
        survivingCommunity: "Wampanoag Tribe of Gay Head (Aquinnah) and Mashpee Wampanoag Tribe — MA",
        removalEventIds: [],
      },
      {
        name: "Abenaki Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied northern New England. Many communities dispersed during colonial wars; significant populations remain in Vermont and Maine.",
        treaties: [],
        survivingCommunity: "Odanak (Quebec), Western Abenaki communities (VT) — many state-recognized",
        removalEventIds: [],
      },
      {
        name: "Mohegan and Pequot Nations",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied Connecticut. The Pequot War (1637) devastated these communities. Surviving members assimilated or maintained small reservation communities.",
        treaties: [],
        survivingCommunity: "Mashantucket Pequot Tribal Nation and Mohegan Tribe — CT, federally recognized",
        removalEventIds: [],
      },
    ],
  },

  great_lakes: {
    label: "Great Lakes Region",
    states: ["michigan", "wisconsin", "minnesota", "illinois", "indiana", "ohio"],
    nations: [
      {
        name: "Ojibwe / Chippewa Nation",
        activeFrom: null,
        activeTo: null,
        notes: "One of the largest Indigenous nations. Occupied the Great Lakes shoreline from Michigan through Wisconsin and Minnesota. Retained treaty-reserved rights to hunt, fish, and gather (affirmed in Mille Lacs v. Minnesota, 1999).",
        treaties: ["Treaty of 1837", "Treaty of La Pointe (1842)", "Treaty of 1854"],
        survivingCommunity: "Multiple federally recognized bands: Red Lake, Leech Lake, White Earth, Fond du Lac, Bad River, Turtle Mountain, and others",
        removalEventIds: ["SANDY_LAKE_TRAGEDY"],
      },
      {
        name: "Potawatomi Nation",
        activeFrom: null,
        activeTo: 1838,
        notes: "Occupied the southern Great Lakes shores (Michigan, Indiana, Illinois, Wisconsin). Forcibly marched to Kansas in 1838 — the Potawatomi Trail of Death.",
        treaties: ["Treaty of Chicago (1833)"],
        survivingCommunity: "Prairie Band Potawatomi (KS), Citizen Potawatomi Nation (OK), Pokagon Band (MI/IN), Forest County Potawatomi (WI)",
        removalEventIds: ["POTAWATOMI_TRAIL_OF_DEATH"],
      },
      {
        name: "Menominee Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied northeast Wisconsin and the upper peninsula of Michigan. Retained their homeland through treaty rights and resisted removal.",
        treaties: ["Treaty of the Cedars (1836)", "Treaty of Lake Poygan (1848)"],
        survivingCommunity: "Menominee Indian Tribe of Wisconsin — federally recognized; federal trust land retained",
        removalEventIds: [],
      },
      {
        name: "Ho-Chunk (Winnebago) Nation",
        activeFrom: null,
        activeTo: 1865,
        notes: "Occupied central Wisconsin and parts of Minnesota. Removed multiple times — to Iowa, then South Dakota, then Nebraska — while many returned to Wisconsin.",
        treaties: ["Treaty of 1837", "Treaty of 1855"],
        survivingCommunity: "Ho-Chunk Nation of Wisconsin and Winnebago Tribe of Nebraska — both federally recognized",
        removalEventIds: ["HO_CHUNK_REMOVAL"],
      },
      {
        name: "Ottawa Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the northern Great Lakes region (Michigan, Ohio, Ontario). Key allies in colonial-era conflicts; some removed to Kansas and Oklahoma after 1833.",
        treaties: ["Treaty of Detroit (1807)", "Treaty of 1833"],
        survivingCommunity: "Little Traverse Bay Bands, Little River Band of Ottawa Indians (MI)",
        removalEventIds: [],
      },
    ],
  },

  great_plains: {
    label: "Southern & Central Great Plains",
    states: ["kansas", "nebraska", "iowa", "missouri", "oklahoma", "texas", "colorado"],
    nations: [
      {
        name: "Osage Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Controlled a vast territory spanning Missouri, Arkansas, Kansas, and Oklahoma. Ceded most lands by treaty and were confined to northeastern Oklahoma by 1870. The Osage became the wealthiest per-capita people in the world after oil was discovered on their allotments.",
        treaties: ["Treaty of 1808", "Treaty of 1825"],
        survivingCommunity: "Osage Nation — Pawhuska, Oklahoma. Federally recognized.",
        removalEventIds: ["DAWES_ACT"],
      },
      {
        name: "Comanche Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Dominated the Southern Plains (Texas, Oklahoma, New Mexico, Kansas) — the Comancheria — from the 1700s through 1875. Confined to reservation in southwestern Oklahoma after the Red River War (1874–75).",
        treaties: ["Medicine Lodge Treaty (1867)"],
        survivingCommunity: "Comanche Nation of Oklahoma — federally recognized",
        removalEventIds: ["RED_RIVER_WAR"],
      },
      {
        name: "Kiowa Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the Southern Plains alongside the Comanche. Allies in resistance to reservation confinement until the Red River War (1874–75).",
        treaties: ["Medicine Lodge Treaty (1867)"],
        survivingCommunity: "Kiowa Tribe of Oklahoma — federally recognized",
        removalEventIds: ["RED_RIVER_WAR"],
      },
      {
        name: "Cheyenne and Arapaho Nations",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the central Great Plains (Colorado, Kansas, Wyoming). Survivors of the Sand Creek Massacre (1864) were eventually confined to Oklahoma and Montana reservations.",
        treaties: ["Fort Wise Treaty (1861)", "Medicine Lodge Treaty (1867)"],
        survivingCommunity: "Cheyenne and Arapaho Tribes (OK), Northern Cheyenne (MT), Northern Arapaho (WY)",
        removalEventIds: ["SAND_CREEK_MASSACRE"],
      },
      {
        name: "Pawnee Nation",
        activeFrom: null,
        activeTo: 1875,
        notes: "Occupied central Nebraska. Ceded Nebraska lands and removed to Indian Territory (Oklahoma) by 1875 under pressure from Sioux raids and US government encroachment.",
        treaties: ["Treaty of 1857"],
        survivingCommunity: "Pawnee Nation of Oklahoma — federally recognized",
        removalEventIds: ["PAWNEE_REMOVAL"],
      },
    ],
  },

  northern_plains: {
    label: "Northern Great Plains",
    states: ["south dakota", "north dakota", "montana", "wyoming"],
    nations: [
      {
        name: "Lakota / Teton Sioux Nation",
        activeFrom: null,
        activeTo: null,
        notes: "The largest division of the Sioux, occupying the Northern Plains from the Black Hills (He Sapa) across the Dakotas. The Fort Laramie Treaties of 1851 and 1868 recognized Lakota territory; the latter was broken when gold was discovered in the Black Hills in 1874.",
        treaties: ["Fort Laramie Treaty (1851)", "Fort Laramie Treaty (1868)", "Black Hills Agreement (1877) — imposed without required consent"],
        survivingCommunity: "Standing Rock, Cheyenne River, Pine Ridge, Rosebud, Crow Creek, Lower Brule, and Flandreau Santee Sioux — SD/ND. All federally recognized.",
        removalEventIds: ["BLACK_HILLS_SEIZURE", "WOUNDED_KNEE"],
      },
      {
        name: "Crow Nation (Apsáalooke)",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the Bighorn River valley in Montana and Wyoming. Retained reservation lands in south-central Montana after the 1868 Fort Laramie Treaty.",
        treaties: ["Fort Laramie Treaty (1851)", "Fort Laramie Treaty (1868)"],
        survivingCommunity: "Crow Nation — Crow Agency, Montana. Federally recognized.",
        removalEventIds: ["DAWES_ACT"],
      },
      {
        name: "Assiniboine (Nakoda) Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied northern Montana and North Dakota. Shared Fort Peck and Fort Belknap reservations with Gros Ventre and Sioux nations.",
        treaties: ["Fort Laramie Treaty (1851)"],
        survivingCommunity: "Fort Belknap Indian Community and Fort Peck Tribes — Montana. Federally recognized.",
        removalEventIds: [],
      },
      {
        name: "Mandan, Hidatsa, and Arikara Nation (Three Affiliated Tribes)",
        activeFrom: null,
        activeTo: null,
        notes: "The Three Affiliated Tribes occupied the Missouri River valley in North Dakota. The Pick-Sloan Act (1944) flooded their most fertile lands with the Garrison Dam.",
        treaties: ["Fort Laramie Treaty (1851)"],
        survivingCommunity: "MHA Nation — Fort Berthold Reservation, North Dakota. Federally recognized.",
        removalEventIds: ["PICK_SLOAN_FLOODING"],
      },
    ],
  },

  southwest: {
    label: "Southwestern United States",
    states: ["arizona", "new mexico", "utah", "nevada", "colorado (south)"],
    nations: [
      {
        name: "Diné (Navajo) Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the Four Corners region. Subjected to the Long Walk to Bosque Redondo (1864–1868), a forced relocation of approximately 9,000 people. Returned under the Treaty of 1868 — one of the few nations to return to their homeland by treaty.",
        treaties: ["Treaty of Bosque Redondo / Treaty of 1868 (15 Stat. 667)"],
        survivingCommunity: "Navajo Nation — largest land area of any reservation in the US (27,000 sq miles). AZ/NM/UT.",
        removalEventIds: ["LONG_WALK_NAVAJO"],
      },
      {
        name: "Pueblo Peoples (Acoma, Zuni, Hopi, Taos, and 19 others)",
        activeFrom: null,
        activeTo: null,
        notes: "Continuous occupation of the Rio Grande valley and surrounding areas for over 1,000 years. Spanish and then US colonial rule attempted to suppress Pueblo governance and land rights (resolved in Pueblo Lands Act 1924).",
        treaties: ["Treaty of Guadalupe Hidalgo (1848) — asserted US citizenship protections"],
        survivingCommunity: "19 federally recognized Pueblos in New Mexico, plus Hopi (AZ) and Zuni (NM)",
        removalEventIds: ["PUEBLO_REVOLT_SUPPRESSION"],
      },
      {
        name: "Apache Nations (Chiricahua, Mescalero, Western Apache, Jicarilla)",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the mountains of Arizona, New Mexico, and west Texas. Apache resistance ended with the surrender of Geronimo in 1886. The Chiricahua were held as prisoners of war at Fort Sill, Oklahoma until 1913.",
        treaties: [],
        survivingCommunity: "Fort Sill Apache Tribe (OK), Mescalero Apache (NM), Jicarilla Apache (NM), White Mountain Apache (AZ)",
        removalEventIds: ["APACHE_PRISONER_OF_WAR"],
      },
      {
        name: "Tohono O'odham Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the Sonoran Desert of southern Arizona. The Gadsden Purchase (1853) split their traditional territory between the US and Mexico.",
        treaties: ["Treaty of Guadalupe Hidalgo (1848)", "Gadsden Purchase Treaty (1853)"],
        survivingCommunity: "Tohono O'odham Nation — second largest reservation in the US. AZ.",
        removalEventIds: [],
      },
    ],
  },

  pacific_northwest: {
    label: "Pacific Northwest",
    states: ["washington", "oregon", "idaho"],
    nations: [
      {
        name: "Nez Perce (Niimíipuu) Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the Clearwater River valley in Idaho, Oregon, and Washington. The Nez Perce War of 1877 ended with Chief Joseph's famous surrender and exile to Indian Territory (Oklahoma) before eventual return to the Northwest.",
        treaties: ["Treaty of 1855", "Treaty of 1863 (imposed without full consent)"],
        survivingCommunity: "Nez Perce Tribe — Lapwai, Idaho. Federally recognized.",
        removalEventIds: ["NEZ_PERCE_WAR"],
      },
      {
        name: "Yakama Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the Columbia Plateau in south-central Washington. Retained treaty rights to fish, hunt, and gather at usual and accustomed places.",
        treaties: ["Treaty of 1855 (Yakama Treaty)"],
        survivingCommunity: "Confederated Tribes and Bands of the Yakama Nation — Washington. Federally recognized.",
        removalEventIds: [],
      },
      {
        name: "Chinook Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the Columbia River mouth and lower Columbia valley in Oregon and Washington. Long-denied federal recognition; finally recognized in 2020.",
        treaties: [],
        survivingCommunity: "Chinook Indian Nation — recognized 2020. Washington.",
        removalEventIds: [],
      },
      {
        name: "Coast Salish Peoples (Lummi, Suquamish, Tulalip, and others)",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied Puget Sound and the northern coast. The Point Elliott Treaty (1855) created multiple reservations while preserving treaty fishing rights later affirmed in United States v. Washington (the Boldt Decision, 1974).",
        treaties: ["Treaty of Point Elliott (1855)", "Treaty of Point No Point (1855)"],
        survivingCommunity: "Lummi Nation, Suquamish, Tulalip Tribes, Swinomish — Washington. All federally recognized.",
        removalEventIds: [],
      },
    ],
  },

  california: {
    label: "California",
    states: ["california"],
    nations: [
      {
        name: "Chumash People",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the Santa Barbara Channel coast and surrounding ranges. Mission system (1769–1833) caused catastrophic population decline through disease, forced labor, and cultural suppression.",
        treaties: [],
        survivingCommunity: "Santa Ynez Band of Chumash Indians — federally recognized. Others state-recognized.",
        removalEventIds: ["CALIFORNIA_MISSION_SYSTEM", "CALIFORNIA_GENOCIDE"],
      },
      {
        name: "Ohlone / Costanoan Peoples",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the San Francisco Bay Area and Monterey Bay region. Mission system and California Gold Rush caused severe population collapse.",
        treaties: ["18 Unratified California Treaties (1851–52) — signed but never ratified by US Senate, kept secret until 1905"],
        survivingCommunity: "Muwekma Ohlone, Amah Mutsun, and others — California recognition efforts ongoing",
        removalEventIds: ["CALIFORNIA_MISSION_SYSTEM", "CALIFORNIA_GENOCIDE", "UNRATIFIED_TREATIES"],
      },
      {
        name: "Pomo People",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the coastal and inland valleys of northern California. The Bloody Island Massacre (1850) and Round Valley removals devastated Pomo communities.",
        treaties: ["18 Unratified California Treaties (1851–52)"],
        survivingCommunity: "Multiple Pomo rancherias and bands in northern California — federally recognized",
        removalEventIds: ["CALIFORNIA_GENOCIDE", "ROUND_VALLEY_REMOVAL"],
      },
      {
        name: "Yokuts People",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the San Joaquin Valley. Gold Rush-era violence and disease caused massive population decline.",
        treaties: ["18 Unratified California Treaties (1851–52)"],
        survivingCommunity: "Tule River Tribe, Santa Rosa Indian Community — federally recognized",
        removalEventIds: ["CALIFORNIA_GENOCIDE", "UNRATIFIED_TREATIES"],
      },
    ],
  },

  intermountain_west: {
    label: "Intermountain West (Great Basin & Rocky Mountains)",
    states: ["idaho", "nevada", "utah", "wyoming", "montana (west)"],
    nations: [
      {
        name: "Shoshone-Bannock Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the Snake River Plain and Great Basin (Idaho, Nevada, Utah, Wyoming). The Bear River Massacre (1863) killed 250–400 Shoshone people — among the largest massacres of Native Americans in US history.",
        treaties: ["Treaty of Box Elder (1863)", "Fort Bridger Treaty (1868)"],
        survivingCommunity: "Shoshone-Bannock Tribes of the Fort Hall Reservation — Idaho. Federally recognized.",
        removalEventIds: ["BEAR_RIVER_MASSACRE"],
      },
      {
        name: "Northern Paiute Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the Great Basin of Nevada, Oregon, and Idaho. The Pyramid Lake War (1860) and Bannock War (1878) led to reservation confinement.",
        treaties: [],
        survivingCommunity: "Pyramid Lake Paiute Tribe, Walker River Paiute Tribe, Burns Paiute Tribe — Nevada/Oregon. Federally recognized.",
        removalEventIds: [],
      },
      {
        name: "Ute Nation",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied the Colorado Plateau and Rocky Mountain region. The Ute Removal of 1881 expelled most Utes from Colorado to Utah after the Meeker Incident (1879).",
        treaties: ["Treaty of 1868"],
        survivingCommunity: "Ute Mountain Ute Tribe, Southern Ute Indian Tribe (CO), Uintah and Ouray Tribe (UT). All federally recognized.",
        removalEventIds: ["UTE_REMOVAL"],
      },
    ],
  },

  alaska: {
    label: "Alaska",
    states: ["alaska"],
    nations: [
      {
        name: "Tlingit and Haida Peoples",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied coastal Southeast Alaska. The Alaska Native Claims Settlement Act (ANCSA, 1971) extinguished aboriginal land claims in exchange for 44 million acres and $962 million.",
        treaties: ["Alaska Native Claims Settlement Act (1971, 43 U.S.C. § 1601)"],
        survivingCommunity: "Central Council of Tlingit and Haida Indian Tribes of Alaska — federally recognized",
        removalEventIds: ["ANCSA"],
      },
      {
        name: "Yupik and Cup'ik Peoples",
        activeFrom: null,
        activeTo: null,
        notes: "Occupied western and southwestern Alaska. Federal recognition and land rights governed by ANCSA.",
        treaties: ["Alaska Native Claims Settlement Act (1971)"],
        survivingCommunity: "Association of Village Council Presidents — representing 56 Yup'ik villages",
        removalEventIds: ["ANCSA"],
      },
    ],
  },

  indian_territory: {
    label: "Indian Territory / Oklahoma",
    states: ["oklahoma"],
    nations: [
      {
        name: "Cherokee Nation (in Indian Territory)",
        activeFrom: 1838,
        activeTo: null,
        notes: "Arrived in Indian Territory after the Trail of Tears 1838–1839. Established a constitutional government and prosperous communities, disrupted by the Civil War and the allotment era.",
        treaties: ["Treaty of 1866", "Treaty of New Echota (1835)"],
        survivingCommunity: "Cherokee Nation — Tahlequah, Oklahoma. Federally recognized. Largest tribal nation by enrolled membership.",
        removalEventIds: ["DAWES_ACT", "OKLAHOMA_STATEHOOD"],
      },
      {
        name: "Choctaw Nation (in Indian Territory)",
        activeFrom: 1833,
        activeTo: null,
        notes: "First to arrive in Indian Territory. Established schools, government, and flourishing agricultural communities before allotment era dismantled land holdings.",
        treaties: ["Treaty of Dancing Rabbit Creek (1830)", "Treaty of 1866"],
        survivingCommunity: "Choctaw Nation of Oklahoma — Durant, Oklahoma. Federally recognized.",
        removalEventIds: ["DAWES_ACT"],
      },
      {
        name: "Creek (Muscogee) Nation (in Indian Territory)",
        activeFrom: 1836,
        activeTo: null,
        notes: "Arrived in Indian Territory after 1836 removal. Rebuilt nation in what is now eastern Oklahoma; Green Peach War (1882) and allotment era created significant disruption.",
        treaties: ["Treaty of 1866"],
        survivingCommunity: "Muscogee (Creek) Nation — Okmulgee, Oklahoma. Federally recognized.",
        removalEventIds: ["DAWES_ACT"],
      },
      {
        name: "Chickasaw Nation (in Indian Territory)",
        activeFrom: 1837,
        activeTo: null,
        notes: "Settled in south-central Oklahoma (Chickasaw District). Built one of the most prosperous nations in Indian Territory before allotment.",
        treaties: ["Treaty of 1866"],
        survivingCommunity: "Chickasaw Nation — Ada, Oklahoma. Federally recognized.",
        removalEventIds: ["DAWES_ACT"],
      },
      {
        name: "Seminole Nation (in Indian Territory)",
        activeFrom: 1842,
        activeTo: null,
        notes: "Arrived after the Second Seminole War. Settled in south-central Oklahoma; built towns and schools.",
        treaties: ["Treaty of 1866"],
        survivingCommunity: "Seminole Nation of Oklahoma — Wewoka, Oklahoma. Federally recognized.",
        removalEventIds: ["DAWES_ACT"],
      },
    ],
  },
};

// ─── Removal Events Registry ──────────────────────────────────────────────────

const REMOVAL_EVENTS: Record<string, RemovalContext> = {
  REMOVAL_ACT_1830: {
    event: "Indian Removal Act",
    year: 1830,
    federalBasis: "4 Stat. 411 (1830); Andrew Jackson administration",
    impact: "Authorized the forced relocation of all Indigenous peoples east of the Mississippi River to designated 'Indian Territory' west of the Mississippi. Affected an estimated 60,000–100,000 people.",
    affectedNations: ["Cherokee Nation", "Choctaw Nation", "Creek (Muscogee) Nation", "Chickasaw Nation", "Seminole Nation", "Shawnee Nation"],
    originRegion: "Southeastern and Midwestern United States",
    destinationRegion: "Indian Territory (present-day Oklahoma)",
  },
  TRAIL_OF_TEARS: {
    event: "Trail of Tears (Nunna daul Tsuny — 'the trail where they cried')",
    year: "1838–1839",
    federalBasis: "Indian Removal Act (1830); Treaty of New Echota (1835); U.S. Army enforcement",
    impact: "Forced relocation of approximately 16,000 Cherokee people from their southeastern homelands to Indian Territory. An estimated 4,000–8,000 died from exposure, disease, and starvation during the march.",
    affectedNations: ["Cherokee Nation"],
    originRegion: "Georgia, Alabama, Tennessee, North Carolina",
    destinationRegion: "Indian Territory (northeastern Oklahoma)",
  },
  CHOCTAW_REMOVAL: {
    event: "Choctaw Removal (The Long, Painful Road)",
    year: "1830–1833",
    federalBasis: "Treaty of Dancing Rabbit Creek (1830); Indian Removal Act",
    impact: "First removal under the Indian Removal Act. Approximately 17,000 Choctaw walked to Indian Territory; an estimated 2,500–6,000 died. US Secretary of War John Eaton called the survivors' journey a 'trail of tears and death.'",
    affectedNations: ["Choctaw Nation"],
    originRegion: "Mississippi, Alabama",
    destinationRegion: "Indian Territory (southeastern Oklahoma)",
  },
  CREEK_REMOVAL: {
    event: "Creek (Muscogee) Removal",
    year: "1836–1837",
    federalBasis: "Treaty of Cusseta (1832); Indian Removal Act; US Army enforcement",
    impact: "Approximately 19,000 Creek people were forcibly removed, many in chains. Thousands died during the journey.",
    affectedNations: ["Creek (Muscogee) Nation"],
    originRegion: "Alabama, Georgia",
    destinationRegion: "Indian Territory (eastern Oklahoma)",
  },
  CHICKASAW_REMOVAL: {
    event: "Chickasaw Removal",
    year: "1837–1838",
    federalBasis: "Treaty of Pontotoc Creek (1832); Indian Removal Act",
    impact: "The Chickasaw negotiated the terms of their removal more successfully than other nations, but still suffered significant mortality during the journey. An estimated 500–600 died.",
    affectedNations: ["Chickasaw Nation"],
    originRegion: "Mississippi, Tennessee",
    destinationRegion: "Indian Territory (south-central Oklahoma)",
  },
  SEMINOLE_WARS: {
    event: "Seminole Wars (First, Second, Third)",
    year: "1817–1858",
    federalBasis: "Indian Removal Act (1830); US Army enforcement",
    impact: "Three wars fought over 40 years. The Second Seminole War (1835–1842) was the costliest US-Indian war. Approximately 3,000 Seminole were removed; a band of several hundred never surrendered and remains in Florida today.",
    affectedNations: ["Seminole Nation"],
    originRegion: "Florida",
    destinationRegion: "Indian Territory (Oklahoma); surviving band remained in Florida Everglades",
  },
  POTAWATOMI_TRAIL_OF_DEATH: {
    event: "Potawatomi Trail of Death",
    year: 1838,
    federalBasis: "Treaty of Chicago (1833); Indian Removal Act",
    impact: "859 Potawatomi people were force-marched 660 miles from Indiana to Kansas. 42 people died, mostly children, during the 61-day march in September–November.",
    affectedNations: ["Potawatomi Nation"],
    originRegion: "Indiana, Illinois, Michigan",
    destinationRegion: "Kansas, later Oklahoma",
  },
  SANDY_LAKE_TRAGEDY: {
    event: "Sandy Lake Tragedy (Ojibwe Removal Attempt)",
    year: 1850,
    federalBasis: "Removal Order of 1850 (President Fillmore); later reversed",
    impact: "The US government attempted to remove Lake Superior Ojibwe from Wisconsin to Sandy Lake, Minnesota. Approximately 400 people died from disease, starvation, and exposure. Public pressure and Ojibwe resistance led President Fillmore to revoke the removal order in 1851.",
    affectedNations: ["Ojibwe / Chippewa Nation"],
    originRegion: "Wisconsin (La Pointe, Lake Superior shore)",
    destinationRegion: "Sandy Lake, Minnesota (intended); revoked",
  },
  DAWES_ACT: {
    event: "General Allotment Act (Dawes Act)",
    year: 1887,
    federalBasis: "24 Stat. 388 (1887); further implemented by the Curtis Act (1898) and Dawes Commission Rolls",
    impact: "Broke up collectively-held tribal land into individual 160-acre allotments. Surplus land was opened to non-Indian settlement. Indigenous nations lost an estimated 90 million acres — 2/3 of all tribal land holdings — between 1887 and 1934. The Dawes Rolls (1898–1914) created enrollment records for the Five Civilized Tribes.",
    affectedNations: ["All tribes with communal land holdings"],
    originRegion: "All Indian Territory and reservation lands",
    destinationRegion: "Individual allotments; 'surplus' land to non-Indian settlers",
  },
  BLACK_HILLS_SEIZURE: {
    event: "Black Hills Seizure (He Sapa)",
    year: 1877,
    federalBasis: "Agreement of 1877 (imposed without required 3/4 male tribal consent under Fort Laramie Treaty of 1868)",
    impact: "After gold was discovered in the Black Hills in 1874, the US government seized the sacred Black Hills in violation of the Fort Laramie Treaty. The US Supreme Court ruled in United States v. Sioux Nation (1980) that the taking was illegal, awarding $102 million in compensation — refused by the Sioux who continue to seek return of the land.",
    affectedNations: ["Lakota / Teton Sioux Nation"],
    originRegion: "Black Hills (He Sapa), South Dakota",
    destinationRegion: "Reservation confinement in South Dakota",
  },
  WOUNDED_KNEE: {
    event: "Wounded Knee Massacre",
    year: 1890,
    federalBasis: "US 7th Cavalry Regiment, December 29, 1890",
    impact: "US soldiers massacred approximately 250–300 Lakota men, women, and children at Wounded Knee Creek, South Dakota. This event marked the end of the Indian Wars and the beginning of the reservation confinement era.",
    affectedNations: ["Lakota / Teton Sioux Nation"],
    originRegion: "Pine Ridge Reservation, South Dakota",
    destinationRegion: "(massacre site)",
  },
  LONG_WALK_NAVAJO: {
    event: "Long Walk of the Navajo (Hwéeldi)",
    year: "1864–1868",
    federalBasis: "US Army orders; Kit Carson campaign",
    impact: "Approximately 9,000 Diné (Navajo) people were forced to walk 300–400 miles to Bosque Redondo (Hwéeldi) in eastern New Mexico. Around 200 died during the march; thousands more died at Bosque Redondo from starvation and disease. The 1868 Treaty allowed return to their homeland.",
    affectedNations: ["Diné (Navajo) Nation"],
    originRegion: "Four Corners region (Arizona, New Mexico, Colorado, Utah)",
    destinationRegion: "Bosque Redondo, New Mexico (then returned to Navajo homeland by Treaty of 1868)",
  },
  NEZ_PERCE_WAR: {
    event: "Nez Perce War and Exile",
    year: 1877,
    federalBasis: "US Army enforcement of 1863 Treaty (imposed without full Nez Perce consent)",
    impact: "Chief Joseph's band fled 1,170 miles across Idaho, Wyoming, and Montana attempting to reach Canada before surrendering 40 miles from the border. Survivors were exiled to Indian Territory (Oklahoma) before eventually returning to Idaho and Washington.",
    affectedNations: ["Nez Perce (Niimíipuu) Nation"],
    originRegion: "Wallowa Valley, Oregon",
    destinationRegion: "Bear Paw Mountains, Montana (surrender); then Indian Territory; later Idaho/Washington",
  },
  CALIFORNIA_GENOCIDE: {
    event: "California Indian Genocide",
    year: "1846–1873",
    federalBasis: "California Act for the Government and Protection of Indians (1850); state-funded militia campaigns",
    impact: "The California Indian population declined from approximately 150,000 in 1846 to fewer than 30,000 by 1870 through state-sponsored massacres, enslavement, starvation, and disease. The California legislature funded militias to kill Native people. Governor Newsom formally apologized in 2019.",
    affectedNations: ["All California Indigenous peoples"],
    originRegion: "California",
    destinationRegion: "Round Valley and other reservations; many communities destroyed entirely",
  },
  CALIFORNIA_MISSION_SYSTEM: {
    event: "Spanish Mission System",
    year: "1769–1833",
    federalBasis: "Spanish colonial policy; secularization by Mexican government in 1833",
    impact: "21 Catholic missions were established along the California coast. Native Californians were forced to labor in the missions under conditions of virtual enslavement. Disease, forced labor, and cultural destruction caused population decline of 50–90% in mission-adjacent communities.",
    affectedNations: ["Chumash People", "Ohlone / Costanoan Peoples", "Luiseño", "Gabrielino/Tongva"],
    originRegion: "Coastal California",
    destinationRegion: "(forced into missions)",
  },
  UNRATIFIED_TREATIES: {
    event: "18 Unratified California Treaties",
    year: "1851–1852",
    federalBasis: "US Senate refused to ratify; kept secret for 50 years",
    impact: "The US negotiated 18 treaties with California tribes promising 7.5 million acres of reservation land. The Senate refused to ratify them and the treaties were sealed in secret for 53 years. California nations lost their land base without any legal recourse.",
    affectedNations: ["All California Indigenous peoples negotiating in 1851–52"],
    originRegion: "California",
    destinationRegion: "(promised reservations never established)",
  },
  SULLIVAN_CLINTON: {
    event: "Sullivan-Clinton Campaign",
    year: 1779,
    federalBasis: "Continental Congress orders; General Washington's 'town destroyer' campaign",
    impact: "US forces destroyed 40+ Haudenosaunee towns, burning crops and orchards in upstate New York. General Washington ordered the 'total destruction and devastation' of Iroquois settlements. The campaign displaced thousands and led to the treaty cessions of Iroquois lands in the post-Revolutionary period.",
    affectedNations: ["Haudenosaunee Confederacy (Iroquois — Seneca, Cayuga, Onondaga, Mohawk)"],
    originRegion: "Central and western New York",
    destinationRegion: "Canadian exile (many Mohawk, Cayuga); remaining NY reservations",
  },
  OKLAHOMA_STATEHOOD: {
    event: "Oklahoma Statehood and Dissolution of Tribal Governments",
    year: 1907,
    federalBasis: "Oklahoma Enabling Act (1906); Curtis Act (1898)",
    impact: "Oklahoma statehood in 1907 formally dissolved tribal governments and courts of the Five Civilized Tribes, ending the sovereignty established in Indian Territory. The Curtis Act had already mandated allotment of all Indian Territory lands. Tribal governments were not formally revived until the 1970s.",
    affectedNations: ["Cherokee Nation", "Choctaw Nation", "Creek (Muscogee) Nation", "Chickasaw Nation", "Seminole Nation"],
    originRegion: "Indian Territory (Oklahoma)",
    destinationRegion: "(allotment of individual holdings within Oklahoma)",
  },
};

// ─── US State → Region mapping ────────────────────────────────────────────────

const STATE_TO_REGION: Record<string, RegionKey> = {
  // Southeast
  georgia: "southeast", alabama: "southeast", mississippi: "southeast",
  tennessee: "southeast", "south carolina": "southeast", florida: "southeast",
  louisiana: "southeast", arkansas: "southeast",
  // Appalachia
  "north carolina": "appalachia", virginia: "appalachia",
  "west virginia": "appalachia", kentucky: "appalachia",
  // Northeast
  "new york": "northeast", pennsylvania: "northeast", "new jersey": "northeast",
  massachusetts: "northeast", connecticut: "northeast", "rhode island": "northeast",
  vermont: "northeast", "new hampshire": "northeast", maine: "northeast",
  maryland: "northeast", delaware: "northeast",
  // Great Lakes
  michigan: "great_lakes", wisconsin: "great_lakes", minnesota: "great_lakes",
  illinois: "great_lakes", indiana: "great_lakes", ohio: "great_lakes",
  // Great Plains
  kansas: "great_plains", nebraska: "great_plains", iowa: "great_plains",
  missouri: "great_plains", texas: "great_plains",
  // Northern Plains
  "south dakota": "northern_plains", "north dakota": "northern_plains",
  montana: "northern_plains", wyoming: "northern_plains",
  // Southwest
  arizona: "southwest", "new mexico": "southwest", utah: "southwest", nevada: "intermountain_west",
  // California
  california: "california",
  // Pacific Northwest
  washington: "pacific_northwest", oregon: "pacific_northwest", idaho: "pacific_northwest",
  // Intermountain West
  colorado: "great_plains", // split — south CO is intermountain/southwest
  // Indian Territory
  oklahoma: "indian_territory",
  // Alaska
  alaska: "alaska",
};

// State abbreviations
const STATE_ABBREV: Record<string, string> = {
  al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california",
  co: "colorado", ct: "connecticut", de: "delaware", fl: "florida", ga: "georgia",
  hi: "hawaii", id: "idaho", il: "illinois", "in": "indiana", ia: "iowa",
  ks: "kansas", ky: "kentucky", la: "louisiana", me: "maine", md: "maryland",
  ma: "massachusetts", mi: "michigan", mn: "minnesota", ms: "mississippi",
  mo: "missouri", mt: "montana", ne: "nebraska", nv: "nevada", nh: "new hampshire",
  nj: "new jersey", nm: "new mexico", ny: "new york", nc: "north carolina",
  nd: "north dakota", oh: "ohio", ok: "oklahoma", or: "oregon", pa: "pennsylvania",
  ri: "rhode island", sc: "south carolina", sd: "south dakota", tn: "tennessee",
  tx: "texas", ut: "utah", vt: "vermont", va: "virginia", wa: "washington",
  wv: "west virginia", wi: "wisconsin", wy: "wyoming",
};

// ─── Era detection ────────────────────────────────────────────────────────────

function detectEra(birth: number | null, death: number | null): string {
  const year = birth ?? death;
  if (!year) return "Unknown Era";
  if (year < 1776) return "Colonial Era (pre-1776)";
  if (year < 1830) return "Early Republic Era (1776–1830)";
  if (year < 1860) return "Removal Era (1830–1860)";
  if (year < 1870) return "Civil War Era (1860–1870)";
  if (year < 1887) return "Post-Civil War / Reservation Era (1870–1887)";
  if (year < 1920) return "Allotment Era (1887–1920)";
  if (year < 1945) return "Assimilation / Boarding School Era (1920–1945)";
  if (year < 1970) return "Termination Era (1945–1970)";
  return "Self-Determination Era (1970–present)";
}

// ─── Location parsing ─────────────────────────────────────────────────────────

function extractStateFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase().replace(/[,;]/g, " ");

  // Try full state names first
  for (const stateName of Object.keys(STATE_TO_REGION)) {
    if (lower.includes(stateName)) return stateName;
  }

  // Try abbreviations (look for isolated 2-letter codes)
  const words = lower.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, "");
    if (clean.length === 2 && STATE_ABBREV[clean]) {
      return STATE_ABBREV[clean];
    }
  }

  return null;
}

function extractStateFromTribalNation(tribalNation: string | null | undefined): string | null {
  if (!tribalNation) return null;
  const lower = tribalNation.toLowerCase();

  // Direct tribal nation → region hints
  if (lower.includes("cherokee")) return "georgia";
  if (lower.includes("choctaw") && !lower.includes("oklahoma")) return "mississippi";
  if (lower.includes("muscogee") || lower.includes("creek")) return "alabama";
  if (lower.includes("chickasaw")) return "mississippi";
  if (lower.includes("seminole") && !lower.includes("oklahoma")) return "florida";
  if (lower.includes("ojibwe") || lower.includes("chippewa")) return "michigan";
  if (lower.includes("navajo") || lower.includes("diné") || lower.includes("dine")) return "arizona";
  if (lower.includes("lakota") || lower.includes("sioux")) return "south dakota";
  if (lower.includes("comanche")) return "oklahoma";
  if (lower.includes("apache")) return "arizona";
  if (lower.includes("nez perce")) return "idaho";
  if (lower.includes("potawatomi") && lower.includes("citizen")) return "oklahoma";
  if (lower.includes("potawatomi")) return "indiana";
  if (lower.includes("osage")) return "oklahoma";
  if (lower.includes("pueblo")) return "new mexico";
  if (lower.includes("yakama") || lower.includes("yakima")) return "washington";

  return null;
}

// ─── Core analysis function ───────────────────────────────────────────────────

export function analyzeAncestralAffiliation(ancestor: AncestorInput): TribalAffiliationResult {
  const birth = ancestor.birthYear ?? null;
  const death = ancestor.deathYear ?? null;
  const era = detectEra(birth, death);

  // ── Step 1: detect location ──────────────────────────────────────────────
  const dataSignals: string[] = [];

  let detectedState: string | null = null;
  let locationSource = "";

  // Priority 1: birthPlace (GEDCOM-imported — most specific vital record)
  if (ancestor.birthPlace) {
    detectedState = extractStateFromText(ancestor.birthPlace);
    if (detectedState) locationSource = `birth place record ("${ancestor.birthPlace}")`;
    dataSignals.push(`Birth place: "${ancestor.birthPlace}"`);
  }

  // Priority 2: deathPlace (GEDCOM-imported — next most specific)
  if (!detectedState && ancestor.deathPlace) {
    detectedState = extractStateFromText(ancestor.deathPlace);
    if (detectedState) locationSource = `death place record ("${ancestor.deathPlace}")`;
    dataSignals.push(`Death place: "${ancestor.deathPlace}"`);
  }

  // Priority 3: locationAddress (manually entered)
  if (!detectedState && ancestor.locationAddress) {
    detectedState = extractStateFromText(ancestor.locationAddress);
    if (detectedState) locationSource = `address field ("${ancestor.locationAddress}")`;
    dataSignals.push(`Location address: "${ancestor.locationAddress}"`);
  }

  // Priority 4: notes field
  if (!detectedState && ancestor.notes) {
    detectedState = extractStateFromText(ancestor.notes);
    if (detectedState) locationSource = "biographical notes";
    dataSignals.push(`Notes field contains location indicators`);
  }

  // Priority 5: tribalNation field as location clue
  if (!detectedState && ancestor.tribalNation) {
    detectedState = extractStateFromText(ancestor.tribalNation) ?? extractStateFromTribalNation(ancestor.tribalNation);
    if (detectedState) locationSource = `tribal nation name ("${ancestor.tribalNation}")`;
    dataSignals.push(`Tribal nation recorded: "${ancestor.tribalNation}"`);
  } else if (ancestor.tribalNation) {
    dataSignals.push(`Tribal nation recorded: "${ancestor.tribalNation}"`);
  }

  // Priority 6: lat/lng bounding box heuristic
  if (!detectedState && ancestor.locationLat && ancestor.locationLng) {
    detectedState = inferStateFromCoords(ancestor.locationLat, ancestor.locationLng);
    if (detectedState) locationSource = `map coordinates (${ancestor.locationLat.toFixed(2)}, ${ancestor.locationLng.toFixed(2)})`;
    dataSignals.push(`Map coordinates available: ${ancestor.locationLat.toFixed(3)}, ${ancestor.locationLng.toFixed(3)}`);
  }

  // Priority 7: descendant locations as corroborating geographic evidence
  // If descendants stayed in or near a common region, that region is ancestral territory
  if (!detectedState && ancestor.descendantLocations && ancestor.descendantLocations.length > 0) {
    const descStateCounts: Record<string, number> = {};
    for (const loc of ancestor.descendantLocations) {
      const s = extractStateFromText(loc);
      if (s) descStateCounts[s] = (descStateCounts[s] ?? 0) + 1;
    }
    const sorted = Object.entries(descStateCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      detectedState = sorted[0][0];
      locationSource = `descendant lineage continuity — ${sorted[0][1]} descendant(s) documented in ${capitalizeWords(sorted[0][0])}`;
      dataSignals.push(`Descendant lineage continuity: ${ancestor.descendantLocations.length} descendants with known locations — dominant region: ${capitalizeWords(sorted[0][0])}`);
    }
  } else if (detectedState && ancestor.descendantLocations && ancestor.descendantLocations.length > 0) {
    // Already have a state — check if descendants confirm it
    const confirming = ancestor.descendantLocations.filter(loc => {
      const s = extractStateFromText(loc);
      return s && STATE_TO_REGION[s] === STATE_TO_REGION[detectedState!];
    });
    if (confirming.length > 0) {
      dataSignals.push(`Descendant lineage corroboration: ${confirming.length} of ${ancestor.descendantLocations.length} descendants have locations in the same historical territory — strengthens ancestral presence`);
    }
  }

  if (birth || death) {
    dataSignals.push(`Lifespan: ${birth ?? "?"}–${death ?? "?"}`);
  }
  if (ancestor.generationalPosition) {
    dataSignals.push(`Generational position: ${ancestor.generationalPosition}`);
  }

  const detectedRegion = detectedState ? (STATE_TO_REGION[detectedState] ?? null) : null;
  const regionEntry = detectedRegion ? REGIONS[detectedRegion] : null;

  // ── Step 2: confirmed affiliation from tribalNation field ─────────────────
  const affiliations: AffiliationMatch[] = [];

  if (ancestor.tribalNation && ancestor.tribalNation.trim()) {
    affiliations.push({
      tribalNation: ancestor.tribalNation,
      confidence: "confirmed",
      basis: `Directly recorded in your family record as tribal nation affiliation.`,
      activeEra: era,
      removalImpact: buildRemovalImpactForNation(ancestor.tribalNation, birth, death),
      treaties: getRelevantTreaties(ancestor.tribalNation),
      survivingCommunity: findSurvivingCommunity(ancestor.tribalNation),
    });
  }

  // ── Step 3: infer affiliations from region + time period ─────────────────
  if (regionEntry) {
    for (const nation of regionEntry.nations) {
      // Skip if already added as confirmed
      if (affiliations.some(a => a.tribalNation.toLowerCase().includes(nation.name.toLowerCase().slice(0, 10)))) continue;

      // Time filter: nation must have been active during ancestor's lifetime
      const ancestorActive = birth ?? death;
      const nationActive = nation.activeTo ?? 9999;
      const nationStart = nation.activeFrom ?? 0;

      if (ancestorActive && nationActive < ancestorActive && (birth ?? Infinity) > nationActive + 20) continue;
      if (ancestorActive && nationStart > (death ?? ancestorActive) + 10) continue;

      const relevantRemovals = nation.removalEventIds
        .map(id => REMOVAL_EVENTS[id])
        .filter(Boolean)
        .filter(ev => {
          const evYear = typeof ev.year === "number" ? ev.year : parseInt(String(ev.year));
          if (!birth && !death) return true;
          const ancestorEnd = death ?? (birth ? birth + 70 : 9999);
          const ancestorStart = birth ?? (death ? death - 70 : 0);
          return evYear >= ancestorStart - 30 && evYear <= ancestorEnd + 10;
        });

      const confidence: AffiliationMatch["confidence"] = ancestorActive
        ? (nation.activeTo && ancestorActive > nation.activeTo + 30 ? "inferred" : "high")
        : "moderate";

      let basis = `${ancestor.fullName} lived in ${detectedState ? capitalizeWords(detectedState) : regionEntry.label}, `;
      basis += `which was historically ${nation.name} territory`;
      if (birth || death) basis += ` during the ${birth ?? death}s`;
      basis += `.`;
      if (locationSource) basis += ` (Location detected from ${locationSource}.)`;

      affiliations.push({
        tribalNation: nation.name,
        confidence,
        basis,
        activeEra: era,
        removalImpact: relevantRemovals.length > 0
          ? relevantRemovals.map(r => r.event + ` (${r.year}): ${r.impact.slice(0, 200)}...`).join(" | ")
          : null,
        treaties: nation.treaties.slice(0, 3),
        survivingCommunity: nation.survivingCommunity,
      });
    }
  }

  // ── Step 4: collect relevant removal events ───────────────────────────────
  const removalContext: RemovalContext[] = [];
  const seenEvents = new Set<string>();

  if (regionEntry) {
    for (const nation of regionEntry.nations) {
      for (const eventId of nation.removalEventIds) {
        if (seenEvents.has(eventId)) continue;
        const ev = REMOVAL_EVENTS[eventId];
        if (!ev) continue;

        // Filter to events relevant to ancestor's lifetime (±30 years)
        const evYear = typeof ev.year === "number" ? ev.year : parseInt(String(ev.year));
        const ancestorEnd = death ?? (birth ? birth + 80 : 9999);
        const ancestorStart = birth ?? (death ? death - 80 : 0);
        if (evYear < ancestorStart - 50 || evYear > ancestorEnd + 50) continue;

        seenEvents.add(eventId);
        removalContext.push(ev);
      }
    }
  }

  // Always add Dawes Act if ancestor lived post-1880 and is in a relevant region
  if (!seenEvents.has("DAWES_ACT") && (birth ?? death ?? 0) > 1860 && (birth ?? death ?? 0) < 1940) {
    const dawes = REMOVAL_EVENTS["DAWES_ACT"];
    if (dawes) removalContext.push(dawes);
  }

  // ── Step 5: build reasoning sentences ─────────────────────────────────────
  const reasoning: string[] = [];

  if (!detectedState && !ancestor.tribalNation) {
    reasoning.push(
      `No location data or tribal nation has been recorded for ${ancestor.fullName} yet. Adding a location address, map coordinates, or tribal nation name to their record will allow this engine to apply specific territorial and removal act analysis.`
    );
  } else {
    if (detectedState) {
      reasoning.push(
        `${ancestor.fullName}'s records place them in ${capitalizeWords(detectedState)}${birth || death ? ` during the ${birth ?? death}s` : ""}. This corresponds to the historical territory of the ${regionEntry?.label ?? "region"}.`
      );
    }

    if (ancestor.tribalNation) {
      const existing = affiliations.find(a => a.confidence === "confirmed");
      if (existing) {
        reasoning.push(
          `Their family record directly names their tribal nation as "${ancestor.tribalNation}." This is the highest-confidence signal — the logic engine treats this as confirmed affiliation.`
        );
        if (existing.removalImpact) {
          reasoning.push(existing.removalImpact);
        }
      }
    }

    if (birth && death) {
      reasoning.push(
        `${ancestor.fullName} lived approximately ${birth}–${death} (${death - birth} years). This places them in the ${era}.`
      );
    } else if (birth) {
      reasoning.push(
        `${ancestor.fullName} was born approximately ${birth}, placing them in the ${era}.`
      );
    }

    for (const rc of removalContext.slice(0, 3)) {
      reasoning.push(
        `FEDERAL LAW — ${rc.event} (${rc.year}): ${rc.impact.slice(0, 300)}` +
        (rc.impact.length > 300 ? "..." : "") +
        ` | Federal basis: ${rc.federalBasis}.`
      );
    }

    if (affiliations.length > 0 && affiliations[0].confidence !== "confirmed") {
      reasoning.push(
        `Based on the geographic and temporal overlap, ${affiliations.slice(0, 3).map(a => a.tribalNation).join(", ")} ` +
        `${affiliations.length === 1 ? "is the" : "are the"} most historically relevant tribal nation${affiliations.length === 1 ? "" : "s"} ` +
        `for this ancestor's area and time period. This is inferred, not confirmed — documentary evidence (Dawes Rolls, census records, church records) should be reviewed to confirm.`
      );
    }
  }

  // ── Step 6: recommendations ───────────────────────────────────────────────
  const recommendations: string[] = [];

  if (!ancestor.locationAddress && !ancestor.locationLat) {
    recommendations.push("Add a location address or map pin to this ancestor's record to enable precise territorial matching.");
  }
  if (!ancestor.tribalNation) {
    recommendations.push("If you know or can research which tribal nation this ancestor identified with, adding that field will confirm the affiliation and unlock deeper legal analysis.");
  }
  if (removalContext.some(r => r.event.includes("Dawes"))) {
    recommendations.push("Search the Dawes Rolls (1898–1914) via the Oklahoma Historical Society or FamilySearch for enrollment records of the Five Civilized Tribes. Dawes Roll enrollment is a key document for Cherokee, Choctaw, Creek, Chickasaw, and Seminole ancestry.");
  }
  if (detectedRegion === "northeast" || detectedRegion === "great_lakes") {
    recommendations.push("Search Federal Indian Census Rolls (1885–1940) via Ancestry.com or NARA for Great Lakes and Northeastern tribes. These are distinct from Dawes Rolls and cover different nations.");
  }
  if (detectedRegion === "california") {
    recommendations.push("Search the California Indian Judgment Fund records and BIA Sacramento Area Office enrollment records. Many California nations were terminated in the 1950s and later restored — check Rancheria termination/restoration records.");
  }
  recommendations.push("Submit this analysis to the Tribal Record Committee for review. Documented ancestral tribal affiliations can support ICWA standing, tribal membership petitions, and federal trust benefit eligibility.");

  // ── Step 7: overall confidence ────────────────────────────────────────────
  let overallConfidence: TribalAffiliationResult["confidence"] = "inferred";
  if (affiliations.some(a => a.confidence === "confirmed")) overallConfidence = "confirmed";
  else if (affiliations.some(a => a.confidence === "high") && detectedState) overallConfidence = "high";
  else if (affiliations.length > 0 && detectedState) overallConfidence = "moderate";

  // ── Step 8: logic summary ─────────────────────────────────────────────────
  let logicSummary = "";
  if (affiliations.length === 0 && !detectedState) {
    logicSummary = `No location or tribal nation data is available for ${ancestor.fullName}. Add location information to their record to enable territorial and removal act analysis.`;
  } else if (affiliations.length > 0) {
    const topAffil = affiliations[0];
    logicSummary = `${ancestor.fullName}` +
      (birth || death ? ` (${birth ?? "?"}–${death ?? "?"})` : "") +
      ` is connected to ${affiliations.length === 1 ? "" : `${affiliations.length} tribal nations, most prominently `}**${topAffil.tribalNation}**` +
      (detectedState ? ` based on their presence in ${capitalizeWords(detectedState)}` : "") +
      ` during the ${era}. ` +
      (removalContext.length > 0
        ? `${removalContext.length} federal removal event${removalContext.length === 1 ? "" : "s"} overlapped their lifetime, including ${removalContext[0].event} (${removalContext[0].year}). `
        : "") +
      `Confidence level: ${overallConfidence}. ${topAffil.survivingCommunity ? `Today's surviving community: ${topAffil.survivingCommunity}.` : ""}`;
  } else {
    logicSummary = `${ancestor.fullName} has location data${detectedState ? ` pointing to ${capitalizeWords(detectedState)}` : ""} but no specific tribal affiliation match was found for their time period. Adding their tribal nation name directly will resolve this.`;
  }

  return {
    ancestorId: ancestor.id,
    fullName: ancestor.fullName,
    detectedState,
    detectedRegion,
    lifespan: {
      birth,
      death,
      estimated: !birth && !death && !!ancestor.generationalPosition,
    },
    era,
    affiliations: affiliations.slice(0, 5),
    removalContext: removalContext.slice(0, 4),
    reasoning,
    logicSummary,
    recommendations,
    confidence: overallConfidence,
    dataSignals,
  };
}

// ─── Batch analysis ───────────────────────────────────────────────────────────

export function analyzeAncestors(ancestors: AncestorInput[]): TribalAffiliationResult[] {
  return ancestors.map(a => analyzeAncestralAffiliation(a));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalizeWords(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

function buildRemovalImpactForNation(tribalNation: string, birth: number | null, death: number | null): string | null {
  const lower = tribalNation.toLowerCase();
  const year = birth ?? death;
  if (!year) return null;

  if (lower.includes("cherokee") && year > 1820 && year < 1870) {
    return "This ancestor's life overlapped with the Trail of Tears (1838–1839), when approximately 16,000 Cherokee people were forcibly relocated from the Southeast to Indian Territory. An estimated 4,000–8,000 died during the march. This event is a central trauma in Cherokee historical memory.";
  }
  if ((lower.includes("choctaw")) && year > 1820 && year < 1870) {
    return "This ancestor lived during or near the Choctaw Removal (1830–1833), the first removal under the Indian Removal Act. Thousands died during the forced march to Indian Territory.";
  }
  if ((lower.includes("creek") || lower.includes("muscogee")) && year > 1820 && year < 1870) {
    return "This ancestor lived during or near the Creek Removal (1836–1837), when approximately 19,000 Creek people were forcibly marched to Indian Territory, many in chains.";
  }
  if (lower.includes("navajo") || lower.includes("diné") || lower.includes("dine")) {
    if (year > 1840 && year < 1900) {
      return "This ancestor's life likely overlapped with the Long Walk of the Navajo (1864–1868), during which approximately 9,000 Diné were force-marched to Bosque Redondo. The 1868 Treaty allowed their return to their homeland.";
    }
  }
  if (lower.includes("lakota") || lower.includes("sioux")) {
    if (year > 1850 && year < 1920) {
      return "This ancestor lived during the Plains Indian Wars and Reservation Era. Key events include the Black Hills seizure (1877) and the Wounded Knee Massacre (1890), which ended the Indian Wars era.";
    }
  }
  return null;
}

function getRelevantTreaties(tribalNation: string): string[] {
  const lower = tribalNation.toLowerCase();
  if (lower.includes("cherokee")) return ["Treaty of New Echota (1835)", "Treaty of Hopewell (1785)"];
  if (lower.includes("choctaw")) return ["Treaty of Dancing Rabbit Creek (1830)"];
  if (lower.includes("creek") || lower.includes("muscogee")) return ["Treaty of Cusseta (1832)"];
  if (lower.includes("chickasaw")) return ["Treaty of Pontotoc Creek (1832)"];
  if (lower.includes("seminole")) return ["Treaty of Payne's Landing (1832)"];
  if (lower.includes("navajo") || lower.includes("diné")) return ["Treaty of 1868 (15 Stat. 667)"];
  if (lower.includes("lakota") || lower.includes("sioux")) return ["Fort Laramie Treaty (1868)"];
  if (lower.includes("ojibwe") || lower.includes("chippewa")) return ["Treaty of 1837", "Treaty of La Pointe (1842)"];
  return [];
}

function findSurvivingCommunity(tribalNation: string): string | null {
  const lower = tribalNation.toLowerCase();
  for (const [, regionEntry] of Object.entries(REGIONS)) {
    for (const nation of regionEntry.nations) {
      if (nation.name.toLowerCase().includes(lower.slice(0, 8)) || lower.includes(nation.name.toLowerCase().slice(0, 8))) {
        return nation.survivingCommunity;
      }
    }
  }
  return null;
}

function inferStateFromCoords(lat: number, lng: number): string | null {
  // Rough bounding box checks for US states
  if (lat >= 30 && lat <= 35 && lng >= -85 && lng <= -80) return "georgia";
  if (lat >= 30 && lat <= 35 && lng >= -88 && lng <= -84) return "alabama";
  if (lat >= 30 && lat <= 35 && lng >= -91 && lng <= -88) return "mississippi";
  if (lat >= 34 && lat <= 37 && lng >= -91 && lng <= -81) return "tennessee";
  if (lat >= 24 && lat <= 31 && lng >= -87 && lng <= -80) return "florida";
  if (lat >= 34 && lat <= 45 && lng >= -80 && lng <= -70) return "north carolina";
  if (lat >= 35 && lat <= 42 && lng >= -79 && lng <= -70) return "virginia";
  if (lat >= 40 && lat <= 45 && lng >= -80 && lng <= -72) return "new york";
  if (lat >= 39 && lat <= 45 && lng >= -90 && lng <= -80) return "michigan";
  if (lat >= 42 && lat <= 47 && lng >= -92 && lng <= -86) return "wisconsin";
  if (lat >= 43 && lat <= 49 && lng >= -97 && lng <= -89) return "minnesota";
  if (lat >= 36 && lat <= 42 && lng >= -102 && lng <= -95) return "kansas";
  if (lat >= 41 && lat <= 43 && lng >= -104 && lng <= -95) return "nebraska";
  if (lat >= 43 && lat <= 49 && lng >= -104 && lng <= -96) return "south dakota";
  if (lat >= 45 && lat <= 49 && lng >= -104 && lng <= -96) return "north dakota";
  if (lat >= 45 && lat <= 49 && lng >= -116 && lng <= -104) return "montana";
  if (lat >= 31 && lat <= 37 && lng >= -114 && lng <= -109) return "arizona";
  if (lat >= 32 && lat <= 37 && lng >= -109 && lng <= -103) return "new mexico";
  if (lat >= 32 && lat <= 42 && lng >= -124 && lng <= -114) return "california";
  if (lat >= 45 && lat <= 49 && lng >= -124 && lng <= -116) return "washington";
  if (lat >= 42 && lat <= 46 && lng >= -124 && lng <= -116) return "oregon";
  if (lat >= 35 && lat <= 37 && lng >= -103 && lng <= -94) return "oklahoma";
  return null;
}
