/**
 * SimpleNav - Content Script v1.6.0
 * * Responsibilities:
 * 1. Match current URL against stored rules (strict match & subdomain support).
 * 2. Execute DOM manipulations: Remove elements, Add/Remove Classes, Set/Remove Styles.
 * 3. Observe DOM mutations to handle dynamic content (SPAs, lazy loading).
 */

chrome.storage.sync.get({ rules: [] }, (data) => {
  const currentHostname = window.location.hostname;

  // Filter rules applicable to the current page
  const activeRules = data.rules.filter(rule => {
    // Normalize user input (remove protocol and trailing slashes)
    const ruleDomain = rule.url
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();

    // Check 1: Exact Match
    const isExactMatch = currentHostname === ruleDomain;
    
    // Check 2: Subdomain Match (must end with .domain.com)
    const isSubdomain = currentHostname.endsWith('.' + ruleDomain);

    return isExactMatch || isSubdomain;
  });

  if (activeRules.length > 0) {
    runCleaner(activeRules);
  }
});

/**
 * Main execution function
 * @param {Array} rules - List of active rules for this page
 */
function runCleaner(rules) {
  const clean = () => {
    rules.forEach(rule => {
      try {
        const elements = document.querySelectorAll(rule.selector);
        
        elements.forEach(el => {
          const action = rule.action || 'remove'; // Default fallback

          switch (action) {
            case 'remove':
              // Action: Delete element from DOM
              el.remove();
              break;

            case 'removeClass':
              // Action: Remove specific class
              if (rule.value && el.classList.contains(rule.value)) {
                el.classList.remove(rule.value);
              }
              break;
            
            case 'addClass':
              // Action: Add new class
              if (rule.value) {
                el.classList.add(rule.value);
              }
              break;

            case 'removeStyle':
              // Action: Remove inline style property
              if (rule.value) {
                el.style.removeProperty(rule.value);
              }
              break;

            case 'setStyle': 
            case 'modifyStyle': // Backward compatibility
              // Action: Set or Modify CSS property
              if (rule.value && rule.extraValue) {
                // Check if user wants priority (e.g., "red !important")
                const val = rule.extraValue;
                const isImportant = val.toLowerCase().includes('!important');
                const cleanVal = val.replace(/!important/i, '').trim();
                
                el.style.setProperty(
                  rule.value, 
                  cleanVal, 
                  isImportant ? 'important' : ''
                );
              }
              break;
          }
        });
        
      } catch (e) {
        // Suppress errors for invalid selectors to avoid console noise
      }
    });
  };

  // 1. Initial run
  clean();

  // 2. Setup MutationObserver for dynamic content changes
  const observer = new MutationObserver((mutations) => {
    clean(); 
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true, 
    attributeFilter: ['class', 'style'] // Only watch relevant attributes
  });
}
