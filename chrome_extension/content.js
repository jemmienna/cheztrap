// Scrape all <span> elements with the class "label"
const detections = document.querySelectorAll('span.label');

// Extract the text content of each detection
const scrapedData = Array.from(detections).map(detection => detection.innerText);

// Send the scraped data to the background script
chrome.runtime.sendMessage({ action: 'storeData', data: scrapedData });
