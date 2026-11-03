/* Metricool tracker — prerender-aware so hover-prerendered pages don't inflate visit stats */
(function () {
  function init() {
    function loadScript(a) {
      var b = document.getElementsByTagName("head")[0],
        c = document.createElement("script");
      c.type = "text/javascript";
      c.src = "https://tracker.metricool.com/resources/be.js";
      c.onreadystatechange = a;
      c.onload = a;
      b.appendChild(c);
    }
    loadScript(function () {
      beTracker.t({ hash: "3d56a61ca04317d5513c2b9ea70c6058" });
    });
  }
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', init, { once: true });
  } else {
    init();
  }
})();
