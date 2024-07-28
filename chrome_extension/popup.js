
document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const currentUrl = currentTab.url;
  
    const iframe = document.getElementById('iframe');

    if (!iframe) {
      console.error('Element with ID "iframe" is not found.');
      return;
    }

    if (!currentUrl.startsWith("http") && !currentUrl.startsWith("https")){
      iframe.src = "http://127.0.0.1:5000/error";
      console.log("URL is not fine")
    } else if (currentUrl.startsWith("chrome://") || currentUrl.startsWith("chrome")) {
      iframe.src = "http://127.0.0.1:5000/error";
      console.log("URL is not fine")
    } else if (currentUrl.startsWith("http://192.168") || currentUrl.startsWith("http://127.")) {
      iframe.src = "http://127.0.0.1:5000/error";
      console.log("URL is not fine")
    } else {
      iframe.src = "http://127.0.0.1:5000/check/result/chrome?url=" + encodeURIComponent(currentUrl);
      console.log("URL is fine")
    }
  });
});
