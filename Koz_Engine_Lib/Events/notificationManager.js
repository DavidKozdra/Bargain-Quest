let NotificationCenterCtor = null;
let getNotificationColorFn = null;
if (typeof require === "function") {
  try {
    ({
      NotificationCenter: NotificationCenterCtor,
      getNotificationColor: getNotificationColorFn,
    } = require("./notificationCenter"));
  } catch (_err) {}
}

/**
 * Notification manager that handles displaying game notifications to the player.
 * Wraps NotificationCenter with UI rendering capabilities.
 */
class NotificationManager {
  constructor(options = {}) {
    /**
     * Creates a new NotificationManager.
     * @param {Object} [options] - Configuration options
     * @param {Function} [options.NotificationCenter] - NotificationCenter constructor
     */
    const opts = options || {};
    this.maxNotifications = 5;
    this.historyLimit = Math.max(20, Number(opts.historyLimit) || 80);
    this.history = [];
    this._historyPanel = null;
    this._historyList = null;
    this._historyEmpty = null;
    const Center = opts.NotificationCenter || opts.notificationCenterClass || NotificationCenterCtor;
    if (typeof Center === "function") {
      this._center = opts.center || new Center({ maxNotifications: this.maxNotifications });
      this.notifications = this._center.list().map((entry) => entry.id);
    } else {
      this._center = null;
      this.notifications = [];
    }

    // Remove any old panel from a previous game session to prevent DOM leaks
    const oldPanel = select("#notificationPanel");
    if (oldPanel) oldPanel.remove();
    const oldHistoryPanel = document.getElementById("notificationHistoryPanel");
    if (oldHistoryPanel) oldHistoryPanel.remove();

    this.uiContainer = createDiv().id("notificationPanel").style("position", "absolute")
      .style("top", "20px")
      .style("left", "50%")
      .style("transform", "translateX(-50%)")
      .style("z-index", "1000")
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("align-items", "center")
      .style("pointer-events", "none");

    this._ensureHistoryPanel();
  }

  _getPreferredDuration() {
    try {
      const raw = localStorage.getItem("pref_notification_duration_ms");
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return Math.max(3000, Math.min(12000, Math.round(parsed)));
      }
    } catch (_err) {}
    return 5000;
  }

  _resolveDuration(duration) {
    if (duration !== undefined && duration !== null) {
      const parsed = Number(duration);
      if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
    }
    return this._getPreferredDuration();
  }

  _formatHistoryTime(timestamp) {
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (_err) {
      return "";
    }
  }

  _remember(entry) {
    this.history.push(entry);
    if (this.history.length > this.historyLimit) {
      this.history.splice(0, this.history.length - this.historyLimit);
    }
    this._renderHistory();
  }

  _ensureHistoryPanel() {
    if (this._historyPanel || typeof document === "undefined" || !document.body) return;

    const panel = document.createElement("div");
    panel.id = "notificationHistoryPanel";
    panel.className = "notification-history-panel";
    panel.style.display = "none";
    panel.addEventListener("click", (event) => {
      if (event.target === panel) this.closeHistory();
    });

    const card = document.createElement("div");
    card.className = "notification-history-card";
    panel.appendChild(card);

    const header = document.createElement("div");
    header.className = "notification-history-header";
    card.appendChild(header);

    const titleWrap = document.createElement("div");
    titleWrap.className = "notification-history-title-wrap";
    header.appendChild(titleWrap);

    const title = document.createElement("h3");
    title.className = "notification-history-title";
    title.textContent = "Notification History";
    titleWrap.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "notification-history-subtitle";
    subtitle.textContent = "Recent alerts stay here until you clear them.";
    titleWrap.appendChild(subtitle);

    const controls = document.createElement("div");
    controls.className = "notification-history-controls";
    header.appendChild(controls);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "notification-history-btn";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", () => this.clearHistory());
    controls.appendChild(clearBtn);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "notification-history-btn notification-history-btn-close";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => this.closeHistory());
    controls.appendChild(closeBtn);

    const list = document.createElement("div");
    list.className = "notification-history-list";
    card.appendChild(list);

    const empty = document.createElement("div");
    empty.className = "notification-history-empty";
    empty.textContent = "No notifications yet.";
    card.appendChild(empty);

    document.body.appendChild(panel);
    this._historyPanel = panel;
    this._historyList = list;
    this._historyEmpty = empty;
    this._renderHistory();
  }

  _renderHistory() {
    if (!this._historyList || !this._historyEmpty) return;
    this._historyList.replaceChildren();

    if (this.history.length === 0) {
      this._historyEmpty.style.display = "block";
      return;
    }

    this._historyEmpty.style.display = "none";
    const entries = this.history.slice().reverse();
    entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = `notification-history-entry notification-type-${entry.type || "info"}`;
      row.style.borderLeftColor = this.getBgColor(entry.type);

      const meta = document.createElement("div");
      meta.className = "notification-history-meta";
      row.appendChild(meta);

      const typeEl = document.createElement("span");
      typeEl.className = "notification-history-type";
      typeEl.textContent = String(entry.type || "info").toUpperCase();
      meta.appendChild(typeEl);

      const timeEl = document.createElement("span");
      timeEl.className = "notification-history-time";
      timeEl.textContent = this._formatHistoryTime(entry.createdAt);
      meta.appendChild(timeEl);

      const messageEl = document.createElement("div");
      messageEl.className = "notification-history-message";
      messageEl.textContent = entry.message;
      row.appendChild(messageEl);

      this._historyList.appendChild(row);
    });
  }

  getHistory() {
    return this.history.slice();
  }

  clearHistory() {
    this.history = [];
    this._renderHistory();
  }

  openHistory() {
    this._ensureHistoryPanel();
    this._renderHistory();
    if (this._historyPanel) this._historyPanel.style.display = "flex";
  }

  closeHistory() {
    if (this._historyPanel) this._historyPanel.style.display = "none";
  }

  toggleHistory() {
    if (!this._historyPanel || this._historyPanel.style.display === "none") {
      this.openHistory();
      return;
    }
    this.closeHistory();
  }

  log(message, type = "info", duration, action = null) {
    /**
     * Logs a notification to be displayed.
     * @param {string} message - Notification text
     * @param {string} [type='info'] - Notification type (error, success, warning, info)
      * @param {number} [duration=5000] - Display duration in milliseconds
      * @param {Function} [action] - Optional click action
      * @returns {string} Notification ID
     */
    const safeMessage = String(message || "");
    const safeType = String(type || "info");
    const effectiveDuration = this._resolveDuration(duration);
    const record = {
      id: null,
      message: safeMessage,
      type: safeType,
      duration: effectiveDuration,
      createdAt: Date.now(),
    };

    const id = this._center ? this._center.enqueue({ message: safeMessage, type: safeType, duration: effectiveDuration, action }, (entry) => {
      select(`#${entry.id}`)?.remove();
      this.notifications = this._center.list().map((e) => e.id);
    }).entry.id : `note-${Date.now()}`;
    record.id = id;
    this._remember(record);

    const notification = createDiv(safeMessage)
      .id(id)
      .class("notification")
      .parent(this.uiContainer)
      .style("background", this.getBgColor(safeType))
      .style("color", "#fff")
      .style("padding", "calc(10px * var(--ui-scale)) calc(20px * var(--ui-scale))")
      .style("margin", "6px 0")
      .style("border-radius", "8px")
      .style("box-shadow", "0 0 12px rgba(0,0,0,0.3)")
      .style("font-size", "calc(16px * var(--ui-scale))")
      .style("min-width", "200px")
      .style("text-align", "center")
      .style("pointer-events", action ? "auto" : "none")
      .style("opacity", "0")
      .style("transition", "opacity 0.3s ease");

    if (action && typeof action.onClick === 'function') {
      const btn = createButton(action.label || "Action")
        .parent(notification)
        .style("margin-left", "10px")
        .style("padding", "calc(4px * var(--ui-scale)) calc(10px * var(--ui-scale))")
        .style("border", "none")
        .style("border-radius", "6px")
        .style("background", "#e7c66a")
        .style("color", "#1a1a1a")
        .style("font-size", "calc(13px * var(--ui-scale))")
        .style("font-weight", "bold")
        .style("cursor", "pointer")
        .style("pointer-events", "auto");
      btn.mousePressed(() => {
        try { action.onClick(); } catch (e) { console.warn('Notification action failed:', e); }
        select(`#${id}`)?.remove();
        if (this._center) {
          this._center.dismiss(id);
          this.notifications = this._center.list().map((entry) => entry.id);
        } else {
          this.notifications = this.notifications.filter(n => n !== id);
        }
      });
    }

    setTimeout(() => notification.style("opacity", "1"), 50);

    if (this._center) {
      this.notifications = this._center.list().map((entry) => entry.id);
      const liveIds = new Set(this.notifications);
      this.uiContainer.elt.querySelectorAll(".notification").forEach((node) => {
        if (!liveIds.has(node.id)) node.remove();
      });
    } else {
      this.notifications.push(id);
      if (this.notifications.length > this.maxNotifications) {
        const oldest = this.notifications.shift();
        select(`#${oldest}`)?.remove();
      }
      setTimeout(() => {
        select(`#${id}`)?.remove();
        this.notifications = this.notifications.filter(n => n !== id);
      }, effectiveDuration);
    }
  }

  getBgColor(type) {
    const resolveColor = typeof getNotificationColorFn === "function"
      ? getNotificationColorFn
      : null;
    if (resolveColor) {
      return resolveColor(type);
    }
    switch (type) {
      case "error": return "#b71c1c";
      case "success": return "#388e3c";
      case "warning": return "#f57c00";
      case "holiday": return "#caa350";
      case "info":
      default: return "#333";
    }
  }
}

(function exportNotificationManager(root) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { NotificationManager };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
