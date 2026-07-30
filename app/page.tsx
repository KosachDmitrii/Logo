import {
  chatGPTSignInPath,
  getChatGPTUser,
} from "@/backend/auth/chatgpt-auth";
import LoopenStudio from "@/frontend/loopen-studio";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  return (
    <LoopenStudio
      user={
        user
          ? {
              displayName: user.displayName,
              email: user.email,
            }
          : null
      }
      signInPath={chatGPTSignInPath("/#brief")}
    />
  );
}
