import { revalidatePath } from 'next/cache'

/**
 * 국외연수 프로그램 목록·허브 미리보기 Full Route Cache 무효화.
 * REGRESSION-FREEZE[business-training-programs-empty-poison]: admin mutate must bust /business — manifest
 */
export function revalidateTrainingProgramListingCaches(): void {
  revalidatePath('/business')
  revalidatePath('/business/programs')
  revalidatePath('/training')
}
