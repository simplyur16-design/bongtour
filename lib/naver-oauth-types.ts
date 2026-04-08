export type NaverTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: string | number
  token_type?: string
  error?: string
  error_description?: string
}

export type NaverProfileResponse = {
  resultcode: string
  message: string
  response: {
    id: string
    email?: string
    name?: string
    nickname?: string
    profile_image?: string
  }
}
