/* Runs before styles and app modules. Appearance is browser-local, never planner data. */
;(function () {
  'use strict'
  var key = 'ajour:appearance:v1'
  var root = document.documentElement
  var listeners = []
  var media
  try { media = window.matchMedia('(prefers-color-scheme: dark)') } catch (_) { media = { matches: false } }
  function valid(value) { return value === 'light' || value === 'dark' || value === 'system' }
  function read() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(key))
      return saved && saved.version === 1 && valid(saved.theme) ? saved.theme : 'system'
    } catch (_) { return 'system' }
  }
  var preference = read()
  var theme
  function apply() {
    theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference
    var background = theme === 'dark' ? '#211d24' : '#fcfaf8'
    root.dataset.theme = theme
    root.style.colorScheme = theme
    // A delayed application module must still paint the correct page canvas.
    root.style.backgroundColor = background
    root.style.color = theme === 'dark' ? '#f3edf2' : '#342938'
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.content = background
    listeners.slice().forEach(function (listener) { listener({ preference: preference, theme: theme }) })
  }
  function setPreference(value) {
    if (!valid(value)) value = 'system'
    preference = value
    try { window.localStorage.setItem(key, JSON.stringify({ version: 1, theme: value })) } catch (_) { /* Keep the choice for this page. */ }
    apply()
  }
  window.ajourAppearance = {
    getState: function () { return { preference: preference, theme: theme } },
    setPreference: setPreference,
    toggle: function () { setPreference(theme === 'dark' ? 'light' : 'dark') },
    subscribe: function (listener) {
      listeners.push(listener)
      listener({ preference: preference, theme: theme })
      return function () { listeners = listeners.filter(function (item) { return item !== listener }) }
    },
  }
  if (media.addEventListener) media.addEventListener('change', function () { if (preference === 'system') apply() })
  else if (media.addListener) media.addListener(function () { if (preference === 'system') apply() })
  window.addEventListener('storage', function (event) {
    if (event.key === key || event.key === null) { preference = read(); apply() }
  })
  apply()
})()
