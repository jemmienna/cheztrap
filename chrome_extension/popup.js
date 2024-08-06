document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const currentUrl = currentTab.url;

    const iframe = document.getElementById('iframe');

    if (!iframe) {
      console.error('Element with ID "iframe" is not found.');
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      var currentUrl = tabs[0].url;
      if (currentUrl.startsWith("https://mail.google.com")) {
        iframe.src = "http://127.0.0.1:8000/gmail";
        document.getElementById('message').style.display = 'block';
      } else if (!currentUrl.startsWith("http") && !currentUrl.startsWith("https")) {
        iframe.src = "http://127.0.0.1:8000/error";
        console.log("URL is not fine");
      } else if (currentUrl.startsWith("chrome://") || currentUrl.startsWith("chrome")) {
        iframe.src = "http://127.0.0.1:8000/error";
        console.log("URL is not fine");
      } else if (currentUrl.startsWith("http://192.168") || currentUrl.startsWith("http://127.")) {
        iframe.src = "http://127.0.0.1:8000/error";
        console.log("URL is not fine");
      } else {
        iframe.src = "http://127.0.0.1:8000/check/result/chrome?url=" + encodeURIComponent(currentUrl);
        console.log("URL is fine");
      }
    })
  });
});
