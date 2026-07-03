export function getKioskBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  return process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "";
}

export function buildKioskLink(slug: string, token: string) {
  const baseUrl = getKioskBaseUrl();
  const path = `/kiosk/${slug}?token=${encodeURIComponent(token)}`;

  return baseUrl ? `${baseUrl}${path}` : path;
}
