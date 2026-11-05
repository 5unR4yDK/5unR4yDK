import { useCallback, useEffect, useState } from 'react'
import type { Menu } from './types'
import Editor from './components/Editor'
import MenuPage from './components/MenuPage'
import type { FitReport } from './components/MenuPage'
import Preview from './components/Preview'
import { sampleMenu } from './sample'
import { loadFromHash, loadLocal, saveLocal, shareUrl } from './storage'

const PAGE_STYLE_ID = 'xafarix-page-size'

/**
 * `@page` cannot be written with a CSS custom property, so the rule that tells
 * the printer whether the sheet is portrait or landscape is injected directly.
 * Without this the browser prints portrait regardless and crops a landscape
 * menu.
 */
function usePageSizeRule(orientation: string) {
  useEffect(() => {
    let el = document.getElementById(PAGE_STYLE_ID) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = PAGE_STYLE_ID
      document.head.appendChild(el)
    }
    el.textContent = `@page { size: A4 ${orientation}; margin: 0; }`
  }, [orientation])
}

function initialMenu(): Menu {
  return loadFromHash() ?? loadLocal() ?? sampleMenu
}

export default function App() {
  const [menu, setMenu] = useState<Menu>(initialMenu)
  const [fit, setFit] = useState<FitReport | null>(null)
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle')

  usePageSizeRule(menu.orientation)

  useEffect(() => {
    saveLocal(menu)
    setShareState('idle')
  }, [menu])

  const onFit = useCallback((report: FitReport) => setFit(report), [])

  const onPrint = useCallback(() => {
    // The fit has already run synchronously in a layout effect, so the page is
    // correct by the time the dialog opens.
    window.print()
  }, [])

  const onShare = useCallback(async () => {
    const url = shareUrl(menu)
    // Put it in the address bar either way, so there is still a link to copy
    // by hand if the clipboard is unavailable (it needs a secure context).
    window.history.replaceState(null, '', url)
    try {
      await navigator.clipboard.writeText(url)
      setShareState('copied')
    } catch {
      setShareState('failed')
    }
  }, [menu])

  return (
    <div className="app">
      <Editor
        menu={menu}
        setMenu={setMenu}
        fit={fit}
        onPrint={onPrint}
        onShare={onShare}
        shareState={shareState}
      />
      <Preview orientation={menu.orientation}>
        <MenuPage menu={menu} onFit={onFit} />
      </Preview>
    </div>
  )
}
