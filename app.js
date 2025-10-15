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
const webhookUrl = 'https://hook.eu1.make.com/j0vb45873j47mawzhuhc8t6k9y4276k6';
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
        handleConnectionChange(); 
    } catch (error) {
        console.error("Initialization failed:", error);
    }
});

// --- Event Listeners ---
form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = attachmentInput.files.length > 0 ? attachmentInput.files[0] : null;
    const submission = {
        formData: {
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
        },
        file: file 
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
    attachmentNote.textContent = isOnline ? '(File will be uploaded)' : '(Attachments disabled while offline)';
    displayPendingSubmissions(); 
}

function setupConditionalFields() {
    const setupVisibilityToggle = (selectId, wrapperId, triggerValue) => {
        const selectElement = document.getElementById(selectId);
        const wrapperElement = document.getElementById(wrapperId);
        if (!selectElement || !wrapperElement) return;
        const checkVisibility = () => {
             if (selectElement.value === triggerValue) wrapperElement.style.display = 'block';
             else wrapperElement.style.display = 'none';
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
    const submissions = await getPendingSubmissions();
    submissionList.innerHTML = '';
    syncButton.hidden = true;
    syncMessage.textContent = '';
    if (submissions.length === 0) {
        submissionList.innerHTML = '<li>No pending reports.</li>';
    } else {
        if (navigator.onLine) syncButton.hidden = false;
        submissions.forEach(sub => {
            const li = document.createElement('li');
            li.textContent = `Report from ${sub.formData["First Name"]} (${sub.formData["Report Type"]})`;
            li.className = 'status-pending';
            submissionList.appendChild(li);
        });
    }
}

async function syncSubmissions() {
    const submissions = await getPendingSubmissions();
    if (submissions.length === 0 || !navigator.onLine) return;

    syncMessage.textContent = `Syncing ${submissions.length} report(s)...`;
    syncButton.disabled = true;
    for (const sub of submissions) {
        const formData = new FormData();
        for (const key in sub.formData) {
            formData.append(key, sub.formData[key]);
        }
        if (sub.file) {
            formData.append('file', sub.file, sub.file.name);
        }
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                await deleteSubmission(sub.id);
            } else {
                syncMessage.textContent = `Error: ${response.statusText}. Submission failed.`;
                syncButton.disabled = false;
                return; 
            }
        } catch (error) {
            syncMessage.textContent = 'Sync failed. Check console for errors.';
            syncButton.disabled = false;
            return; 
        }
    }
    syncMessage.textContent = 'Sync complete!';
    syncButton.disabled = false;
    await displayPendingSubmissions();
}

// --- ✅ CORRECTED Database Functions ---
function saveSubmission(submission) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        transaction.onerror = (event) => reject(event.target.error);
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(submission);
        request.onsuccess = () => resolve(request.result);
    });
}
function getPendingSubmissions() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        transaction.onerror = (event) => reject(event.target.error);
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
}
function deleteSubmission(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        transaction.onerror = (event) => reject(event.target.error);
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
    });
}