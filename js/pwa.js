(() => {
  "use strict";

  const status = document.getElementById("pwa-status");
  const installButton = document.getElementById("install-button");
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let installPrompt = null;

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function showInstallButton(label) {
    if (!installButton) return;
    installButton.textContent = label;
    installButton.classList.remove("hidden");
  }

  if (isStandalone) {
    setStatus("INSTALLED · READY OFFLINE");
  } else if (isIos) {
    setStatus("OFFLINE READY · ADD TO HOME SCREEN");
    showInstallButton("HOW TO INSTALL");
  } else if (!navigator.onLine) {
    setStatus("OFFLINE · SAVES ON THIS PHONE");
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    setStatus("OFFLINE READY · INSTALL ON THIS PHONE");
    showInstallButton("INSTALL APP");
  });

  installButton?.addEventListener("click", async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      installButton.classList.add("hidden");
      return;
    }
    if (isIos) {
      setStatus("ON IPHONE: SHARE → ADD TO HOME SCREEN");
    }
  });

  window.addEventListener("appinstalled", () => {
    setStatus("INSTALLED · READY OFFLINE");
    installButton?.classList.add("hidden");
  });

  window.addEventListener("offline", () => setStatus("OFFLINE · SAVES ON THIS PHONE"));
  window.addEventListener("online", () => {
    if (isStandalone) setStatus("INSTALLED · READY OFFLINE");
    else if (installPrompt) setStatus("OFFLINE READY · INSTALL ON THIS PHONE");
    else setStatus("PHONE EDITION · OFFLINE AFTER FIRST VISIT");
  });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        if (!isStandalone && !installPrompt && !isIos) {
          setStatus("OFFLINE READY · SAVES ON THIS PHONE");
        }
      })
      .catch(() => setStatus("ONLINE PLAY · OFFLINE SETUP NEEDS A RELOAD"));
  } else if (location.protocol === "file:") {
    setStatus("OPEN THROUGH HTTPS TO INSTALL OFFLINE");
  }
})();
