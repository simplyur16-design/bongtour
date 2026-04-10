export function resolvePythonExecutable(): string {
  const fromEnv = (process.env.PYTHON ?? process.env.PYTHON_EXECUTABLE ?? '').trim()
  if (fromEnv) return fromEnv
  return process.platform === 'win32' ? 'python' : 'python3'
}

