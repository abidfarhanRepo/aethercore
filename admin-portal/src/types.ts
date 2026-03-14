export type DockerSummary = {
  total: number
  healthy: number
  running: number
  unhealthy: number
  services: Array<Record<string, unknown>>
}

export type OrgSummary = {
  name: string
  createdAt: string
  env: Record<string, string>
  docker: DockerSummary
  lastBackup: string | null
}
