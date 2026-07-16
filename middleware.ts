import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    const path = req.nextUrl.pathname;
    // rotas exclusivas do administrador
    if ((path.startsWith("/equipe") || path.startsWith("/relatorios")) && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  },
  { pages: { signIn: "/login" } }
);

export const config = {
  matcher: [
    "/dashboard/:path*", "/leads/:path*", "/funil/:path*", "/contatos/:path*",
    "/vendas/:path*", "/equipe/:path*", "/relatorios/:path*", "/rotina/:path*",
    "/api/leads/:path*", "/api/contacts/:path*", "/api/sales/:path*",
    "/api/proposals/:path*", "/api/users/:path*", "/api/stage/:path*", "/api/daily-report/:path*",
  ],
};
