(()=>{
  "use strict";
  const cachedPage=document.body.hasAttribute("data-pwa-cached");
  let cachedData=false,notice;
  function refreshNotice(){
    const show=cachedPage||cachedData||!navigator.onLine;
    if(!show&&!notice)return;
    if(!notice){
      notice=document.createElement("p");
      notice.className="pwa-cache-notice";
      notice.setAttribute("role","status");
      const board=document.querySelector(".board-topbar");
      if(board)board.append(notice);
      else (document.querySelector("main")||document.body).prepend(notice);
    }
    notice.hidden=!show;
    const message=cachedPage||cachedData?"保存済みの情報を表示中。最新情報は通信復旧後に確認してください。":"オフライン：最新情報を確認できません。";
    if(notice.textContent!==(show?message:""))notice.textContent=show?message:"";
  }
  window.NitocPwa={setDataCached(value){cachedData=Boolean(value);refreshNotice();}};
  window.addEventListener("offline",refreshNotice);
  window.addEventListener("online",refreshNotice);
  refreshNotice();

  const button=document.getElementById("pwa-install");
  let prompt=null;
  if(button){
    window.addEventListener("beforeinstallprompt",event=>{
      event.preventDefault();
      prompt=event;
      button.hidden=false;
    });
    button.addEventListener("click",async()=>{
      if(!prompt)return;
      const event=prompt;
      prompt=null;
      button.hidden=true;
      try{await event.prompt();await event.userChoice;}catch(error){console.warn("Install prompt:",error);}
    });
    window.addEventListener("appinstalled",()=>{prompt=null;button.hidden=true;});
  }
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"})
      .catch(error=>console.warn("PWA registration:",error));
  }
})();
