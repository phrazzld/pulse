import NextAuth, { Session, User, Account, Profile, type NextAuthOptions } from "next-auth";
import GitHubProvider, { GithubProfile } from "next-auth/providers/github";
import { logger } from "@/lib/logger";
import { checkAppInstallation } from "@/lib/github";
import { NextRequest } from "next/server";

// Add type for JWT token
interface ExtendedToken {
  accessToken?: string;
  installationId?: number;
  [key: string]: any;
}

// Add type for Extended Session
interface ExtendedSession extends Session {
  accessToken?: string;
  installationId?: number;
}

const MODULE_NAME = "api:auth";

// A helper function to generate consistent callback URL
function getCallbackUrl() {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${baseUrl}/api/auth/callback/github`;
}

// Check and handle GitHub App installation flow
function isGitHubAppInstallationCallback(req: NextRequest) {
  // Get the installation_id and setup_action from the request
  const url = new URL(req.url);
  const installationId = url.searchParams.get('installation_id');
  const setupAction = url.searchParams.get('setup_action');
  
  return installationId && setupAction === 'install';
}

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_OAUTH_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET as string,
      authorization: {
        params: {
          scope: "repo read:user read:org user:email", // Comprehensive scopes for full repository access
        },
        url: "https://github.com/login/oauth/authorize",
      },
      // @ts-ignore - callbackUrl is not in the type but it works
      callbackUrl: getCallbackUrl(),
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }: { token: ExtendedToken; account: Account | null; user: User | undefined }) {
      logger.debug(MODULE_NAME, "JWT callback called", { 
        hasToken: !!token,
        hasAccount: !!account,
        hasUser: !!user
      });
      
      if (account) {
        logger.info(MODULE_NAME, "Adding access token to JWT", { 
          provider: account.provider,
          tokenType: account.type,
          // Do not log actual token values
          hasAccessToken: !!account.access_token
        });
        
        token.accessToken = account.access_token;
        
        // Check for GitHub App installation when we first get an access token
        try {
          if (account.access_token) {
            const installationId = await checkAppInstallation(account.access_token);
            if (installationId) {
              logger.info(MODULE_NAME, "Found GitHub App installation during auth", { installationId });
              token.installationId = installationId;
            } else {
              logger.info(MODULE_NAME, "No GitHub App installation found during auth");
            }
          }
        } catch (error) {
          logger.warn(MODULE_NAME, "Error checking for GitHub App installation during auth", { error });
        }
      }
      
      return token;
    },
    async session({ session, token }: { session: ExtendedSession; token: ExtendedToken; user: User }) {
      logger.debug(MODULE_NAME, "Session callback called", { 
        hasSession: !!session, 
        hasToken: !!token,
        hasAccessToken: !!token.accessToken,
        hasInstallationId: !!token.installationId
      });
      
      // Add token and installation ID to the session
      session.accessToken = token.accessToken;
      
      if (token.installationId) {
        session.installationId = token.installationId;
        logger.debug(MODULE_NAME, "Added installation ID to session", { installationId: token.installationId });
      }
      
      logger.info(MODULE_NAME, "Session created/updated", {
        user: session.user?.email || session.user?.name || 'unknown',
        hasInstallationId: !!session.installationId
      });
      
      return session;
    },
    async signIn({ user, account, profile }: { user: User; account: Account | null; profile?: Profile }) {
      if (!account) return false;
      
      logger.info(MODULE_NAME, "User sign in", {
        provider: account.provider,
        userId: user.id,
        userName: user.name || 'unknown'
      });
      
      return true;
    },
  },
  events: {
    async signIn(message: { user: User }) {
      logger.info(MODULE_NAME, "User signed in successfully", {
        user: message.user.email || message.user.name || 'unknown'
      });
    },
    async signOut(message: { token: ExtendedToken }) {
      logger.info(MODULE_NAME, "User signed out", {
        user: message.token.email || message.token.name || 'unknown'
      });
    }
  },
  // Override NextAuth's logger with our own implementation in events
  logger: undefined,
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  },
  
  // Properly handle the callback URL problems
  pages: {
    signIn: '/api/auth/signin',
    signOut: '/api/auth/signout',
    error: '/api/auth/error',
    verifyRequest: '/api/auth/verify-request',
  },
  
  // Add debug mode for development
  debug: process.env.NODE_ENV !== 'production'
};

// Create a function to check for GitHub App installation callbacks
async function handleRequest(req: NextRequest) {
  // Check if this is a GitHub App installation callback
  if (isGitHubAppInstallationCallback(req)) {
    logger.info(MODULE_NAME, "Intercepted GitHub App installation callback");
    
    // Get the installation_id from the URL
    const url = new URL(req.url);
    const installationId = url.searchParams.get('installation_id');
    
    // Redirect to our setup route with the installation_id
    const redirectUrl = new URL('/api/github/setup', req.url);
    redirectUrl.searchParams.set('installation_id', installationId as string);
    
    logger.debug(MODULE_NAME, "Redirecting to setup route", { redirectUrl: redirectUrl.toString() });
    
    return Response.redirect(redirectUrl.toString());
  }
  
  // If not an installation callback, continue with NextAuth
  return null;
}

// Create the NextAuth handler with a wrapper for our custom logic
const handler = async (req: NextRequest, ...rest: any[]) => {
  // First check if it's an installation callback
  const redirectResponse = await handleRequest(req);
  if (redirectResponse) {
    return redirectResponse;
  }
  
  // Otherwise, use NextAuth's handler
  const nextAuthHandler = NextAuth(authOptions);
  return nextAuthHandler(req, ...rest);
};

export { handler as GET, handler as POST };