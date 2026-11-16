/* Shared interactions; delegation survives Butterfly's PJAX navigation. */
(() => {
  if (window.yunfeiUI) return
  window.yunfeiUI = true
  const root = document.documentElement
  let scrollPending = false

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
  window.addEventListener('resize', positionContactPopover)
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
