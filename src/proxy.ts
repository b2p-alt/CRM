import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isLoginPage      = pathname === "/login";
  const isPrimeiroAcesso = pathname.startsWith("/primeiro-acesso");

  // Sempre permitir estas páginas
  if (isLoginPage || isPrimeiroAcesso) {
    if (isLoggedIn && !req.auth?.user?.mustChangePassword) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Não autenticado → login
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Autenticado mas deve trocar password → primeiro-acesso
  if (req.auth?.user?.mustChangePassword) {
    return NextResponse.redirect(new URL("/primeiro-acesso", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
