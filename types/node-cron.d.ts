declare module 'node-cron' {
  const cron: {
    schedule(expression: string, task: () => void): { stop: () => void }
  }
  export default cron
}
