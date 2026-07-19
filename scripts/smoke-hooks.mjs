export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: new URL("./smoke-server-only-shim.mjs", import.meta.url).href,
    };
  }
  return nextResolve(specifier, context);
}
