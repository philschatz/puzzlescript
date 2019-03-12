import { Optional } from '../util'

declare const ga: Optional<(a1: string, a2: string, a3?: string, a4?: string, a5?: string, a6?: number) => void>

export function sendAnalytics(a1: string, a2: string, a3?: string, a4?: string, a5?: string, a6?: number) {
    ga && ga(a1, a2, a3, a4, a5, a6)
}

export function getElement<T extends HTMLElement>(selector: string) {
    const el: Optional<T> = document.querySelector(selector)
    if (!el) {
        throw new Error(`BUG: Could not find "${selector}" in the page`)
    }
    return el
}

export const changePage = (gameId: string, level: number) => {
    window.location.hash = `#${gameId}|${level}`
    if (ga) {
        const { pathname, search } = window.location
        ga('set', 'page', `${pathname}${search}#${gameId}|${level}`)
        // ga('set', 'title', gameTitle)
        ga('send', 'pageview')
    }
}
