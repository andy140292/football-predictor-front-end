import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHAMPIONS_KO_TEAMS } from "../src/data/championsTeams.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const LOGOS_DIR = path.join(PROJECT_ROOT, "public", "club-logos");
const MAPPING_FILE = path.join(PROJECT_ROOT, "src", "data", "clubLogoMapping.js");

const UEFA_TEAM_IDS = {
  "Arsenal": "52280",
  "Atalanta": "52816",
  "Atlético Madrid": "50124",
  "Barcelona": "50080",
  "Bayern München": "50037",
  "Bodø/Glimt": "59333",
  "Chelsea": "52914",
  "Galatasaray": "50067",
  "Leverkusen": "50109",
  "Liverpool": "7889",
  "Manchester City": "52919",
  "Newcastle United": "59324",
  "Paris Saint-Germain": "52747",
  "Real Madrid": "50051",
  "Sporting CP": "50149",
  "Tottenham Hotspur": "1652",
};

const sanitizeFileBase = (name) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildUefaLogoUrl = (teamId) =>
  `https://img.uefa.com/imgml/TP/teams/logos/140x140/${teamId}.png`;

const fetchBuffer = async (url) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "futbolconu-logo-sync/2.0 (https://localhost)",
      Referer: "https://www.uefa.com/uefachampionsleague/draws/",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const buildMappingFileContent = (mapping) => {
  const orderedTeams = [...Object.keys(mapping)].sort((a, b) => a.localeCompare(b));
  const lines = [
    "export const CLUB_LOGO_PATHS = {",
    ...orderedTeams.map((team) => `  ${JSON.stringify(team)}: ${JSON.stringify(mapping[team])},`),
    "};",
    "",
    'const DEFAULT_CLUB_LOGO = "/club-logos/default-club-logo.svg";',
    "",
    "export const getClubLogoUrl = (team) => {",
    "  if (!team) return DEFAULT_CLUB_LOGO;",
    "  return CLUB_LOGO_PATHS[team] || DEFAULT_CLUB_LOGO;",
    "};",
    "",
  ];

  return lines.join("\n");
};

const syncLogos = async () => {
  await fs.mkdir(LOGOS_DIR, { recursive: true });

  const mapping = {};
  const expectedFileNames = new Set(["default-club-logo.svg"]);
  const summary = { downloaded: 0, failed: 0, removed: 0 };

  for (const team of CHAMPIONS_KO_TEAMS) {
    const teamId = UEFA_TEAM_IDS[team];
    if (!teamId) {
      summary.failed += 1;
      console.error(`[fail] ${team}: missing UEFA id`);
      continue;
    }

    const fileName = `${sanitizeFileBase(team)}.png`;
    const logoPath = `/club-logos/${fileName}`;
    const filePath = path.join(LOGOS_DIR, fileName);
    expectedFileNames.add(fileName);

    try {
      const logoUrl = buildUefaLogoUrl(teamId);
      const fileBuffer = await fetchBuffer(logoUrl);
      await fs.writeFile(filePath, fileBuffer);
      mapping[team] = logoPath;
      summary.downloaded += 1;
      console.log(`[ok] ${team} -> ${logoPath}`);
    } catch (error) {
      summary.failed += 1;
      console.error(`[fail] ${team}: ${error.message}`);
    }
  }

  if (summary.failed > 0) {
    throw new Error(
      `Aborting sync because ${summary.failed} logo download(s) failed. Existing logo mapping/files were left unchanged.`
    );
  }

  const existingFiles = await fs.readdir(LOGOS_DIR);
  for (const fileName of existingFiles) {
    if (!expectedFileNames.has(fileName)) {
      await fs.unlink(path.join(LOGOS_DIR, fileName));
      summary.removed += 1;
      console.log(`[rm] ${fileName}`);
    }
  }

  const fileContent = buildMappingFileContent(mapping);
  await fs.writeFile(MAPPING_FILE, fileContent, "utf8");

  console.log("\nsync summary");
  console.log(`downloaded: ${summary.downloaded}`);
  console.log(`removed: ${summary.removed}`);
  console.log(`failed: ${summary.failed}`);
};

syncLogos().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
