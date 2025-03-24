document.addEventListener('DOMContentLoaded', function() {
  const jobSelect = document.getElementById('job-select');
  const companySelect = document.getElementById('company-select');
  const locationsTextarea = document.getElementById('locations');
  const duplicateBtn = document.getElementById('duplicate-btn');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const statusDiv = document.getElementById('status');
  const locationCountDisplay = document.querySelector('.location-count');
  
  // Load jobs and companies when popup opens
  loadJobs();
  loadCompanies();
  
  // Update location count when text changes
  locationsTextarea.addEventListener('input', updateLocationCount);
  
  // Handle the duplicate button click
  duplicateBtn.addEventListener('click', startDuplication);
  
  function updateLocationCount() {
    const locations = parseLocations(locationsTextarea.value);
    locationCountDisplay.textContent = `${locations.length} locations`;
    
    // Warn if more than 500 locations
    if (locations.length > 500) {
      locationCountDisplay.style.color = 'red';
      locationCountDisplay.textContent += ' (maximum 500 recommended)';
    } else {
      locationCountDisplay.style.color = '#666';
    }
  }
  
  function parseLocations(text) {
    return text.split(',')
      .map(location => location.trim())
      .filter(location => location.length > 0);
  }
  
  function loadJobs() {
    // Get active tab to check if on WP Admin
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTab = tabs[0];
      
      // Check if we're on a WordPress admin page
      if (currentTab.url.includes('/wp-admin/')) {
        chrome.scripting.executeScript({
          target: {tabId: currentTab.id},
          function: getAvailableJobs
        }, (results) => {
          if (results && results[0].result) {
            const jobs = results[0].result;
            jobSelect.innerHTML = '';
            
            if (jobs.length === 0) {
              jobSelect.innerHTML = '<option value="">No jobs found</option>';
            } else {
              jobs.forEach(job => {
                const option = document.createElement('option');
                option.value = job.id;
                option.textContent = job.title;
                jobSelect.appendChild(option);
              });
            }
          } else {
            jobSelect.innerHTML = '<option value="">Error loading jobs</option>';
          }
        });
      } else {
        jobSelect.innerHTML = '<option value="">Please navigate to WP Job Manager</option>';
        duplicateBtn.disabled = true;
      }
    });
  }
  
  function loadCompanies() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTab = tabs[0];
      
      if (currentTab.url.includes('/wp-admin/')) {
        chrome.scripting.executeScript({
          target: {tabId: currentTab.id},
          function: getAvailableCompanies
        }, (results) => {
          if (results && results[0].result) {
            const companies = results[0].result;
            
            // Add companies to dropdown
            if (companies.length > 0) {
              companies.forEach(company => {
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.name;
                companySelect.appendChild(option);
              });
            }
          }
        });
      }
    });
  }
  
  function startDuplication() {
    const jobId = jobSelect.value;
    const companyId = companySelect.value;
    const locations = parseLocations(locationsTextarea.value);
    
    if (!jobId) {
      showStatus('Please select a job to duplicate', 'error');
      return;
    }
    
    if (locations.length === 0) {
      showStatus('Please enter at least one location', 'error');
      return;
    }
    
    if (locations.length > 500) {
      if (!confirm(`You've entered ${locations.length} locations, which exceeds the recommended limit of 500. This may cause performance issues. Do you want to continue?`)) {
        return;
      }
    }
    
    // Update UI to show duplication in progress
    duplicateBtn.disabled = true;
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = `Processing: 0 / ${locations.length}`;
    
    // Start the duplication process
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: duplicateJobs,
        args: [jobId, companyId, locations]
      }, (results) => {
        if (results && results[0].result) {
          const result = results[0].result;
          showStatus(`Successfully duplicated job for ${result.successCount} locations. ${result.errorCount} failed.`, result.errorCount > 0 ? 'error' : 'success');
        } else {
          showStatus('An error occurred during the duplication process', 'error');
        }
        duplicateBtn.disabled = false;
      });
      
      // Set up listener for progress updates
      chrome.runtime.onMessage.addListener(function progressListener(message) {
        if (message.type === 'duplicationProgress') {
          progressBar.style.width = `${(message.processed / locations.length) * 100}%`;
          progressText.textContent = `Processing: ${message.processed} / ${locations.length}`;
          
          if (message.processed >= locations.length) {
            chrome.runtime.onMessage.removeListener(progressListener);
          }
        }
      });
    });
  }
  
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
  }
});

// These functions will be executed in the context of the web page
function getAvailableJobs() {
  // This would need to be adapted based on how jobs are stored in WP Job Manager
  const jobs = [];
  
  // Example selector for job listings in WP admin
  const jobRows = document.querySelectorAll('tr.type-job_listing');
  
  jobRows.forEach(row => {
    const titleElem = row.querySelector('.column-title a');
    if (titleElem) {
      const id = row.id.replace('post-', '');
      jobs.push({
        id: id,
        title: titleElem.textContent.trim()
      });
    }
  });
  
  return jobs;
}

function getAvailableCompanies() {
  // This would need to be adapted based on how companies are stored
  const companies = [];
  
  // Try to find company taxonomy terms if available
  try {
    const companyTerms = document.querySelectorAll('.wp-list-table .column-company a');
    
    if (companyTerms.length > 0) {
      companyTerms.forEach(term => {
        const href = term.getAttribute('href');
        let id = '';
        
        if (href) {
          const match = href.match(/tag_ID=(\d+)/);
          if (match && match[1]) {
            id = match[1];
          }
        }
        
        companies.push({
          id: id,
          name: term.textContent.trim()
        });
      });
    }
  } catch (e) {
    console.error('Error fetching companies:', e);
  }
  
  return companies;
}

function duplicateJobs(jobId, companyId, locations) {
  // We'll keep track of progress and results
  let processed = 0;
  let successCount = 0;
  let errorCount = 0;
  const totalLocations = locations.length;
  
  // Function to send progress updates
  function updateProgress() {
    chrome.runtime.sendMessage({
      type: 'duplicationProgress',
      processed: processed,
      total: totalLocations
    });
  }
  
  // Function to duplicate a single job
  async function duplicateJob(location) {
    try {
      // Get CSRF token for WP
      const wpnonce = document.querySelector('#_wpnonce') ? 
                      document.querySelector('#_wpnonce').value : '';
      
      // Get job details first
      const response = await fetch(`/wp-admin/post.php?post=${jobId}&action=edit`);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Extract all form fields
      const formData = new FormData();
      
      // Add basic fields
      formData.append('post_ID', '');  // Empty for new post
      formData.append('post_type', 'job_listing');
      formData.append('original_post_status', 'publish');
      formData.append('post_status', 'publish');
      formData.append('_wpnonce', wpnonce);
      
      // Get original title and create new one with location
      const originalTitle = doc.querySelector('#title').value;
      const baseTitle = originalTitle.split(' in ')[0]; // Remove location if present
      const newTitle = `${baseTitle} in ${location}`;
      formData.append('post_title', newTitle);
      
      // Get content
      const content = doc.querySelector('#content') ? 
                     doc.querySelector('#content').value : '';
      formData.append('content', content);
      
      // Company field
      if (companyId) {
        formData.append('_company_id', companyId);
      } else {
        const originalCompany = doc.querySelector('[name="_company_id"]') ?
                               doc.querySelector('[name="_company_id"]').value : '';
        formData.append('_company_id', originalCompany);
      }
      
      // Location
      formData.append('_job_location', location);
      
      // Get all custom fields (meta boxes)
      doc.querySelectorAll('[name^="_"]').forEach(field => {
        if (field.name !== '_job_location' && field.name !== '_company_id') {
          formData.append(field.name, field.value);
        }
      });
      
      // Get categories and tags
      doc.querySelectorAll('[name="tax_input[job_listing_category][]"]:checked').forEach(cat => {
        formData.append('tax_input[job_listing_category][]', cat.value);
      });
      
      doc.querySelectorAll('[name="tax_input[job_listing_tag][]"]:checked').forEach(tag => {
        formData.append('tax_input[job_listing_tag][]', tag.value);
      });
      
      // Submit the form to create new job
      const submitResponse = await fetch('/wp-admin/post.php', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });
      
      if (submitResponse.ok) {
        successCount++;
      } else {
        errorCount++;
      }
      
    } catch (error) {
      console.error(`Error duplicating job for location ${location}:`, error);
      errorCount++;
    } finally {
      processed++;
      updateProgress();
    }
  }
  
  // Process locations in batches to avoid overwhelming the browser
  async function processBatch(locationBatch) {
    const batchPromises = locationBatch.map(location => duplicateJob(location));
    await Promise.all(batchPromises);
  }
  
  // Start duplication process
  async function startProcess() {
    const BATCH_SIZE = 10; // Process 10 at a time for better performance
    
    for (let i = 0; i < locations.length; i += BATCH_SIZE) {
      const batch = locations.slice(i, i + BATCH_SIZE);
      await processBatch(batch);
    }
    
    return {
      successCount,
      errorCount
    };
  }
  
  // Return a promise that resolves when all duplications are complete
  return startProcess();
}
