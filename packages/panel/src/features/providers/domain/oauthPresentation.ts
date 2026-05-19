// Per-provider strings shown in the OAuth login section, device-flow prompt,
// and login button. Adding a new OAuth provider? Add an entry here.

export interface OAuthPresentation {
  accountLabel: string;
  loginIdle: string;
  loginBusy: string;
  approvalSite: string;
  waitingText: string;
}

const PRESENTATIONS: Record<string, OAuthPresentation> = {
  openai_account: {
    accountLabel: "OpenAI account",
    loginIdle: "Login with OpenAI",
    loginBusy: "Waiting for browser…",
    approvalSite: "the OpenAI authorization page",
    waitingText: "Waiting for OpenAI approval…",
  },
  copilot: {
    accountLabel: "GitHub account",
    loginIdle: "Login with GitHub",
    loginBusy: "Starting GitHub login…",
    approvalSite: "the GitHub authorization page",
    waitingText: "Waiting for GitHub approval…",
  },
  kilocode: {
    accountLabel: "Kilo Code account",
    loginIdle: "Login with Kilo Code",
    loginBusy: "Waiting for Kilo Code approval…",
    approvalSite: "the Kilo Code authorization page",
    waitingText: "Waiting for Kilo Code approval…",
  },
  cline: {
    accountLabel: "Cline account",
    loginIdle: "Login with Cline",
    loginBusy: "Waiting for browser…",
    approvalSite: "the Cline authorization page",
    waitingText: "Waiting for Cline approval…",
  },
};

export function getOAuthPresentation(providerId: string, fallbackLabel: string): OAuthPresentation {
  return (
    PRESENTATIONS[providerId] ?? {
      accountLabel: `${fallbackLabel} account`,
      loginIdle: `Login with ${fallbackLabel}`,
      loginBusy: "Waiting for approval…",
      approvalSite: `the ${fallbackLabel} authorization page`,
      waitingText: `Waiting for ${fallbackLabel} approval…`,
    }
  );
}
