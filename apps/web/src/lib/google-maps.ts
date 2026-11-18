export function buildGoogleMapsAddressUrl(
  customerAddress: string | null | undefined,
  serviceCity?: string | null
) {
  const address = customerAddress?.trim();
  if (!address) return null;

  const query = [address, serviceCity?.trim(), "Brasil"].filter(Boolean).join(", ");
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", query);
  return url.toString();
}
