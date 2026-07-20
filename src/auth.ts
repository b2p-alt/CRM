import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ROLE_REVALIDATE_MS = 5 * 60 * 1000; // 5 minutos

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // Users with no password set cannot log in via normal login
        if (!user.password) return null;

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) return null;

        return {
          id: user.id,
          name: user.nome,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.mustChangePassword = (user as { mustChangePassword: boolean }).mustChangePassword;
        token.roleCheckedAt = Date.now();
        return token;
      }

      // Revalida a role a partir da BD de tempos a tempos, para que uma promoção/despromoção
      // feita em /utilizadores não fique presa no token até o utilizador fazer logout manual.
      const lastChecked = (token.roleCheckedAt as number | undefined) ?? 0;
      if (Date.now() - lastChecked > ROLE_REVALIDATE_MS) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, mustChangePassword: true },
        });
        if (!dbUser) return null; // utilizador eliminado — termina a sessão
        token.role = dbUser.role;
        token.mustChangePassword = dbUser.mustChangePassword;
        token.roleCheckedAt = Date.now();
      }

      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.mustChangePassword = token.mustChangePassword as boolean;
      return session;
    },
  },
});
