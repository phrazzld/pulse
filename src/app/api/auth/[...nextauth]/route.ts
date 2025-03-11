import NextAuth from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { logger } from "@/lib/logger";

const MODULE_NAME = "api:auth";

export const authOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_OAUTH_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET as string,
      scope: "repo",  // Required to access commit histories
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
      }
      
      return token;
    },
    async session({ session, token, user }) {
      logger.debug(MODULE_NAME, "Session callback called", { 
        hasSession: !!session, 
        hasToken: !!token,
        hasUser: !!user,
        hasAccessToken: !!token.accessToken
      });
      
      session.accessToken = token.accessToken;
      
      logger.info(MODULE_NAME, "Session created/updated", {
        user: session.user?.email || session.user?.name || 'unknown'
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
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };