const hostname = "https://cheztrap.com/";
// const hostname = "http://127.0.0.1:8000/";

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
    const urlElement = document.createElement("a");
    urlElement.href = currentUrl;
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

    const websiteNameDisplay = $("#website_name");
    const isSafeDisplay = $("#is_safe");

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
                    websiteNameDisplay.html(
                      "<div style='margin-top: -15px;'><p style='font-size: 20px'>This gmail is safe</p></div>"
                    );
                    isSafeDisplay.html(
                      "<img src='https://cdn2.iconfinder.com/data/icons/greenline/512/check-128.png' style='width: 35px'><div style='margin-top: -15px;'><img src='/static/images/happy_cat.gif' style='width: 200px'></div><div style='font-size: 17.5px;'>" +
                        output.reason +
                        "</div>"
                    );
                  } else {
                    websiteNameDisplay.html(
                      "<div style='font-size: 17.5px; margin-bottom: 10px;'>This gmail may not be safe. Be careful!</div>"
                    );
                    isSafeDisplay.html(
                      "<img src='/static/images/bad.png' style='width: 35px;'><div style='font-size: 17.5px; margin-top: 10px;'>" +
                        output.reason +
                        "</div>"
                    );
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
      $.post(
        hostname + "/api/check/website",
        { url: currentUrl },
        function (output) {
          console.log("output", output);

          console.log(urlElement);
          if (output.is_secure) {
            websiteNameDisplay.html(
              "<div style='margin-bottom: 10px; font-size: 20px;'>" +
                urlElement.hostname +
                "<br> is a safe website</div>"
            );
            console.log("thisl oaded but is still ading scren");
            isSafeDisplay.html(
              "<img src='https://cdn2.iconfinder.com/data/icons/greenline/512/check-128.png' style='width: 35px'><div style='margin-top: -15px;'><img src='/static/images/happy_cat.gif' style='width: 200px'></div><div style='font-size: 17.5px;'>" +
                output.reason +
                "</div>"
            );
          } else {
            websiteNameDisplay.html(
              "<div style='margin-bottom: 10px; font-size: 20px;'>" +
                urlElement.hostname
            );
            isSafeDisplay.html(
              "<div><img src='/static/images/bad.png' style='width: 35px'></div><div style='font-size: 17.5px;'>This website may not be safe. Be careful!</div>" +
                "<div style='font-size: 17.5px;margin-top: 10px;'>" +
                output.reason +
                "</div>"
            );
          }
        }
      );
    }
  });
});
