import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate: redirects visitors without a session cookie.
 * This only checks that the cookie exists. Pages and route handlers must
 * still verify the session with `auth.api.getSession()`.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    // Keep the query string so e.g. /search?q=… survives the sign-in round trip.
    signIn.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/search/:path*", "/chat/:path*", "/library/:path*", "/evals/:path*"],
};
