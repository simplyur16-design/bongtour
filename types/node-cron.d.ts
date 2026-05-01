declare module 'node-cron' {
  type CronScheduleOptions = { timezone?: string; scheduled?: boolean }
  const cron: {
    schedule(expression: string, task: () => void, options?: CronScheduleOptions): { stop: () => void }
  }
  export default cron
}
