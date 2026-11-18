import { MapPin } from "lucide-react";
import { buildGoogleMapsAddressUrl } from "@/lib/google-maps";

export function GoogleMapsAddressLink({ address, serviceCity }: {
  address?: string | null;
  serviceCity?: string | null;
}) {
  const href = buildGoogleMapsAddressUrl(address, serviceCity);
  if (!href) return null;

  // Âncora comum, sem prefetch, SDK ou requisição ao Google na renderização.
  return <a href={href} target="_blank" rel="noopener noreferrer"
    aria-label="Abrir endereço no Google Maps (nova aba)"
    className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-line-strong px-3 text-sm font-medium text-accent hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-focus">
    <MapPin className="size-4 shrink-0" aria-hidden="true" />
    Abrir no Maps
  </a>;
}
