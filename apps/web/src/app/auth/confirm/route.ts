import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const destination = new URL("/auth/definir-senha", request.url);
  let valid = false;
  if (tokenHash && tokenHash.length <= 2048 && type === "invite") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
    valid = !error;
  }
  if (!valid) destination.searchParams.set("erro", "convite");
  // Destino fixo: não aceitar next/redirect_to arbitrário vindo da URL.
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
