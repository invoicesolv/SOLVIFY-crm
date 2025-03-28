import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string;
    } & DefaultSession["user"];
    accessToken: string;
    refreshToken: string;
    access_token: string;
    refresh_token: string;
  }
}

export {} 