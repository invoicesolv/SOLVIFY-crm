import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string;
      name?: string;
      image?: string;
      role?: string;
    };
    access_token: string;
    refresh_token: string;
  }

  interface User {
    id: string;
    email?: string;
    name?: string;
    image?: string;
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    access_token: string;
    refresh_token: string;
  }
}

export {} 