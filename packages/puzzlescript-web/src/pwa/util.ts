import { Optional } from 'puzzlescript'

declare const ga: Optional<(a1: string, a2: string, a3?: string, a4?: string, a5?: string, a6?: number) => void>

export function sendAnalytics(a1: string, a2: string, a3?: string, a4?: string, a5?: string, a6?: number) {
    if (!window.localStorage.getItem('disableAnalytics')) {
        ga && ga(a1, a2, a3, a4, a5, a6)
    }
}

export function getElement<T extends HTMLElement>(selector: string) {
    const el: Optional<T> = document.querySelector(selector)
    if (!el) {
        throw new Error(`BUG: Could not find "${selector}" in the page`)
    }
    return el
}

export const sendPageview = () => {
    const { hash, pathname, search } = window.location
    sendAnalytics('set', 'page', `${pathname}${search}${hash}`)
    // ga('set', 'title', gameTitle)
    sendAnalytics('send', 'pageview')
}

export const changePage = (gameId: string, level: number) => {
    history.replaceState(undefined, undefined as any as string, `#/${gameId}/${level}`)
    sendPageview()
}
