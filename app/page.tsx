import {
  getStudioUser,
  studioSignInPath,
  ensureStudioWallet,
} from "@/backend/auth/session";
import LoopenStudio from "@/frontend/loopen-studio";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getStudioUser();
  let signalBalance: number | null = null;

  if (user) {
    try {
      const wallet = await ensureStudioWallet(user.email);
      signalBalance = wallet.balance;
    } catch {
      signalBalance = null;
    }
  }

  return (
    <LoopenStudio
      user={
        user
          ? {
              displayName: user.displayName,
              email: user.email,
              signalBalance,
            }
          : null
      }
      signInPath={studioSignInPath("/#brief")}
    />
  );
}
