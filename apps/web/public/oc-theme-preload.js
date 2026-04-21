;(function () {
  var themeId = localStorage.getItem("palimpsest-theme-id") || "oc-2"

  var scheme = "dark"
  var isDark = true
  var mode = "dark"

  document.documentElement.dataset.theme = themeId
  document.documentElement.dataset.colorScheme = mode

  if (themeId === "oc-2") return

  var css = localStorage.getItem("palimpsest-theme-css-" + mode)
  if (css) {
    var style = document.createElement("style")
    style.id = "palimpsest-theme-preload"
    style.textContent =
      ":root{color-scheme:" +
      mode +
      ";--text-mix-blend-mode:" +
      (isDark ? "plus-lighter" : "multiply") +
      ";" +
      css +
      "}"
    document.head.appendChild(style)
  }
})()
