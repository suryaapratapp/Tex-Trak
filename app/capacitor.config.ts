import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'uk.co.circai.textrak',
  appName: 'Tex-Trak',
  webDir: 'dist',
  android: { allowMixedContent: false },
  server: { androidScheme: 'https' },
}
export default config
