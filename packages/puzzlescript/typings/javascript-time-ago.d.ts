// TypeScript definition for the package

interface TimeAgoLocale {
}

declare module 'javascript-time-ago' {

    export enum TimeAgoFlavour {
        'long',
        'short',
        'narrow',
        'tiny'
    }

    export enum TimeAgoUnit {
        'second',
        'minute',
        'hour',
        'day',
        'week',
        'month',
        'quarter',
        'year'
    }
    export type TimeAgoStyle = {
        flavour: TimeAgoFlavour | TimeAgoFlavour[]
        gradation: 'convenient' | 'canonical' // | Custom. see https://github.com/catamphetamine/javascript-time-ago/#customization
        units: TimeAgoUnit[]
    }
    class TimeAgo {
        static addLocale(config: TimeAgoLocale): void
        constructor(locale: 'en-US')
        format(msSinceEpoch: number, style?: 'twitter' | 'time' | TimeAgoStyle): string
    }

    export default TimeAgo
 
}

declare module 'javascript-time-ago/locale/en' {
    const t: TimeAgoLocale
    export default t
}