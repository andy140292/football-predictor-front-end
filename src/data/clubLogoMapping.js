export const CLUB_LOGO_PATHS = {
  "Arsenal": "/club-logos/arsenal.png",
  "Atalanta": "/club-logos/atalanta.png",
  "Atlético Madrid": "/club-logos/atletico-madrid.png",
  "Barcelona": "/club-logos/barcelona.png",
  "Bayern München": "/club-logos/bayern-munchen.png",
  "Bodø/Glimt": "/club-logos/bod-glimt.png",
  "Chelsea": "/club-logos/chelsea.png",
  "Galatasaray": "/club-logos/galatasaray.png",
  "Leverkusen": "/club-logos/leverkusen.png",
  "Liverpool": "/club-logos/liverpool.png",
  "Manchester City": "/club-logos/manchester-city.png",
  "Newcastle United": "/club-logos/newcastle-united.png",
  "Paris Saint-Germain": "/club-logos/paris-saint-germain.png",
  "Real Madrid": "/club-logos/real-madrid.png",
  "Sporting CP": "/club-logos/sporting-cp.png",
  "Tottenham Hotspur": "/club-logos/tottenham-hotspur.png",
};

const DEFAULT_CLUB_LOGO = "/club-logos/default-club-logo.svg";

export const getClubLogoUrl = (team) => {
  if (!team) return DEFAULT_CLUB_LOGO;
  return CLUB_LOGO_PATHS[team] || DEFAULT_CLUB_LOGO;
};
