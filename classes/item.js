(function bridgeItemCatalog(root) {
  const api = root.BQLib?.items?.catalog;
  if (!api) return;
  if (typeof root.Item === "undefined") root.Item = api.Item;
  if (typeof root.ItemLibrary === "undefined") root.ItemLibrary = api.ItemLibrary;
  if (typeof root.BAGS === "undefined") root.BAGS = api.BAGS;
  if (typeof root.ITEM_ICONS === "undefined") root.ITEM_ICONS = api.ITEM_ICONS;
  if (typeof root.createItemIconEl !== "function") root.createItemIconEl = api.createItemIconEl;
})(typeof globalThis !== "undefined" ? globalThis : this);
