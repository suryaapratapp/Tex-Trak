import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'uk.co.circai.textrak',
  appName: 'Tex-Trak',
  webDir: 'dist',
  // useLegacyBridge keeps location updates flowing when the screen is off; CapacitorHttp makes network calls reliable in the background.
  android: { allowMixedContent: false, useLegacyBridge: true },
  plugins: { CapacitorHttp: { enabled: true } },
  server: { androidScheme: 'https' },
}
export default config
