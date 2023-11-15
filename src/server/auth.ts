import { DrizzleAdapter } from "@auth/drizzle-adapter";
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
  UserRole,
  Session,
} from "next-auth";
import { JWT } from "next-auth/jwt";
import DiscordProvider from "next-auth/providers/discord";

import GithubProvider from "next-auth/providers/github";

import { env } from "~/env.mjs";
import { db } from "~/server/db";
import { pgTable } from "~/server/db/schema";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
  }

  enum UserRole {
    "USER",
    "ADMIN",
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  callbacks: {
    session({ session, token }: { session: Session; token: JWT }) {
      console.log(session)
      console.log(token)
      if (token) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.role = token.role;
        session.user.picture = token.picture; // replace 'image' with 'picture'
      }
      return session;
    },
    jwt: async ({ token }: { token: JWT }) => {
      console.log(token);
      const dbUser = await db.query.users.findFirst({
        columns: {
          email: true,
          name: true,
          emailVerified: true,
          role: true,
          id: true,
          image: true,
        },
      });
      console.log(dbUser);
      if (!dbUser) {
        console.log("No User");
        throw new Error("Unable to find user");
      }
      return {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        emailVerified: dbUser.emailVerified,
        role: dbUser.role,
        picture: dbUser.image,
        sub: token.sub,
      };
    },
  },
  session: {
    strategy: "jwt",
  },
  jwt: {
    secret: env.NEXTAUTH_SECRET
  },
  adapter: DrizzleAdapter(db, pgTable),
  providers: [
    GithubProvider({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = () => getServerSession(authOptions);