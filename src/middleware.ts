import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes
  if (pathname === "/login") {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return supabaseResponse;
  }

  // Not authenticated → login
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Check onboarding: if no config, redirect to onboarding
  if (pathname !== "/onboarding" && !pathname.startsWith("/api/")) {
    const { data: config } = await supabase
      .from("users_config")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!config) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  // Already onboarded → redirect from onboarding to dashboard
  if (pathname === "/onboarding") {
    const { data: config } = await supabase
      .from("users_config")
      .select("id")
      .eq("id", user.id)
      .single();

    if (config) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
