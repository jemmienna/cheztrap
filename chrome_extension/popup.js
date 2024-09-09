const hostname = "https://cheztrap.com/";

jQuery(document).ready(function () {
  function getPageDetails() {
    const title = document.title;
    const possibleSelectors = [
      ".email-body",
      ".ii.gt",
      ".a3s.aXjCH",
      "div[role='main']",
      "body", // Add body as a fallback for general websites
    ];

    let emailBodyElement = null;
    for (const selector of possibleSelectors) {
      emailBodyElement = document.querySelector(selector);
      if (emailBodyElement) {
        break;
      }
    }

    if (!emailBodyElement) {
      emailBodyElement = Array.from(
        document.querySelectorAll("div, span, p")
      ).find((el) => el.textContent.length > 100);
    }

    const bodyText = emailBodyElement
      ? emailBodyElement.innerText.trim()
      : "No body found";
    return { title, bodyText };
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const currentUrl = currentTab.url;

    const gmailSections = [
      "#inbox",
      "#starred",
      "#snoozed",
      "#sent",
      "#drafts",
      "#important",
      "#chats",
      "#spam",
      "#trash",
    ];

    let isGmailSection = gmailSections.some(
      (section) =>
        currentUrl.startsWith("https://mail.google.com") &&
        currentUrl.endsWith(section)
    );

    let isGmailDetailPage =
      currentUrl.startsWith("https://mail.google.com") && !isGmailSection;

    if (isGmailDetailPage) {
      console.log("This gmail detail page is valid");

      setTimeout(() => {
        chrome.scripting.executeScript(
          {
            target: { tabId: currentTab.id },
            func: getPageDetails,
          },
          (results) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Error executing script:",
                chrome.runtime.lastError
              );
              return;
            }

            if (results && results[0] && results[0].result) {
              const { title, bodyText } = results[0].result;

              console.log("Page Title:", title);
              console.log("Page Body:", bodyText);

              const mainElement = $("#main");

              $.post(
                hostname + "/api/check/result/gmail",
                { title: title, bodyText: bodyText },
                function (output) {
                  if (output.is_secure) {
                    mainElement.html("<div style='margin-top: -15px;'><p style='font-size: 20px'>This gmail is safe</p><img src='/static/images/happy_cat.gif' style='width: 200px'></div>");
                  } else {
                    mainElement.html("<div style='font-size: 17.5px;'>This gmail may not be safe. Be careful!</div>");
                  }
                }
              );

            }
          }
        );
      }, 3000);
    } else if (
      currentUrl.startsWith("http://") ||
      currentUrl.startsWith("https://") ||
      currentUrl.startsWith("chrome://") ||
      currentUrl.startsWith("http://192.168") ||
      currentUrl.startsWith("http://127.")
    ) {
      const mainElement = $("#main");

      $.post(
        hostname + "/api/check/website",
        { url: currentUrl },
        function (output) {
          if (output.is_secure) {
            mainElement.html("<div style='margin-top: -15px;'><p style='font-size: 20px'>This website is safe</p><img src='/static/images/happy_cat.gif' style='width: 200px'></div>");
          } else {
            mainElement.html("<div style='font-size: 17.5px;'>This website may not be safe. Be careful!</div>");
          }
        }
      );
    }
  });
});
