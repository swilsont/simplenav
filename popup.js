/**
 * SimpleNav - Popup Logic v1.6.0
 * * Features:
 * - CRUD operations via chrome.storage.sync
 * - Accordion view grouped by Domain (alphabetically sorted)
 * - Auto-save drafts to localStorage (persistence on close)
 * - Dynamic UI based on selected Action type
 */

// Global State
// -1 indicates "Create Mode". Any other number is the index of the rule being edited.
let editingIndex = -1; 

// --- DOM Elements Reference ---
const actionBtn = document.getElementById('actionBtn');
const cancelBtn = document.getElementById('cancelBtn');
const urlInput = document.getElementById('urlInput');
const selectorInput = document.getElementById('selectorInput');
const rulesList = document.getElementById('rulesList');

const actionSelect = document.getElementById('actionSelect');

// Input 1 (Class name or Property name)
const valueContainer = document.getElementById('valueContainer');
const valueInput = document.getElementById('valueInput');
const valueLabel = document.getElementById('valueLabel');

// Input 2 (New Value for Set Style)
const extraValueContainer = document.getElementById('extraValueContainer');
const extraValueInput = document.getElementById('extraValueInput');


// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
  // 1. Restore draft if user closed popup accidentally
  restoreState();
  
  // 2. Load and render existing rules
  loadRules();
  
  // 3. Attach Event Listeners
  if (actionBtn) actionBtn.addEventListener('click', handleAction);
  if (cancelBtn) cancelBtn.addEventListener('click', resetForm);
  
  if (actionSelect) {
    actionSelect.addEventListener('change', updateInputVisibility);
  }

  // 4. Attach Listeners for Draft Auto-Saving (on every keystroke)
  const inputs = [urlInput, selectorInput, valueInput, extraValueInput, actionSelect];
  inputs.forEach(el => {
    if (el) el.addEventListener('input', saveState);
  });
});


// --- UI Logic ---

/**
 * Toggles visibility of input fields based on the selected Action.
 * Updates labels and placeholders dynamically.
 */
function updateInputVisibility() {
  const action = actionSelect.value;
  
  // Reset visibility
  valueContainer.style.display = 'none';
  extraValueContainer.style.display = 'none';
  
  if (action === 'remove') {
    // No extra parameters needed for deletion
    return;
  }
  
  // Show Parameter 1
  valueContainer.style.display = 'block';

  switch (action) {
    case 'removeClass':
      valueLabel.textContent = 'Class Name to Remove:';
      valueInput.placeholder = 'e.g. blurred';
      break;
    case 'addClass':
      valueLabel.textContent = 'Class Name to Add:';
      valueInput.placeholder = 'e.g. my-custom-class';
      break;
    case 'removeStyle':
      valueLabel.textContent = 'CSS Property to Remove:';
      valueInput.placeholder = 'e.g. overflow';
      break;
    case 'setStyle':
      valueLabel.textContent = 'CSS Property to Set:';
      valueInput.placeholder = 'e.g. background-color';
      // Show Parameter 2 (New Value)
      extraValueContainer.style.display = 'block';
      break;
  }
}

/**
 * Main handler to Save (Create) or Update a rule.
 */
function handleAction() {
  const url = urlInput.value.trim();
  const selector = selectorInput.value.trim();
  const action = actionSelect.value;
  const value = valueInput.value.trim();
  const extraValue = extraValueInput.value.trim();

  // --- Validation ---
  let isValid = true;
  if (!url) { urlInput.style.border = "1px solid red"; isValid = false; }
  else urlInput.style.border = "";
  
  if (!selector) { selectorInput.style.border = "1px solid red"; isValid = false; }
  else selectorInput.style.border = "";

  // Validate Parameter 1 (required for everything except 'remove')
  if (action !== 'remove' && !value) {
    valueInput.style.border = "1px solid red"; isValid = false;
  } else {
    valueInput.style.border = "";
  }

  // Validate Parameter 2 (required only for 'setStyle')
  if (action === 'setStyle' && !extraValue) {
    extraValueInput.style.border = "1px solid red"; isValid = false;
  } else {
    extraValueInput.style.border = "";
  }

  if (!isValid) return;

  // --- Storage Operation ---
  chrome.storage.sync.get({ rules: [] }, (data) => {
    const rules = data.rules;
    const newRule = { url, selector, action, value, extraValue };

    if (editingIndex === -1) {
      rules.push(newRule); // Create new
    } else {
      rules[editingIndex] = newRule; // Update existing
    }
    
    chrome.storage.sync.set({ rules }, () => {
      clearState(); // Clear draft
      resetForm();
      loadRules();
    });
  });
}

/**
 * Renders rules grouped by Domain in an Accordion layout.
 */
function loadRules() {
  if (!rulesList) return;
  rulesList.innerHTML = '';

  chrome.storage.sync.get({ rules: [] }, (data) => {
    const rules = data.rules;
    
    if (rules.length === 0) {
      rulesList.innerHTML = '<div style="text-align:center; color:#999; font-size:12px; margin-top:20px;">No active rules.</div>';
      return;
    }

    // 1. Group rules by URL
    const groups = {};
    rules.forEach((rule, originalIndex) => {
      const domainKey = rule.url.toLowerCase();
      if (!groups[domainKey]) groups[domainKey] = [];
      // Store originalIndex to allow editing/deleting the correct item later
      groups[domainKey].push({ ...rule, originalIndex });
    });

    // 2. Sort domains alphabetically
    const sortedDomains = Object.keys(groups).sort();

    // 3. Render Groups
    sortedDomains.forEach(domain => {
      // Header
      const headerDiv = document.createElement('div');
      headerDiv.className = 'domain-group-header';
      headerDiv.innerHTML = `
        <span>${domain} <span style="font-weight:normal; color:#666; font-size:10px;">(${groups[domain].length})</span></span>
        <span class="header-arrow">▼</span>
      `;

      // Rules Container
      const rulesContainer = document.createElement('div');
      rulesContainer.className = 'rules-container';

      // Rule Items
      groups[domain].forEach(item => {
        const div = document.createElement('div');
        div.className = 'rule-item';
        
        // Generate Badge based on Action
        let badgeHtml = '';
        const action = item.action || 'remove'; // Fallback for legacy rules

        switch(action) {
          case 'remove':
            badgeHtml = `<span class="rule-action bg-remove">DELETE</span>`;
            break;
          case 'removeClass':
             badgeHtml = `<span class="rule-action bg-modify">NO-CLASS: ${item.value}</span>`;
             break;
          case 'addClass':
             badgeHtml = `<span class="rule-action bg-add">ADD CLASS: ${item.value}</span>`;
             break;
          case 'removeStyle':
             badgeHtml = `<span class="rule-action bg-modify">NO-STYLE: ${item.value}</span>`;
             break;
          case 'setStyle':
          case 'modifyStyle': // Backward compatibility
             badgeHtml = `<span class="rule-action bg-set" title="${item.value}: ${item.extraValue}">SET ${item.value}</span>`;
             break;
        }

        div.innerHTML = `
          <div class="rule-content">
              <div class="rule-selector" title="${item.selector}">${item.selector}</div>
              ${badgeHtml}
          </div>
          <div class="btn-group">
              <button class="edit-btn" data-index="${item.originalIndex}">Edit</button>
              <button class="delete-btn" data-index="${item.originalIndex}">✕</button>
          </div>
        `;
        rulesContainer.appendChild(div);
      });

      // Accordion Toggle Logic
      headerDiv.addEventListener('click', () => {
        const isOpen = rulesContainer.classList.contains('open');
        // Close others (optional)
        document.querySelectorAll('.rules-container').forEach(el => el.classList.remove('open'));
        document.querySelectorAll('.domain-group-header').forEach(el => el.classList.remove('active'));

        if (!isOpen) {
          rulesContainer.classList.add('open');
          headerDiv.classList.add('active');
        }
      });

      rulesList.appendChild(headerDiv);
      rulesList.appendChild(rulesContainer);
    });

    attachDynamicListeners();
  });
}

/**
 * Attaches event listeners to dynamically created Edit/Delete buttons.
 */
function attachDynamicListeners() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent accordion toggle
      loadRuleIntoForm(parseInt(e.target.dataset.index));
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent accordion toggle
      deleteRule(parseInt(e.target.dataset.index));
    });
  });
}

/**
 * Loads a rule into the form inputs for editing.
 */
function loadRuleIntoForm(index) {
  chrome.storage.sync.get({ rules: [] }, (data) => {
    const rule = data.rules[index];
    if (!rule) return;

    // Populate inputs
    urlInput.value = rule.url;
    selectorInput.value = rule.selector;
    actionSelect.value = rule.action || 'remove';
    valueInput.value = rule.value || '';
    extraValueInput.value = rule.extraValue || '';
    
    editingIndex = index;
    
    // Update UI state
    updateInputVisibility();
    updateUiState(true);
    saveState(); // Save state immediately
    
    // UX Focus
    if (rule.action === 'remove') selectorInput.focus();
    else valueInput.focus();
  });
}

function deleteRule(index) {
  if (index === editingIndex) { clearState(); resetForm(); }

  chrome.storage.sync.get({ rules: [] }, (data) => {
    const rules = data.rules;
    rules.splice(index, 1);
    clearState();
    resetForm();
    chrome.storage.sync.set({ rules }, loadRules);
  });
}

function resetForm() {
  // Clear inputs
  urlInput.value = '';
  selectorInput.value = '';
  valueInput.value = '';
  extraValueInput.value = '';
  actionSelect.value = 'remove';
  
  [urlInput, selectorInput, valueInput, extraValueInput].forEach(el => el.style.border = "");
  
  editingIndex = -1;
  updateInputVisibility();
  updateUiState(false);
  clearState();
}

/**
 * Updates the appearance of the main button (Save vs Update).
 */
function updateUiState(isEditMode) {
  if (!actionBtn) return;
  if (isEditMode) {
    actionBtn.textContent = 'Update Rule';
    actionBtn.classList.add('mode-edit');
    if (cancelBtn) cancelBtn.style.display = 'block';
  } else {
    actionBtn.textContent = 'Save Rule';
    actionBtn.classList.remove('mode-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';
  }
}

// --- Persistence Logic (LocalStorage) ---

function saveState() {
  const state = {
    url: urlInput.value,
    selector: selectorInput.value,
    action: actionSelect.value,
    value: valueInput.value,
    extraValue: extraValueInput.value,
    index: editingIndex
  };
  localStorage.setItem('simpleNavDraft', JSON.stringify(state));
}

function restoreState() {
  const saved = localStorage.getItem('simpleNavDraft');
  if (saved) {
    try {
      const state = JSON.parse(saved);
      urlInput.value = state.url || '';
      selectorInput.value = state.selector || '';
      actionSelect.value = state.action || 'remove';
      valueInput.value = state.value || '';
      extraValueInput.value = state.extraValue || '';
      editingIndex = state.index;

      updateInputVisibility();
      if (editingIndex !== -1) updateUiState(true);
    } catch (e) {
      console.error(e);
    }
  }
}

function clearState() {
  localStorage.removeItem('simpleNavDraft');
}
