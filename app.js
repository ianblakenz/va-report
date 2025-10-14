// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker: Registered'))
            .catch(err => console.log(`Service Worker: Error: ${err}`));
    });
}

// --- IndexedDB Setup ---
const DB_NAME = 'form-submissions-db';
const STORE_NAME = 'submissions';
let db;
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2); 
        request.onerror = (event) => reject("IndexedDB error: " + event.target.errorCode);
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// --- DOM Elements ---
const form = document.getElementById('airtable-form');
const submissionList = document.getElementById('submission-list');
const webhookUrl = 'https://hooks.airtable.com/workflows/v1/genericWebhook/appwYah1izUq3klHj/wfl1d1R2qZdQA0txX/wtr3MJYEmJ9g8OjVI';
const attachmentInput = document.getElementById('Attachments');
const attachmentNote = document.getElementById('attachment-note');
const syncButton = document.getElementById('sync-button');
const syncMessage = document.getElementById('sync-message');

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        setupConditionalFields();
        await displayPendingSubmissions();
        handleConnectionChange(); // Set initial state for attachments/sync
        if (navigator.onLine) {
            await syncSubmissions();
        }
    } catch (error) {
        console.error("Initialization failed:", error);
    }
});

// --- Event Listeners ---
form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const attachmentName = attachmentInput.files.length > 0 ? attachmentInput.files[0].name : '';

    const submission = {
        "First Name": document.getElementById('FirstName').value,
        "Last Name": document.getElementById('LastName').value,
        "Staff Number": Number(document.getElementById('StaffNumber').value),
        "Email 2": document.getElementById('Email2').value,
        "Base": document.getElementById('Base').value,
        "Phone Number ": document.getElementById('PhoneNumber').value,
        "Report Type": document.getElementById('ReportType').value,
        "Other - Please describe report type": document.getElementById('OtherReportType').value,
        "Which port and hotel?": document.getElementById('WhichPortAndHotel').value,
        "Have you submitted a company API report?": document.getElementById('hasApiReport').value,
        "What is your API report reference number?": document.getElementById('ApiRefNumber').value,
        "Which clause of the EBA do you think was breached": document.getElementById('EbaClause').value,
        "Have you submitted a fatigue report?": document.getElementById('hasFatigueReport').value,
        "What is your fatigue report reference number?": document.getElementById('FatigueRefNumber').value,
        "Have you submitted a company safety report?": document.getElementById('hasSafetyReport').value,
        "What is your safety report reference number?": document.getElementById('SafetyRefNumber').value,
        "Copy and paste body of Virgin Australia report here": document.getElementById('ReportBody').value,
        "Attachments": attachmentName
    };
    
    await saveSubmission(submission);
    form.reset();
    setupConditionalFields(); 
    await displayPendingSubmissions();
});

syncButton.addEventListener('click', syncSubmissions);
window.addEventListener('online', handleConnectionChange);
window.addEventListener('offline', handleConnectionChange);

// --- Core Functions ---
function handleConnectionChange() {
    const isOnline = navigator.onLine;
    attachmentInput.disabled = !isOnline;
    attachmentNote.textContent = isOnline ? '(Online connection required)' : '(Disabled while offline)';
    
    displayPendingSubmissions(); // Re-check to show/hide sync button
    
    if (isOnline) {
        console.log("Browser is online.");
        syncSubmissions();
    } else {
        console.log("Browser is offline.");
    }
}

function setupConditionalFields() {
    const setupVisibilityToggle = (selectId, wrapperId, triggerValue) => {
        const selectElement = document.getElementById(selectId);
        const wrapperElement = document.getElementById(wrapperId);
        if (!selectElement || !wrapperElement) return;

        const checkVisibility = () => {
             if (selectElement.value === triggerValue) {
                wrapperElement.style.display = 'block';
            } else {
                wrapperElement.style.display = 'none';
            }
        };
        checkVisibility(); 
        selectElement.addEventListener('change', checkVisibility);
    };
    setupVisibilityToggle('ReportType', 'other-report-wrapper', 'Other');
    setupVisibilityToggle('ReportType', 'hotel-issue-wrapper', 'Hotel Issues');
    setupVisibilityToggle('ReportType', 'eba-breach-wrapper', 'Breach of EBA');
    setupVisibilityToggle('hasApiReport', 'api-ref-wrapper', 'Yes');
    setupVisibilityToggle('hasFatigueReport', 'fatigue-ref-wrapper', 'Yes');
    setupVisibilityToggle('hasSafetyReport', 'safety-ref-wrapper', 'Yes');
}

async function displayPendingSubmissions() {
    try {
        const submissions = await getPendingSubmissions();
        submissionList.innerHTML = '';
        syncButton.hidden = true;
        syncMessage.textContent = '';

        if (submissions.length === 0) {
            submissionList.innerHTML = '<li>No pending reports.</li>';
        } else {
            if (navigator.onLine) {
                syncButton.hidden = false; // Show sync button if online and pending items exist
            }
            submissions.forEach(sub => {
                const li = document.createElement('li');
                li.textContent = `Report from ${sub["First Name"]} (${sub["Report Type"]})`;
                li.className = 'status-pending';
                submissionList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Failed to display pending submissions:", error);
    }
}

async function syncSubmissions() {
    const submissions = await getPendingSubmissions();
    if (submissions.length === 0 || !navigator.onLine) {
        return;
    }

    syncMessage.textContent = `Syncing ${submissions.length} report(s)...`;
    syncButton.disabled = true;

    for (const sub of submissions) {
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sub)
            });
            if (response.ok) {
                await deleteSubmission(sub.id);
            } else {
                console.error(`Failed to submit data for ID ${sub.id}:`, response.statusText);
            }
        } catch (error) {
            console.error('Network error during sync:', error);
            syncMessage.textContent = 'Sync failed. Check your connection.';
            syncButton.disabled = false;
            return; // Stop if network fails
        }
    }

    syncMessage.textContent = 'Sync complete!';
    syncButton.disabled = false;
    await displayPendingSubmissions(); // Refresh the list
}

// --- Database Functions ---
async function saveSubmission(submission) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(submission);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getPendingSubmissions() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function deleteSubmission(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}
