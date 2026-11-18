/* Shared interactions; delegation survives Butterfly's PJAX navigation. */
(() => {
  if (window.yunfeiUI) return
  window.yunfeiUI = true
  const root = document.documentElement
  let scrollPending = false
  const sidebarStorageKey = 'yunfei.sidebarWidth'
  const defaultSidebarWidth = 190
  let sidebarWidth = defaultSidebarWidth
  let sidebarDrag = null
  try {
    const saved = Number(localStorage.getItem(sidebarStorageKey))
    if (Number.isFinite(saved) && saved >= defaultSidebarWidth && saved <= 480) sidebarWidth = saved
  } catch { /* Keep resizing available when browser storage is disabled. */ }

  const sidebarLimits = () => {
    const style = getComputedStyle(root)
    const readingMax = parseFloat(style.getPropertyValue('--yf-reading-max-width'))
    const min = parseFloat(style.getPropertyValue('--yf-sidebar-default-width'))
    const gap = parseFloat(style.getPropertyValue('--yf-layout-gap'))
    const readingWidth = Math.max(0, Math.min(readingMax, root.clientWidth - 80 - min - gap))
    const extra = Math.min(480 - defaultSidebarWidth, Math.max(0, root.clientWidth - 40 - min - gap - readingWidth))
    return { min, max: min + extra, readingWidth, gap }
  }
  const applySidebarWidth = () => {
    const { min, max, readingWidth, gap } = sidebarLimits()
    const width = min + Math.min(max - min, sidebarWidth - defaultSidebarWidth)
    const desktop = window.matchMedia('(min-width: 901px)').matches
    if (desktop) {
      root.style.setProperty('--yf-sidebar-width', width + 'px')
      root.style.setProperty('--yf-reading-width', readingWidth + 'px')
      const gutter = Math.max(40, Math.min(80, root.clientWidth - width - gap - readingWidth))
      root.style.setProperty('--yf-layout-gutter', gutter + 'px')
    } else {
      for (const property of ['--yf-sidebar-width', '--yf-reading-width', '--yf-layout-gutter']) root.style.removeProperty(property)
    }
    const handle = document.querySelector('.sidebar-resize-handle')
    if (!handle) return
    const disabled = max <= min || !desktop
    handle.setAttribute('aria-disabled', String(disabled))
    handle.setAttribute('tabindex', disabled ? '-1' : '0')
    handle.setAttribute('aria-valuemin', String(min))
    handle.setAttribute('aria-valuemax', String(max))
    handle.setAttribute('aria-valuenow', String(Math.round(width)))
  }
  const saveSidebarWidth = () => {
    try {
      if (sidebarWidth === defaultSidebarWidth) localStorage.removeItem(sidebarStorageKey)
      else localStorage.setItem(sidebarStorageKey, String(sidebarWidth))
    } catch { /* The current page can still use the chosen width. */ }
  }
  const finishSidebarDrag = (cancel = false) => {
    if (!sidebarDrag) return
    const drag = sidebarDrag
    sidebarDrag = null
    if (cancel) sidebarWidth = drag.previousWidth
    root.classList.remove('is-resizing-sidebar')
    if (drag.handle.hasPointerCapture(drag.pointerId)) drag.handle.releasePointerCapture(drag.pointerId)
    applySidebarWidth()
    saveSidebarWidth()
    window.dispatchEvent(new Event('resize'))
  }

  const positionContactPopover = () => {
    const contact = document.querySelector('#aside-content .profile-contact[open]')
    if (!contact) return
    const panel = contact.querySelector('.contact-popover')
    if (!window.matchMedia('(min-width: 901px)').matches) {
      panel.style.removeProperty('left')
      panel.style.removeProperty('top')
      return
    }
    const anchor = contact.querySelector('summary').getBoundingClientRect()
    const profile = contact.closest('.profile-sidebar').getBoundingClientRect()
    if (anchor.bottom < profile.top || anchor.top > profile.bottom) {
      contact.open = false
      return
    }
    panel.style.left = Math.max(16, Math.min(anchor.left, innerWidth - panel.offsetWidth - 16)) + 'px'
    const below = anchor.bottom + 10
    panel.style.top = (below + panel.offsetHeight <= innerHeight - 16 ? below : Math.max(16, anchor.top - panel.offsetHeight - 10)) + 'px'
  }
  const updateScroll = () => {
    document.getElementById('nav')?.classList.toggle('is-scrolled', window.scrollY > 80)
    positionContactPopover()
    scrollPending = false
  }
  const syncTheme = () => {
    const dark = root.dataset.theme === 'dark'
    const toggle = document.getElementById('theme-toggle')
    toggle?.setAttribute('aria-pressed', String(dark))
    toggle?.setAttribute('aria-label', dark ? '切换至日间模式' : '切换至夜间模式')
    const themeColor = document.querySelector('meta[name="theme-color"]')
    if (themeColor) themeColor.content = dark ? '#1c1d1b' : '#f5f4f0'
  }
  const init = () => {
    applySidebarWidth()
    updateScroll()
    syncTheme()
    const pathname = location.pathname.replace(/\/$/, '') || '/'
    document.querySelectorAll('#nav .menus_item > a').forEach(link => {
      const target = new URL(link.href).pathname.replace(/\/$/, '') || '/'
      const active = target === '/' ? !/^\/(projects|about)(\/|$)/.test(pathname) : pathname === target || pathname.startsWith(target + '/')
      if (active) link.setAttribute('aria-current', 'page')
      else link.removeAttribute('aria-current')
    })
    const all = document.querySelector('.profile-category[data-category="all"]')
    all?.classList.toggle('is-active', document.getElementById('body-wrap')?.dataset.pageType === 'home')
  }
  window.addEventListener('scroll', () => {
    if (!scrollPending) {
      scrollPending = true
      requestAnimationFrame(updateScroll)
    }
  }, { passive: true })
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] })
  window.addEventListener('resize', () => {
    if (sidebarDrag) finishSidebarDrag(true)
    applySidebarWidth()
    positionContactPopover()
  })
  document.addEventListener('pointerdown', event => {
    const handle = event.target.closest('.sidebar-resize-handle')
    if (!handle || handle.getAttribute('aria-disabled') === 'true' || event.button !== 0 || !event.isPrimary) return
    event.preventDefault()
    sidebarDrag = {
      handle, pointerId: event.pointerId, startX: event.clientX,
      startWidth: handle.closest('#aside-content').getBoundingClientRect().width,
      previousWidth: sidebarWidth
    }
    handle.setPointerCapture(event.pointerId)
    handle.focus({ preventScroll: true })
    root.classList.add('is-resizing-sidebar')
  })
  document.addEventListener('pointermove', event => {
    if (!sidebarDrag || event.pointerId !== sidebarDrag.pointerId) return
    const { min, max } = sidebarLimits()
    // The layout stays centered, so the divider moves half the sidebar's growth.
    const width = Math.max(min, Math.min(max, sidebarDrag.startWidth + 2 * (event.clientX - sidebarDrag.startX)))
    sidebarWidth = defaultSidebarWidth + width - min
    applySidebarWidth()
    positionContactPopover()
  })
  document.addEventListener('pointerup', event => {
    if (event.pointerId === sidebarDrag?.pointerId) finishSidebarDrag()
  })
  document.addEventListener('pointercancel', event => {
    if (event.pointerId === sidebarDrag?.pointerId) finishSidebarDrag(true)
  })
  document.addEventListener('lostpointercapture', event => {
    if (event.pointerId === sidebarDrag?.pointerId) finishSidebarDrag()
  })
  document.addEventListener('dblclick', event => {
    if (!event.target.closest('.sidebar-resize-handle')) return
    sidebarWidth = defaultSidebarWidth
    applySidebarWidth()
    saveSidebarWidth()
    window.dispatchEvent(new Event('resize'))
  })
  window.addEventListener('blur', () => finishSidebarDrag(true))
  document.addEventListener('pjax:send', () => finishSidebarDrag(true))
  document.addEventListener('toggle', event => {
    if (event.target.matches('.profile-contact')) positionContactPopover()
  }, true)
  document.addEventListener('scroll', event => {
    if (event.target instanceof Element && event.target.matches('.profile-sidebar')) positionContactPopover()
  }, true)
  document.addEventListener('click', async event => {
    if (event.target.closest('#theme-toggle')) document.getElementById('darkmode')?.click()
    const copyButton = event.target.closest('[data-copy-email]')
    if (copyButton) {
      const status = copyButton.closest('.profile-contact').querySelector('.contact-status')
      try {
        const address = copyButton.dataset.copyEmail
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(address)
        else {
          const field = document.createElement('textarea')
          field.value = address
          field.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
          document.body.append(field)
          try {
            field.select()
            if (!document.execCommand('copy')) throw new Error('Copy unavailable')
          } finally {
            field.remove()
            copyButton.focus()
          }
        }
        status.textContent = '邮箱地址已复制'
      } catch {
        status.textContent = '请选中上方邮箱地址复制'
      }
    }
    document.querySelectorAll('.feed-filter[open], .profile-contact[open]').forEach(details => {
      if (!details.contains(event.target)) details.open = false
    })
  })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebarDrag) {
      event.preventDefault()
      finishSidebarDrag(true)
      return
    }
    if (event.target.matches('.sidebar-resize-handle') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const { min, max } = sidebarLimits()
      const current = min + Math.min(max - min, sidebarWidth - defaultSidebarWidth)
      const step = event.shiftKey ? 40 : 10
      const width = event.key === 'Home' ? min : event.key === 'End' ? max : Math.max(min, Math.min(max, current + (event.key === 'ArrowRight' ? step : -step)))
      sidebarWidth = defaultSidebarWidth + width - min
      applySidebarWidth()
      saveSidebarWidth()
      window.dispatchEvent(new Event('resize'))
      return
    }
    if (event.key === 'Escape') {
      document.querySelectorAll('.feed-filter[open], .profile-contact[open]').forEach(details => { details.open = false })
      if (document.getElementById('sidebar-menus')?.classList.contains('open')) document.getElementById('menu-mask')?.click()
    }
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return
    const search = document.querySelector('#search-button > .search')
    if (search) {
      event.preventDefault()
      search.click()
    }
  })
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true })
  else init()
  window.addEventListener('pjax:complete', init)
})()
