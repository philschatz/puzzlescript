declare module "dialog-polyfill" {
    interface DialogPolyfill {
        registerDialog(el: Element): void
    }
    var dialogPolyfill: DialogPolyfill
    export = dialogPolyfill
}