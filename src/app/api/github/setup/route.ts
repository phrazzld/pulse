import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { logger } from "@/lib/logger";

const MODULE_NAME = "api:github:setup";

export async function GET(request: NextRequest) {
  logger.debug(MODULE_NAME, "GET /api/github/setup request received", { 
    url: request.url,
    searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())
  });
  
  const session = await getServerSession(authOptions);
  
  // Check if there's a valid session
  if (!session) {
    logger.warn(MODULE_NAME, "No valid session for GitHub App setup");
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // Extract the installation_id from the query parameters
  const installationId = request.nextUrl.searchParams.get("installation_id");
  
  if (!installationId) {
    logger.warn(MODULE_NAME, "No installation_id provided in the setup callback");
    return NextResponse.redirect(new URL('/dashboard?error=missing_installation_id', request.url));
  }
  
  logger.info(MODULE_NAME, "GitHub App installation ID received", {
    installationId,
    user: session.user?.name || 'unknown'
  });
  
  // We'll store the installation ID in a cookie for now
  // In a production environment, you might want to store this in a database
  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  
  // Set the installation_id cookie
  response.cookies.set("github_installation_id", installationId, {
    path: "/",
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    sameSite: "lax"
  });
  
  logger.debug(MODULE_NAME, "Redirecting to dashboard with installation_id cookie set");
  
  return response;
}