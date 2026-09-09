import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = ["/", "/login", "/api/webhooks", "/api/cron"];
const ONBOARDING_ROUTES = ["/onboarding"];
const AUTH_CALLBACK = "/api/auth/callback";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and auth callback
  if (
    pathname === AUTH_CALLBACK ||
    PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"))
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Allow API routes through (they handle their own auth)
  if (pathname.startsWith("/api/")) {
    return response;
  }

  // Check onboarding status via cookie first (fast path)
  const onboardingCookie = request.cookies.get("onboarding_completed");
  const isOnboarded = onboardingCookie?.value === "true";

  const isOnboardingRoute = ONBOARDING_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isOnboarded && isOnboardingRoute) {
    // Already onboarded user visiting onboarding — let them through
    // (they might want to re-interview, the page will handle it)
    return response;
  }

  if (!isOnboarded && !isOnboardingRoute) {
    // Cookie not set — check DB to be sure (cookie may have been cleared)
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    if (profile?.onboarding_completed) {
      // Set cookie so we don't hit DB again
      response.cookies.set("onboarding_completed", "true", {
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        httpOnly: false,
        sameSite: "lax",
      });
      return response;
    }

    // Not onboarded — redirect to onboarding
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding/connect";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
