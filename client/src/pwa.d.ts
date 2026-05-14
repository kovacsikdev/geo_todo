declare global {
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[]
    prompt: () => Promise<void>
    userChoice: Promise<{
      outcome: 'accepted' | 'dismissed'
      platform: string
    }>
  }

  interface Navigator {
    standalone?: boolean
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }

  interface Window {
    __geoTodoBeforeInstallPromptEvent?: BeforeInstallPromptEvent | null
  }
}

export {}
