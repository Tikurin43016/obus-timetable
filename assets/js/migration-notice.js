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
  title.textContent = "サイト移転のお知らせ";

  const explanation = document.createElement("p");
  explanation.id = "migration-notice-description";
  explanation.textContent = "「おーバス 高専時刻表」は「NITOCバスナビ」に名称を変更し、URLも移転しました。";

  const apology = document.createElement("p");
  apology.textContent = "突然の変更となってしまい、ご利用いただいていた皆さまには、ご不便をおかけして大変申し訳ありません。";

  const usage = document.createElement("p");
  usage.textContent = "ブックマークなどを登録してくださっていた方には、重ねてお手数をおかけしますが、新しいURLへの変更をお願いいたします。時刻表はこれまでどおりご利用いただけます。";

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

  dialog.append(title, explanation, apology, usage, address, close);
  document.body.append(dialog);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
})();
