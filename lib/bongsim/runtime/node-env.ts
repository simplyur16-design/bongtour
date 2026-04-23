/** Single definition of “production” for security guards (Next sets NODE_ENV at build). */
export function isNodeProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
