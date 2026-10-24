/**
 * Obido Studio — AI Provider Registry & Factory
 * Manages provider adapters, configurable active providers, and server-side model routing.
 */

import { AIProviderAdapter } from './types';
import { GeminiProviderAdapter } from './geminiAdapter';

export * from './types';
export { GeminiProviderAdapter } from './geminiAdapter';

class ProviderRegistry {
  private providers = new Map<string, AIProviderAdapter>();
  private defaultProviderId: string = 'gemini';

  constructor() {
    // Register native Gemini provider by default
    const gemini = new GeminiProviderAdapter();
    this.register(gemini);
  }

  register(provider: AIProviderAdapter): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(providerId?: string): AIProviderAdapter {
    const targetId = providerId || process.env.DEFAULT_AI_PROVIDER || this.defaultProviderId;
    const provider = this.providers.get(targetId);

    if (!provider) {
      // Fallback to gemini if requested provider isn't found
      const fallback = this.providers.get(this.defaultProviderId);
      if (fallback) return fallback;
      throw new Error(`AI Provider "${targetId}" is not registered`);
    }

    return provider;
  }

  getFallbackProvider(excludeId: string): AIProviderAdapter | null {
    for (const [id, provider] of this.providers.entries()) {
      if (id !== excludeId && provider.isAvailable()) {
        return provider;
      }
    }
    return null;
  }

  hasFallbackProvider(excludeId: string): boolean {
    return this.getFallbackProvider(excludeId) !== null;
  }

  listProviders(): Array<{ id: string; name: string; available: boolean }> {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      available: p.isAvailable(),
    }));
  }
}

export const aiRegistry = new ProviderRegistry();
export const getAIProvider = (providerId?: string) => aiRegistry.getProvider(providerId);
export const getFallbackProvider = (excludeId: string) => aiRegistry.getFallbackProvider(excludeId);
export const hasFallbackProvider = (excludeId: string) => aiRegistry.hasFallbackProvider(excludeId);
