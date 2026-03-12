export const CLUB_LOGO_PATHS = {
  "Arsenal": "/club-logos/arsenal.png",
  "Atalanta": "/club-logos/atalanta.png",
  "Atlético Madrid": "/club-logos/atletico-madrid.png",
  "Barcelona": "/club-logos/barcelona.png",
  "Benfica": "/club-logos/benfica.png",
  "Bayern München": "/club-logos/bayern-munchen.png",
  "Bodø/Glimt": "/club-logos/bod-glimt.png",
  "Chelsea": "/club-logos/chelsea.png",
  "Club Brugge": "/club-logos/club-brugge.png",
  "Dortmund": "/club-logos/dortmund.png",
  "Galatasaray": "/club-logos/galatasaray.png",
  "Inter": "/club-logos/inter.png",
  "Juventus": "/club-logos/juventus.png",
  "Leverkusen": "/club-logos/leverkusen.png",
  "Liverpool": "/club-logos/liverpool.png",
  "Manchester City": "/club-logos/manchester-city.png",
  "Monaco": "/club-logos/monaco.png",
  "Newcastle United": "/club-logos/newcastle-united.png",
  "Olympiacos": "/club-logos/olympiacos.png",
  "Paris Saint-Germain": "/club-logos/paris-saint-germain.png",
  "PSG": "/club-logos/paris-saint-germain.png",
  "Qarabağ": "/club-logos/qarabag.png",
  "psg": "/club-logos/paris-saint-germain.png",
  "Real Madrid": "/club-logos/real-madrid.png",
  "Sporting CP": "/club-logos/sporting-cp.png",
  "Sporting Lisboa": "/club-logos/sporting-cp.png",
  "Sporting Lisbon": "/club-logos/sporting-cp.png",
  "Tottenham Hotspur": "/club-logos/tottenham-hotspur.png",
};

const DEFAULT_CLUB_LOGO = "/club-logos/default-club-logo.svg";

export const getClubLogoUrl = (team) => {
  if (!team) return DEFAULT_CLUB_LOGO;
  return CLUB_LOGO_PATHS[team] || DEFAULT_CLUB_LOGO;
};
