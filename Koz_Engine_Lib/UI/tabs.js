(function initTabsLib(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTabsApi(root) {
  function toDatasetKey(dataAttr) {
    return String(dataAttr || "")
      .replace(/^data-/, "")
      .replace(/-([a-z])/g, function (_match, chr) { return chr.toUpperCase(); });
  }

  function readButtonTabValue(btn, dataAttr) {
    if (!btn) return null;
    if (typeof btn.getAttribute === "function") {
      return btn.getAttribute(dataAttr);
    }
    const datasetKey = toDatasetKey(dataAttr);
    return btn.dataset && btn.dataset[datasetKey] != null ? btn.dataset[datasetKey] : null;
  }

  function setButtonActive(btn, activeClass, isActive) {
    if (!btn || !activeClass) return;
    if (btn.classList && typeof btn.classList.add === "function" && typeof btn.classList.remove === "function") {
      if (isActive) btn.classList.add(activeClass);
      else btn.classList.remove(activeClass);
      return;
    }

    const className = String(btn.className || "").split(/\s+/).filter(Boolean);
    const next = className.filter(function (name) { return name !== activeClass; });
    if (isActive) next.push(activeClass);
    btn.className = next.join(" ");
  }

  function resolveButtons(options, doc) {
    if (Array.isArray(options.buttons)) return options.buttons.filter(Boolean);
    if (!doc || !options.btnSelector) return [];
    const scope = options.root && typeof options.root.querySelectorAll === "function"
      ? options.root
      : doc;
    if (!scope || typeof scope.querySelectorAll !== "function") return [];
    return Array.from(scope.querySelectorAll(options.btnSelector));
  }

  function resolveTabKeys(defs, buttons, dataAttr) {
    const explicitKeys = Array.isArray(defs)
      ? defs
          .map(function (def) {
            return typeof def === "string" ? def : def && def.key;
          })
          .filter(Boolean)
      : [];
    if (explicitKeys.length) return Array.from(new Set(explicitKeys));

    return Array.from(new Set(
      (Array.isArray(buttons) ? buttons : [])
        .map(function (btn) { return readButtonTabValue(btn, dataAttr); })
        .filter(Boolean)
    ));
  }

  function applyTabState(options) {
    const opts = options || {};
    const tab = opts.tab;
    const hasTab = tab != null && tab !== "";
    const doc = opts.document || (root && root.document) || null;
    const activeClass = opts.activeClass || "tab-active";
    const dataAttr = opts.dataAttr || "data-tab";
    const showDisplay = opts.showDisplay || "block";
    const hideDisplay = opts.hideDisplay || "none";
    const buttons = resolveButtons(opts, doc);
    const tabKeys = resolveTabKeys(opts.defs, buttons, dataAttr);

    if (hasTab) {
      buttons.forEach(function (btn) {
        setButtonActive(btn, activeClass, readButtonTabValue(btn, dataAttr) === tab);
      });
    }

    if (hasTab && opts.panelPrefix && doc && typeof doc.getElementById === "function") {
      tabKeys.forEach(function (key) {
        const panel = doc.getElementById(`${opts.panelPrefix}${key}`);
        if (panel && panel.style) {
          panel.style.display = key === tab ? showDisplay : hideDisplay;
        }
      });
    }

    return {
      tab,
      buttons,
      tabKeys,
    };
  }

  return {
    applyTabState,
  };
});
