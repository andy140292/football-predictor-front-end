export const CLUB_LOGO_PATHS = {
  "Atalanta": "/club-logos/atalanta.png",
  "Atlético Madrid": "/club-logos/atletico-madrid.png",
  "Benfica": "/club-logos/benfica.png",
  "Bodø/Glimt": "/club-logos/bod-glimt.png",
  "Club Brugge": "/club-logos/club-brugge.png",
  "Dortmund": "/club-logos/dortmund.png",
  "Galatasaray": "/club-logos/galatasaray.png",
  "Inter": "/club-logos/inter.png",
  "Juventus": "/club-logos/juventus.png",
  "Leverkusen": "/club-logos/leverkusen.png",
  "Monaco": "/club-logos/monaco.png",
  "Newcastle United": "/club-logos/newcastle-united.png",
  "Olympiacos": "/club-logos/olympiacos.png",
  "Paris Saint-Germain": "/club-logos/paris-saint-germain.png",
  "Qarabağ": "/club-logos/qarabag.png",
  "Real Madrid": "/club-logos/real-madrid.png",
};

const DEFAULT_CLUB_LOGO = "/club-logos/default-club-logo.svg";

export const getClubLogoUrl = (team) => {
  if (!team) return DEFAULT_CLUB_LOGO;
  return CLUB_LOGO_PATHS[team] || DEFAULT_CLUB_LOGO;
};
