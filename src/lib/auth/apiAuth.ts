import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isGitHubTokenValid } from "./tokenValidator";
import { logger } from "../logger";

const MODULE_NAME = "auth:apiAuth";

/**
 * Type for API route handler
 */
export type ApiRouteHandler = (
  req: NextRequest,
  session: any
) => Promise<NextResponse>;

/**
 * Middleware to protect API routes with authentication validation
 */
export function withAuthValidation(handler: ApiRouteHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Get the session from the request
    const session = await getServerSession(authOptions);

    // If no session, return unauthorized response
    if (!session) {
      logger.warn(MODULE_NAME, "Unauthorized API request - no session", {
        url: req.url,
      });
      
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "You must be signed in to access this resource",
          code: "NOT_AUTHENTICATED",
        },
        { status: 401 }
      );
    }

    // If no access token in session, return unauthorized with specific error
    if (!session.accessToken) {
      logger.warn(MODULE_NAME, "Missing GitHub token in session", {
        url: req.url,
        user: session.user?.email || "unknown",
      });
      
      return NextResponse.json(
        {
          error: "GitHub authentication required",
          message: "Your session is missing GitHub authentication. Please sign in again.",
          code: "MISSING_GITHUB_TOKEN",
          signOutRequired: true,
        },
        { status: 403 }
      );
    }

    // Validate the GitHub token
    const isValid = await isGitHubTokenValid(session.accessToken);
    
    if (!isValid) {
      logger.warn(MODULE_NAME, "Invalid or expired GitHub token", {
        url: req.url,
        user: session.user?.email || "unknown",
      });
      
      return NextResponse.json(
        {
          error: "Invalid GitHub authentication",
          message: "Your GitHub token is invalid or expired. Please sign in again.",
          code: "INVALID_GITHUB_TOKEN",
          signOutRequired: true,
        },
        { status: 403 }
      );
    }

    // Token is valid, proceed with the handler
    try {
      return await handler(req, session);
    } catch (error) {
      logger.error(MODULE_NAME, "Error in API route handler", {
        url: req.url,
        error,
      });
      
      return NextResponse.json(
        {
          error: "Internal server error",
          message: "An error occurred while processing your request",
        },
        { status: 500 }
      );
    }
  };
}