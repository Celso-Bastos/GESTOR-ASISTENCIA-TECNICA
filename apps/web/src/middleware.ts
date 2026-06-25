import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const publicRoutes = ["/", "/login", "/kiosk"];
const publicPrefixes = ["/kiosk/", "/api/kiosk"];
const protectedPrefixes = [
  "/dashboard",
  "/clientes",
  "/manutencoes",
  "/mensagens",
  "/configuracoes",
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

function redirectWithCookies(
  request: NextRequest,
  sourceResponse: NextResponse,
  pathname: string
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  const response = NextResponse.redirect(url);

  sourceResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user } = await updateSession(request);

  if (pathname === "/login" && user) {
    return redirectWithCookies(request, response, "/dashboard");
  }

  if (isProtectedRoute(pathname) && !user) {
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
