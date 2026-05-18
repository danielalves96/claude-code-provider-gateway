export function stripGatewayProviderPrefix(requestedModel: string, providerId: string): string {
  let model = requestedModel;
  if (model.startsWith("anthropic/")) {
    model = model.slice("anthropic/".length);
  }
  if (model.startsWith(`${providerId}/`)) {
    return model.slice(providerId.length + 1);
  }
  return model;
}
