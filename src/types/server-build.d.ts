import 'pinia-plugin-persistedstate'

declare global {
  const __APP_VERSION__: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}

declare module 'nprogress' {
  interface NProgressOptions {
    minimum?: number
    template?: string
    easing?: string
    speed?: number
    trickle?: boolean
    trickleSpeed?: number
    showSpinner?: boolean
    parent?: string
    positionUsing?: string
    barSelector?: string
    spinnerSelector?: string
  }

  interface NProgress {
    configure(options: Partial<NProgressOptions>): NProgress
    start(): NProgress
    done(force?: boolean): NProgress
    inc(amount?: number): NProgress
    set(n: number): NProgress
    remove(): void
    status: number | null
  }

  const nprogress: NProgress
  export default nprogress
}

export {}
