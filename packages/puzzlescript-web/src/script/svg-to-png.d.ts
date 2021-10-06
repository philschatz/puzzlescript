declare module "svg-to-png" {
    interface SvgToPng {
        convert(input: string | string[], outputDir: string, options: any): void
    }
    var v: SvgToPng
    export = v
}