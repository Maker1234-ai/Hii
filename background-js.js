// Background script for handling messages and background tasks

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'duplicationProgress') {
    // Forward progress updates to the popup
    chrome.runtime.sendMessage(message);
  }
  
  return true;
});

// Install event listener
chrome.runtime.onInstalled.addListener(() => {
  console.log('WP Job Duplicator extension installed');
});
