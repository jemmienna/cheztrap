document.addEventListener('DOMContentLoaded', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      const currentUrl = currentTab.url;
  
      const iframe = document.getElementById('iframe');
      if (iframe) {
        iframe.src = "http://127.0.0.1:5000/check/result/chrome?url="+currentUrl;
      } else {
        console.error('Element with ID "url" is not an iframe.');
      }
    });
  });