import type { Config, ProviderConfig, ProviderId } from "../../config/schema.js";
import { PROVIDER_IDS } from "../../config/schema.js";
import { AlicodeProvider } from "./alicode.js";
import { AlicodeIntlProvider } from "./alicode-intl.js";
import type { BaseProvider } from "./base.js";
import { BlackboxProvider } from "./blackbox.js";
import { BytePlusProvider } from "./byteplus.js";
import { CerebrasProvider } from "./cerebras.js";
import { ChutesProvider } from "./chutes.js";
import { ClineProvider } from "./cline.js";
import { CohereProvider } from "./cohere.js";
import { CommandCodeProvider } from "./commandcode.js";
import { CopilotProvider } from "./copilot.js";
import { DeepSeekProvider } from "./deepseek.js";
import { FireworksProvider } from "./fireworks.js";
import { GLMProvider } from "./glm.js";
import { GLMCNProvider } from "./glm-cn.js";
import { GoogleProvider } from "./google.js";
import { GroqProvider } from "./groq.js";
import { HuggingFaceProvider } from "./huggingface.js";
import { HyperbolicProvider } from "./hyperbolic.js";
import { IFlowProvider } from "./iflow.js";
import { KiloCodeProvider } from "./kilocode.js";
import { KimiProvider } from "./kimi.js";
import { KiroProvider } from "./kiro.js";
import { LlamaCppProvider } from "./llamacpp.js";
import { LMStudioProvider } from "./lmstudio.js";
import { MinimaxProvider } from "./minimax.js";
import { MinimaxCNProvider } from "./minimax-cn.js";
import { MistralProvider } from "./mistral.js";
import { NebiusProvider } from "./nebius.js";
import { NvidiaNimProvider } from "./nvidia-nim.js";
import { OllamaProvider } from "./ollama.js";
import { OllamaCloudProvider } from "./ollama-cloud.js";
import { OpenAIAccountProvider } from "./openai-account.js";
import { OpenCodeGoProvider } from "./opencode-go.js";
import { OpenRouterProvider } from "./openrouter.js";
import { PerplexityProvider } from "./perplexity.js";
import { SiliconFlowProvider } from "./siliconflow.js";
import { TogetherProvider } from "./together.js";
import { VolcengineArkProvider } from "./volcengine-ark.js";
import { XAIProvider } from "./xai.js";
import { XiaomiMimoProvider } from "./xiaomi-mimo.js";
import { XiaomiTokenPlanProvider } from "./xiaomi-tokenplan.js";

type ProviderConstructor = new (config: ProviderConfig, rootConfig: Config) => BaseProvider;

const PROVIDER_MAP: Record<ProviderId, ProviderConstructor> = {
  openai_account: OpenAIAccountProvider,
  copilot: CopilotProvider,
  nvidia_nim: NvidiaNimProvider,
  openrouter: OpenRouterProvider,
  deepseek: DeepSeekProvider,
  kimi: KimiProvider,
  google: GoogleProvider,
  ollama: OllamaProvider,
  lmstudio: LMStudioProvider,
  llamacpp: LlamaCppProvider,
  groq: GroqProvider,
  xai: XAIProvider,
  mistral: MistralProvider,
  cerebras: CerebrasProvider,
  together: TogetherProvider,
  fireworks: FireworksProvider,
  glm: GLMProvider,
  siliconflow: SiliconFlowProvider,
  hyperbolic: HyperbolicProvider,
  chutes: ChutesProvider,
  perplexity: PerplexityProvider,
  nebius: NebiusProvider,
  glm_cn: GLMCNProvider,
  volcengine_ark: VolcengineArkProvider,
  byteplus: BytePlusProvider,
  alicode: AlicodeProvider,
  alicode_intl: AlicodeIntlProvider,
  minimax: MinimaxProvider,
  minimax_cn: MinimaxCNProvider,
  opencode_go: OpenCodeGoProvider,
  xiaomi_mimo: XiaomiMimoProvider,
  xiaomi_tokenplan: XiaomiTokenPlanProvider,
  cohere: CohereProvider,
  blackbox: BlackboxProvider,
  huggingface: HuggingFaceProvider,
  kiro: KiroProvider,
  iflow: IFlowProvider,
  kilocode: KiloCodeProvider,
  cline: ClineProvider,
  ollama_cloud: OllamaCloudProvider,
  commandcode: CommandCodeProvider,
};

export class ProviderRegistry {
  private cache = new Map<ProviderId, BaseProvider>();

  constructor(private config: Config) {}

  get(id: ProviderId): BaseProvider | null {
    const providerConfig = this.config.providers[id];
    if (!providerConfig?.enabled) return null;

    if (!this.cache.has(id)) {
      const Ctor = PROVIDER_MAP[id];
      this.cache.set(id, new Ctor(providerConfig, this.config));
    }

    return this.cache.get(id)!;
  }

  getActive(): BaseProvider | null {
    return this.get(this.config.activeProvider);
  }

  updateConfig(config: Config): void {
    this.config = config;
    this.cache.clear();
  }

  all(): Array<{ id: ProviderId; provider: BaseProvider }> {
    const result: Array<{ id: ProviderId; provider: BaseProvider }> = [];
    for (const id of PROVIDER_IDS) {
      const p = this.get(id);
      if (p) result.push({ id, provider: p });
    }
    return result;
  }
}
