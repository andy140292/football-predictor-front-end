const parseErrorMessage = async (response) => {
  const fallback = "No se pudo cargar el top 5.";

  try {
    const payload = await response.json();
    return payload?.detail || payload?.error || payload?.message || fallback;
  } catch {
    return fallback;
  }
};

export const fetchTopSearchedTeams = async ({ apiBaseUrl, mode, token, signal }) => {
  const params = new URLSearchParams({ mode });
  const response = await fetch(`${apiBaseUrl}/top-searched-teams?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(`${message} (HTTP ${response.status})`);
  }

  return response.json();
};
