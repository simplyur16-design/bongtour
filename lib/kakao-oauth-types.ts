export type KakaoTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  error?: string
  error_description?: string
}

export type KakaoUserMeResponse = {
  id: number
  kakao_account?: {
    email?: string
    profile?: {
      nickname?: string
      profile_image_url?: string
    }
  }
}
