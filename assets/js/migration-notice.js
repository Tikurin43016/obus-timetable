"use strict";

(() => {
  const marker = new URL(window.location.href);
  if (marker.searchParams.get("moved") !== "obuskosen") return;

  marker.searchParams.delete("moved");
  try {
    window.history.replaceState(window.history.state, "", marker.pathname + marker.search + marker.hash);
  } catch {
    // The notice can still be shown when history replacement is unavailable.
  }

  const seenKey = "nitocbus-migration-notice-seen";
  try {
    if (window.sessionStorage.getItem(seenKey) === "1") return;
  } catch {
    // Session storage may be disabled by the browser.
  }

  const dialog = document.createElement("dialog");
  dialog.className = "migration-dialog";
  dialog.setAttribute("aria-labelledby", "migration-notice-title");
  dialog.setAttribute("aria-describedby", "migration-notice-description");

  const title = document.createElement("h2");
  title.id = "migration-notice-title";
  title.textContent = "ごめんなさい。";

  const explanation = document.createElement("p");
  explanation.id = "migration-notice-description";
  explanation.textContent = "諸般の事情により、「おーバス 高専時刻表」は「NITOCバスナビ」に名称・URLを変更することになりました。";

  const apology = document.createElement("p");
  apology.textContent = "突然のご案内となり、申し訳ありません。旧URLは当面の間維持し、新しいサイトへ自動転送しますので、これまでのリンクやブックマークも引き続き使えます。もしよろしければ、ブックマークを新しいURLに変更していただけますと幸いです。";


  const address = document.createElement("p");
  address.className = "migration-dialog__address";
  address.textContent = "新URL：nitocbus.pages.dev";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "migration-dialog__close";
  close.textContent = "閉じる";

  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    try {
      window.sessionStorage.setItem(seenKey, "1");
    } catch {
      // Dismissal should work even without storage access.
    }
    dialog.remove();
  });

  dialog.append(title, explanation, apology, address, close);
  document.body.append(dialog);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
})();
