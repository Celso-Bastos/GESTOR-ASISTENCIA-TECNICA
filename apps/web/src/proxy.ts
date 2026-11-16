import { NextResponse, type NextRequest } from "next/server";
import { getAccountAccessStatus } from "@/lib/auth/account-access";
import {
  hasOrganizationMembership,
  updateSession
} from "@/lib/supabase/middleware";

const publicRoutes = ["/", "/login", "/kiosk", "/criar-conta", "/criar-conta/aguardando", "/auth/confirm", "/auth/definir-senha"];
const publicPrefixes = ["/kiosk/", "/api/kiosk"];
const protectedPrefixes = [
  "/dashboard",
  "/clientes",
  "/manutencoes",
  "/mensagens",
  "/saidas",
  "/relatorios",
  "/configuracoes",
  "/admin",
  "/onboarding"
];

function isPublicRoute(pathname: string) {
  return (
    publicRoutes.includes(pathname) ||
    publicPrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}

function isProtectedRoute(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isServerActionRequest(request: NextRequest) {
  return request.method === "POST" && request.headers.has("next-action");
}

function redirectWithCookies(
  request: NextRequest,
  sourceResponse: NextResponse,
  pathname: string
) {
  const url = request.nextUrl.clone();
  const destination = new URL(pathname, url.origin);
  url.pathname = destination.pathname;
  url.search = destination.search;

  const response = NextResponse.redirect(url);

  sourceResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, supabase, user } = await updateSession(request);
  const isServerAction = isServerActionRequest(request);

  if (user) {
    const status = await getAccountAccessStatus(supabase);
    if (status !== "approved") {
      if (isProtectedRoute(pathname) || pathname === "/") {
        // As actions também validam acesso nos helpers de servidor.
        return redirectWithCookies(request, response, `/login?conta=${status}`);
      }
      return response;
    }
  }

  if ((pathname === "/" || pathname === "/login") && user) {
    const destination = (await hasOrganizationMembership(supabase, user.id))
      ? "/dashboard"
      : "/onboarding/organizacao";

    return redirectWithCookies(request, response, destination);
  }

  if (isProtectedRoute(pathname) && !user) {
    if (isServerAction) {
      return response;
    }

    return redirectWithCookies(request, response, "/login");
  }

  if (isPublicRoute(pathname)) {
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)"
  ]
};
