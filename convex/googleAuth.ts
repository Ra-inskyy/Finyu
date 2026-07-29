import Google from "@auth/core/providers/google";
import type { AuthProviderConfig } from "@convex-dev/auth/server";

declare const process: { env: Record<string, string | undefined> };

/**
 * Login "Masuk dengan Google" — provider OAuth milik aplikasi ini sendiri
 * (bukan OAuth Viktor). Aktif otomatis begitu dua environment variable ini
 * di-set di deployment Convex:
 *
 *   npx convex env set AUTH_GOOGLE_ID     <client-id>.apps.googleusercontent.com
 *   npx convex env set AUTH_GOOGLE_SECRET <client-secret>
 *
 * Authorized redirect URI yang harus didaftarkan di Google Cloud Console:
 *   https://<deployment>.convex.site/api/auth/callback/google
 *
 * Selama kredensial belum di-set, provider ini tidak didaftarkan sama sekali
 * supaya deployment tetap sehat dan login email/password tetap jalan.
 */
export function googleSignInConfigured(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

type GoogleProfile = {
  sub: string;
  name?: string | null;
  email?: string | null;
  picture?: string | null;
};

export function googleAuthProviders(): AuthProviderConfig[] {
  if (!googleSignInConfigured()) return [];
  return [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Akun Google dengan email yang sama dengan akun email/password yang
      // sudah ada akan digabung, bukan bikin user kedua.
      allowDangerousEmailAccountLinking: true,
      profile(profile: GoogleProfile) {
        return {
          id: profile.sub,
          name: profile.name ?? undefined,
          email: profile.email ?? undefined,
          image: profile.picture ?? undefined,
        };
      },
    }) as unknown as AuthProviderConfig,
  ];
}
