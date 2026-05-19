// External destinations for provider API key management pages.
// Keep this UI-only: credentials are still stored through the gateway config API.
const API_KEY_LINKS: Record<string, string> = {
  alicode: "https://bailian.console.aliyun.com/?tab=model#/api-key",
  alicode_intl: "https://bailian.console.alibabacloud.com/?tab=model#/api-key",
  blackbox: "https://www.blackbox.ai/dashboard/api-keys",
  byteplus: "https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey",
  cerebras: "https://cloud.cerebras.ai/platform/",
  chutes: "https://chutes.ai/app/api",
  cohere: "https://dashboard.cohere.com/api-keys",
  commandcode: "https://commandcode.ai/studio",
  deepseek: "https://platform.deepseek.com/api_keys",
  fireworks: "https://fireworks.ai/account/api-keys",
  glm: "https://z.ai/manage-apikey/apikey-list",
  glm_cn: "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
  google: "https://aistudio.google.com/apikey",
  groq: "https://console.groq.com/keys",
  huggingface: "https://huggingface.co/settings/tokens",
  hyperbolic: "https://app.hyperbolic.xyz/settings",
  kimi: "https://platform.moonshot.ai/console/api-keys",
  minimax: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
  minimax_cn: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
  mistral: "https://console.mistral.ai/api-keys",
  nebius: "https://studio.nebius.com/settings/api-keys",
  nvidia_nim: "https://build.nvidia.com/settings/api-keys",
  ollama_cloud: "https://ollama.com/settings/keys",
  opencode_go: "https://opencode.ai/zen",
  openrouter: "https://openrouter.ai/settings/keys",
  perplexity: "https://www.perplexity.ai/account/api/keys",
  siliconflow: "https://cloud.siliconflow.cn/account/ak",
  together: "https://api.together.ai/settings/api-keys",
  volcengine_ark: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
  xai: "https://console.x.ai/team/api-keys",
  xiaomi_mimo: "https://platform.mimodel.ai/",
  xiaomi_tokenplan: "https://platform.mimodel.ai/",
};

export function getApiKeyLink(providerId: string): string | null {
  return API_KEY_LINKS[providerId] ?? null;
}
