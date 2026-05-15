export function stripGatewayProviderPrefix(requestedModel: string, providerId: string): string {
  if (requestedModel.startsWith("anthropic/")) {
    return requestedModel.slice("anthropic/".length);
  }
  if (requestedModel.startsWith(`${providerId}/`)) {
    return requestedModel.slice(providerId.length + 1);
  }
  return requestedModel;
}
