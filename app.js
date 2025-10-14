// Service Worker and IndexedDB setup (no changes needed from previous version)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker: Registered'))
            .catch(err => console.log(`Service Worker: Error: ${err}`));
    });
}
const DB_NAME = 'form-submissions-db';
const STORE_NAME = 'submissions';
let db;
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = (event) => reject("IndexedDB error: " + event.target.errorCode);
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };
        request.onupgradeded = (event) => {
            const db = event.target.result;
            db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        };
    });
}

// --- Main Application Logic ---
const form = document.getElementById('airtable-form');
const submissionList = document.getElementById('submission-list');
const webhookUrl = 'https://hooks.airtable.com/workflows/v1/genericWebhook/appwYah1izUq3klHj/wfl1d1R2qZdQA0txX/wtr3MJYEmJ9g8OjVI';

// --- Conditional Field Logic ---
function setupConditionalFields() {
    // Show/hide based on dropdown selection
    const setupVisibilityToggle = (selectId, wrapperId, triggerValue) => {
        const selectElement = document.getElementById(selectId);
        const wrapperElement = document.getElementById(wrapperId);
        wrapperElement.style.display = 'none'; // Hide by default
        selectElement.addEventListener('change', () => {
            if (selectElement.value === triggerValue) {
                wrapperElement.style.display = 'block';
            } else {
                wrapperElement.style.display = 'none';
            }
        });
    };

    // Report Type specific fields
    setupVisibilityToggle('ReportType', 'other-report-wrapper', 'Other');
    setupVisibilityToggle('ReportType', 'hotel-issue-wrapper', 'Hotel Issues');
    setupVisibilityToggle('ReportType', 'eba-breach-wrapper', 'Breach of EBA');

    // Company Report reference number fields
    setupVisibilityToggle('hasApiReport', 'api-ref-wrapper', 'Yes');
    setupVisibilityToggle('hasFatigueReport', 'fatigue-ref-wrapper', 'Yes');
    setupVisibilityToggle('hasSafetyReport', 'safety-ref-wrapper', 'Yes');
}


// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    setupConditionalFields();
    await displayPendingSubmissions();
    if (navigator.onLine) {
        await syncSubmissions();
    }
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const attachmentInput = document.getElementById('Attachments');
    const attachmentName = attachmentInput.files.length > 0 ? attachmentInput.files[0].name : '';

    // Create the submission object with keys matching Airtable field names
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
        "Attachments": attachmentName // Storing filename only
    };
    
    await saveSubmission(submission);
    form.reset();
    // Re-hide conditional fields after reset
    setupConditionalFields();
    await displayPendingSubmissions();
});

// --- Database and Sync Functions (no changes needed) ---
async function saveSubmission(submission) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(submission);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject("Error saving submission: " + event.target.error);
    });
}

async function getPendingSubmissions() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject("Error fetching submissions: " + event.target.error);
    });
}

async function displayPendingSubmissions() {
    const submissions = await getPendingSubmissions();
    submissionList.innerHTML = '';
    if (submissions.length === 0) {
        submissionList.innerHTML = '<li>No pending reports.</li>';
    } else {
        submissions.forEach(sub => {
            const li = document.createElement('li');
            // Use bracket notation for keys with spaces
            li.textContent = `Report from ${sub["First Name"]} (${sub["Report Type"]})`;
            li.className = 'status-pending';
            submissionList.appendChild(li);
        });
    }
}

async function syncSubmissions() {
    const submissions = await getPendingSubmissions();
    if (submissions.length === 0) return;
    console.log(`Syncing ${submissions.length} submissions...`);
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
                console.error('Failed to submit data:', response.statusText);
            }
        } catch (error) {
            console.error('Network error during sync:', error);
            return;
        }
    }
    console.log('Sync complete.');
    await displayPendingSubmissions();
}

async function deleteSubmission(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject("Error deleting submission: " + event.target.error);
    });
}

window.addEventListener('online', syncSubmissions);
