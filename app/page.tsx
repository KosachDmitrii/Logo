import {
  getStudioSession,
  studioSignInPath,
  ensureStudioWallet,
} from "@/backend/auth/session";
import LoopenStudio from "@/frontend/loopen-studio";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getStudioSession();
  let signalBalance: number | null = null;

  if (session.user && (session.role === "user" || session.role === "admin")) {
    try {
      const wallet = await ensureStudioWallet(session.user.email);
      signalBalance = wallet.balance;
    } catch {
      signalBalance = null;
    }
  }

  return (
    <LoopenStudio
      role={session.role}
      user={
        session.user
          ? {
              displayName: session.user.displayName,
              email: session.user.email,
              signalBalance,
              source: session.user.source,
              role: session.role,
            }
          : null
      }
      signInPath={studioSignInPath("/#brief")}
    />
  );
}
