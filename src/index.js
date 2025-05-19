// Variables to store file data
let uploadedFile = null;

// DOM Elements (will be initialized after DOMContentLoaded)
let uploadArea = null;
let fileInput = null;
let browseButton = null;
let loadButton = null;
let fileInfo = null;
let fileName = null;
let fileSize = null;
let fileType = null;
let errorMessage = null;

// Initialize the application
function init() {
    // Initialize DOM elements
    uploadArea = document.getElementById('upload-area');
    fileInput = document.getElementById('file-input');
    browseButton = document.getElementById('browse-btn');
    loadButton = document.getElementById('load-btn');
    fileInfo = document.getElementById('file-info');
    fileName = document.getElementById('file-name');
    fileSize = document.getElementById('file-size');
    fileType = document.getElementById('file-type');
    errorMessage = document.getElementById('error-message');

    // Check if all elements are found
    if (!uploadArea || !fileInput || !browseButton || !loadButton) {
        console.error('Some DOM elements were not found!');
        console.log('uploadArea:', uploadArea);
        console.log('fileInput:', fileInput);
        console.log('browseButton:', browseButton);
        console.log('loadButton:', loadButton);
        return;
    }

    // Setup event listeners only if elements exist
    setupEventListeners();
    
    // Setup drag and drop
    setupDragAndDrop();
}

// Setup event listeners
function setupEventListeners() {
    // Don't click the input when clicking the upload area if clicking browse button
    uploadArea.addEventListener('click', (e) => {
        // Only trigger file input if click wasn't on browse button
        if (e.target !== browseButton) {
            fileInput.click();
        }
    });
    
    browseButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
    });
    
    fileInput.addEventListener('change', handleFileSelect);
    loadButton.addEventListener('click', handleLoadModel);
}

// Handle file selection from input
function handleFileSelect(e) {
    console.log('File input changed', e);
    console.log('Files:', e.target.files);
    
    const files = e.target.files;
    if (files && files.length > 0) {
        console.log('Processing file:', files[0].name);
        processFile(files[0]);
    } else {
        console.log('No files selected');
    }
}

// Setup drag and drop functionality
function setupDragAndDrop() {
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        if (uploadArea && document.body) {
            uploadArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        }
    });
    
    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        if (uploadArea) {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.add('active'), false);
        }
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        if (uploadArea) {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('active'), false);
        }
    });
    
    // Handle dropped files
    if (uploadArea) {
        uploadArea.addEventListener('drop', handleDrop, false);
    }
}

// Prevent default drag behaviors
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Handle dropped files
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        fileInput.files = files; // Update file input
        processFile(files[0]);
    }
}

// Process the file
function processFile(file) {
    console.log('Processing file:', file.name);
    console.log('File size:', file.size);
    console.log('File type:', file.type);
    
    // Check file extension
    const validExtensions = ['.step', '.stp', '.iges', '.igs'];
    const isValidFile = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValidFile) {
        console.log('Invalid file type');
        showError("Invalid file type. Please upload a STEP or IGES file.");
        return;
    }
    
    uploadedFile = file;
    displayFileInfo(file);
    loadButton.disabled = false;
    hideError();
}

// Display file information
function displayFileInfo(file) {
    if (fileName && fileSize && fileType && fileInfo) {
        fileName.innerHTML = `<strong>Name:</strong> ${file.name}`;
        fileSize.innerHTML = `<strong>Size:</strong> ${formatFileSize(file.size)}`;
        fileType.innerHTML = `<strong>Type:</strong> ${getFileType(file)}`;
        fileInfo.style.display = 'block';
    }
}

// Get file type description
function getFileType(file) {
    const extension = file.name.toLowerCase().split('.').pop();
    switch (extension) {
        case 'step':
        case 'stp':
            return 'STEP (Standard for the Exchange of Product model data)';
        case 'iges':
        case 'igs':
            return 'IGES (Initial Graphics Exchange Specification)';
        default:
            return extension.toUpperCase();
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Show error message
function showError(message) {
    if (errorMessage && fileInfo && loadButton) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        fileInfo.style.display = 'none';
        loadButton.disabled = true;
        uploadedFile = null;
    }
}

// Hide error message
function hideError() {
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }
}

// Handle loading the model
async function handleLoadModel() {
    if (!uploadedFile) {
        showError("Please select a file first.");
        return;
    }
    
    try {
        // Create a FileReader to read the file
        const reader = new FileReader();
        
        reader.onload = () => {
            // Create a Blob URL for the file
            const blob = new Blob([reader.result], { type: uploadedFile.type });
            const blobUrl = URL.createObjectURL(blob);
            
            // Store file metadata in sessionStorage with the blob URL
            sessionStorage.setItem('pendingCADModel', JSON.stringify({
                name: uploadedFile.name,
                size: uploadedFile.size,
                type: uploadedFile.type,
                blobUrl: blobUrl,
                uploadTime: new Date().toISOString()
            }));
            
            // Navigate to the viewer
            window.location.href = './demos/engine+export/index.html';
        };
        
        reader.onerror = () => {
            showError("Error reading file. Please try again.");
        };
        
        // Read the file as an ArrayBuffer (more efficient than base64)
        reader.readAsArrayBuffer(uploadedFile);
        
    } catch (error) {
        console.error('Error handling file:', error);
        showError("Error processing file. Please try again.");
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}