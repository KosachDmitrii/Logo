import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
} from "./chatgpt-auth";
import LoopenStudio from "./loopen-studio";

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
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
