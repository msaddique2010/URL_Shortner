document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('shortener-form');
  const longUrlInput = document.getElementById('long-url');
  const submitBtn = document.getElementById('submit-btn');
  const btnSpinner = document.getElementById('btn-spinner');
  const errorMessage = document.getElementById('error-message');
  const resultContainer = document.getElementById('result-container');
  const shortenedUrl = document.getElementById('shortened-url');
  const copyBtn = document.getElementById('copy-btn');
  const copyText = document.getElementById('copy-text');
  
  const linksTbody = document.getElementById('links-tbody');
  const emptyState = document.getElementById('empty-state');
  const linksTable = document.getElementById('links-table');

  // Load recent links on page load
  loadRecentLinks();

  // Handle Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const longUrl = longUrlInput.value.trim();
    if (!longUrl) return;

    // Reset UI state
    errorMessage.textContent = '';
    resultContainer.style.display = 'none';
    setLoadingState(true);

    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ longUrl })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      // Display short URL
      const fullShortUrl = `${window.location.origin}/${data.shortCode}`;
      shortenedUrl.href = fullShortUrl;
      shortenedUrl.textContent = fullShortUrl;
      resultContainer.style.display = 'block';

      // Reload the table
      loadRecentLinks();
      
      // Clear input
      longUrlInput.value = '';
    } catch (err) {
      errorMessage.textContent = err.message;
    } finally {
      setLoadingState(false);
    }
  });

  // Handle Copy Button
  copyBtn.addEventListener('click', async () => {
    const textToCopy = shortenedUrl.textContent;
    try {
      await navigator.clipboard.writeText(textToCopy);
      
      // Update Copy feedback
      copyBtn.classList.add('copied');
      copyText.textContent = 'Copied!';
      
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyText.textContent = 'Copy';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  });

  // Load Recent Links
  async function loadRecentLinks() {
    try {
      const response = await fetch('/api/urls');
      if (!response.ok) return;

      const urls = await response.json();
      
      if (urls.length === 0) {
        linksTable.style.display = 'none';
        emptyState.style.display = 'block';
        return;
      }

      linksTable.style.display = 'table';
      emptyState.style.display = 'none';

      linksTbody.innerHTML = '';
      urls.forEach(url => {
        const tr = document.createElement('tr');
        
        const fullShortUrl = `${window.location.origin}/${url.short_code}`;
        
        tr.innerHTML = `
          <td>
            <a href="${url.long_url}" target="_blank" class="original-link" title="${url.long_url}">
              ${url.long_url}
            </a>
          </td>
          <td>
            <a href="${fullShortUrl}" target="_blank" class="table-short-link">
              /${url.short_code}
            </a>
          </td>
          <td>${url.clicks}</td>
        `;
        linksTbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Failed to fetch recent links:', err);
    }
  }

  // Set Button Loading State
  function setLoadingState(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true;
      btnSpinner.style.display = 'inline-block';
      submitBtn.querySelector('span').style.display = 'none';
    } else {
      submitBtn.disabled = false;
      btnSpinner.style.display = 'none';
      submitBtn.querySelector('span').style.display = 'inline';
    }
  }
});
