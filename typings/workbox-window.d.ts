declare module "workbox-window" {

    type EventHandler = (event: any) => void
    export class Workbox {
        constructor(serviceWorkerPath: string)
        addEventListener(name: string, handler: EventHandler): void
        messageSW(message: {type: 'SKIP_WAITING'}): void
        register(): void
    }
}