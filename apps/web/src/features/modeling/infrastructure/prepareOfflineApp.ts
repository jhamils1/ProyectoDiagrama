import { registerSW } from 'virtual:pwa-register'

export async function prepareOfflineApp() {
  if (!('serviceWorker' in navigator))
    throw new Error('Este navegador necesita soporte PWA para preparar la aplicación.')
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    // Empty projects have not mounted EditorView, so its registration hook has not run yet.
    registerSW({ immediate: true })
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'Abre la versión compilada y espera a que termine la preparación de la aplicación.',
              ),
            ),
          10000,
        )
      }),
    ])
    if (!registration.active)
      throw new Error('Espera a que termine la preparación de la aplicación.')
  } finally {
    clearTimeout(timer)
  }
}
