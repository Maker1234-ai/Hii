// Content script that runs on WP Job Manager pages

// This script can modify the page or interact with the WP Job Manager interface
console.log('WP Job Duplicator content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle any message from popup if needed
  return true;
});

// You could inject buttons or UI elements into the WP Job Manager interface here
// For example, adding a "Duplicate" button to each job listing

function addDuplicateButtons() {
  // Find job listing rows
  const jobRows = document.querySelectorAll('tr.type-job_listing');
  
  jobRows.forEach(row => {
    // Check if button already exists
    if (row.querySelector('.job-duplicator-btn')) {
      return;
    }
    
    // Get the job ID
    const jobId = row.id.replace('post-', '');
    
    // Find the actions column
    const actionsCell = row.querySelector('.column-job_actions, .column-actions');
    
    if (actionsCell) {
      // Create duplicate button
      const duplicateBtn = document.createElement('button');
      duplicateBtn.className = 'button job-duplicator-btn';
      duplicateBtn.textContent = 'Duplicate';
      duplicateBtn.style.marginLeft = '5px';
      
      // Add click handler
      duplicateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Open extension popup focused on this job
        chrome.runtime.sendMessage({
          type: 'openPopupForJob',
          jobId: jobId
        });
      });
      
      // Add to page
      actionsCell.appendChild(duplicateBtn);
    }
  });
}

// Run when page is fully loaded
window.addEventListener('load', () => {
  // Wait a bit for AJAX content to load if needed
  setTimeout(addDuplicateButtons, 1000);
  
  // Also run when page content might change
  const observer = new MutationObserver((mutations) => {
    addDuplicateButtons();
  });
  
  // Start observing changes to the job listings table
  const jobsTable = document.querySelector('.wp-list-table');
  if (jobsTable) {
    observer.observe(jobsTable, { childList: true, subtree: true });
  }
});
