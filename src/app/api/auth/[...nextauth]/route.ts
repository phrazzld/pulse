import NextAuth from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { logger } from "@/lib/logger";
import { checkAppInstallation } from "@/lib/github";

const MODULE_NAME = "api:auth";

// A helper function to generate consistent callback URL
function getCallbackUrl() {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${baseUrl}/api/auth/callback/github`;
}

export const authOptions = {
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
      // Force the provider to use the official callback URL
      callbackUrl: getCallbackUrl(),
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      logger.debug(MODULE_NAME, "JWT callback called", { 
        hasToken: !!token,
        hasAccount: !!account,
        hasUser: !!user
      });
      
      if (account) {
        logger.info(MODULE_NAME, "Adding access token to JWT", { 
          provider: account.provider,
          tokenType: account.token_type,
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
    async session({ session, token, user }) {
      logger.debug(MODULE_NAME, "Session callback called", { 
        hasSession: !!session, 
        hasToken: !!token,
        hasUser: !!user,
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
    async signIn({ user, account, profile }) {
      logger.info(MODULE_NAME, "User sign in", {
        provider: account?.provider,
        userId: user.id,
        userName: user.name || 'unknown'
      });
      
      return true;
    },
  },
  events: {
    async signIn(message) {
      logger.info(MODULE_NAME, "User signed in successfully", {
        user: message.user.email || message.user.name || 'unknown'
      });
    },
    async signOut(message) {
      logger.info(MODULE_NAME, "User signed out", {
        user: message.token.email || message.token.name || 'unknown'
      });
    },
    async error(message) {
      logger.error(MODULE_NAME, "Authentication error", { 
        error: message.error 
      });
    }
  },
  logger: {
    error(code, ...message) {
      logger.error(MODULE_NAME, `NextAuth error: ${code}`, { message });
    },
    warn(code, ...message) {
      logger.warn(MODULE_NAME, `NextAuth warning: ${code}`, { message });
    },
    debug(code, ...message) {
      logger.debug(MODULE_NAME, `NextAuth debug: ${code}`, { message });
    },
  },
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };