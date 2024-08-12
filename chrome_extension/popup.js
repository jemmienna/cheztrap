const hostname = "https://www.cheztrap.com";

// Function to get the page title and email body
function getPageDetails() {
  const title = document.title;
  // Attempt to capture the email body using various common containers
  const possibleSelectors = [
    ".email-body",
    ".ii.gt",
    ".a3s.aXjCH",
    "div[role='main']"
  ];
  let emailBodyElement = null;
  for (const selector of possibleSelectors) {
    emailBodyElement = document.querySelector(selector);
    if (emailBodyElement) {
      break;
    }
  }
   // If no specific selector is found, fallback to common tags
  if (!emailBodyElement) {
    emailBodyElement = Array.from(document.querySelectorAll("div, span, p")).find(el => {
      return el.textContent.length > 100;
    });
  }
  const bodyText = emailBodyElement ? emailBodyElement.innerText.trim() : "No body found";
  return { title, bodyText };
 }
 
 
 document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const currentUrl = currentTab.url;
    const iframe = document.getElementById('iframe');
  
    if (!iframe) {
      console.error('Element with ID "iframe" is not found.');
      return;
    }
  
    const gmailSections = [
      "#inbox",
      "#starred",
      "#snoozed",
      "#sent",
      "#drafts",
      "#important",
      "#chats",
      "#spam",
      "#trash"
    ];
  
    // Check if a section page
    let isGmailSection = gmailSections.some(section => currentUrl.startsWith("https://mail.google.com") && currentUrl.endsWith(section));
  
    // Check if a detail page
    let isDetailPage = currentUrl.startsWith("https://mail.google.com") && !isGmailSection;
    // console.log(typeof(isGmailSection))
  
    if (isDetailPage) {
      console.log("This is the detail page for Gmail");
      document.getElementById('message').style.display = 'block';
      setTimeout(() => {
        console.log("test")
        chrome.scripting.executeScript(
          {
            target: { tabId: currentTab.id },
            func: getPageDetails
          },
          (results) => {
            console.log("test2  ")
            if (chrome.runtime.lastError) {
              console.error("Error executing script:", chrome.runtime.lastError);
              return;
            }
            if (results && results[0] && results[0].result) {
              const { title, bodyText } = results[0].result;
              console.log("Page Title:", title);
              console.log("Email Body:", bodyText);
              iframe.src = hostname+"/check/result/gmail?title="+title+"&bodyText="+bodyText+"";
            }
          }
        );
      }, 3000)
    } else {
      // Handle other cases
      if (!currentUrl.startsWith("http://") &&
          !currentUrl.startsWith("https://") &&
          !currentUrl.startsWith("chrome://") &&
          !currentUrl.startsWith("http://192.168") &&
          !currentUrl.startsWith("http://127.")
      ) {
        iframe.src = hostname+"/error";
        console.log("URL is not fine");
      } else {
        iframe.src = hostname+"/check/result/chrome?url=" + encodeURIComponent(currentUrl);
        console.log("URL is fine");
      }
    }
  });
 });
