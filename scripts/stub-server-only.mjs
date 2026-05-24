/** tsx 스크립트에서 `import "server-only"` 무력화 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      format: "module",
      shortCircuit: true,
      url: "data:text/javascript,export default {};",
    };
  }
  return nextResolve(specifier, context);
}
