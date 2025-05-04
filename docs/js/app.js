document.addEventListener('DOMContentLoaded', () => {
    // Helper Functions
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    function showError(message) {
        alert(message); // Simple alert for now, can be replaced with a nicer error component
    }
    
    function simulateApiCall(formData) {
        // This function simulates an API response for testing purposes
        return new Promise((resolve) => {
            setTimeout(() => {
                const file = formData.get('file');
                // Simulate different scores based on file type and size
                const score = Math.floor(Math.random() * 30) + 70; // Random score between 70-99
                
                // Simulate different suggestions based on score
                let suggestions = [];
                if (score < 80) {
                    suggestions = [
                        'Consider adding a summary section at the top of your resume',
                        'Use more industry-specific keywords to improve ATS matching',
                        'Make sure all dates are in a consistent format (MM/YYYY)',
                        'Avoid using tables or complex formatting that might confuse ATS systems'
                    ];
                } else if (score < 90) {
                    suggestions = [
                        'Consider adding measurable achievements to your experience section',
                        'Ensure all section headings are clearly labeled (e.g., "Experience", "Education")'
                    ];
                } else {
                    suggestions = ['Your resume format is ATS-friendly'];
                }
                
                // Create a mock response
                resolve({
                    name: 'John Smith',
                    email: 'john.smith@example.com',
                    phone: '(555) 123-4567',
                    skills: ['JavaScript', 'React', 'Node.js', 'Python', 'Data Analysis', 'Project Management'],
                    education: 'Bachelor of Science in Computer Science\nUniversity of California, Berkeley\n2016 - 2020',
                    experience: 'Software Engineer\nTech Solutions Inc.\nJanuary 2020 - Present\n\nJunior Developer\nStartup Innovations\nJune 2018 - December 2019',
                    score: score,
                    suggestions: suggestions
                });
            }, 2000); // 2 second delay to simulate processing time
        });
    }
    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const filePreview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const removeFileBtn = document.getElementById('removeFile');
    const analyzeButton = document.getElementById('analyzeButton');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const resultsSection = document.getElementById('resultsSection');
    
    // Result Elements
    const scoreNumber = document.getElementById('scoreNumber');
    const scoreMeterFill = document.getElementById('scoreMeterFill');
    const suggestionsList = document.getElementById('suggestionsList');
    const parsedName = document.getElementById('parsedName');
    const parsedEmail = document.getElementById('parsedEmail');
    const parsedPhone = document.getElementById('parsedPhone');
    const parsedSkills = document.getElementById('parsedSkills');
    const parsedEducation = document.getElementById('parsedEducation');
    const parsedExperience = document.getElementById('parsedExperience');

    // Backend API URL (change this to your actual backend URL when deployed)
    const API_URL = 'https://atsview.onrender.com';
    
    // For development & testing without a backend
    const DEVELOPMENT_MODE = true; // Set to false when connecting to real backend
    
    // File object to store the uploaded file
    let uploadedFile = null;

    // Handle file selection
    fileInput.addEventListener('change', (e) => {
        handleFileSelection(e.target.files[0]);
    });

    // Handle drag and drop events
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });

    // Handle remove file button
    removeFileBtn.addEventListener('click', () => {
        resetFileUpload();
    });

    // Handle analyze button
    analyzeButton.addEventListener('click', () => {
        if (uploadedFile) {
            analyzeResume(uploadedFile);
        }
    });

    // Function to handle file selection
    function handleFileSelection(file) {
        if (!file) return;
        
        // Check if the file is PDF or DOCX
        const validFileTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        
        if (!validFileTypes.includes(file.type)) {
            showError('Please upload a PDF or DOCX file.');
            return;
        }
        
        // Store the file
        uploadedFile = file;
        
        // Update the file preview
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        filePreview.classList.remove('hidden');
        
        // Enable the analyze button
        analyzeButton.disabled = false;
    }

    // Function to reset file upload
    function resetFileUpload() {
        uploadedFile = null;
        fileInput.value = '';
        filePreview.classList.add('hidden');
        analyzeButton.disabled = true;
    }

    // Function to analyze the resume
    function analyzeResume(file) {
        // Show loading overlay
        loadingOverlay.classList.remove('hidden');
        
        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        
        if (DEVELOPMENT_MODE) {
            // Simulate API call for development
            simulateApiCall(formData)
                .then(data => {
                    // Update the UI with the parsed data
                    updateResults(data);
                    
                    // Hide loading overlay and show results
                    loadingOverlay.classList.add('hidden');
                    resultsSection.classList.remove('hidden');
                    
                    // Scroll to results section
                    resultsSection.scrollIntoView({ behavior: 'smooth' });
                })
                .catch(error => {
                    loadingOverlay.classList.add('hidden');
                    showError('An error occurred while analyzing your resume. Please try again.');
                    console.error('Error:', error);
                });
        } else {
            // Real API call to the backend
            fetch(`${API_URL}/upload`, {
                method: 'POST',
                body: formData,
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Server responded with an error');
                    }
                    return response.json();
                })
                .then(data => {
                    // Update the UI with the parsed data
                    updateResults(data);
                    
                    // Hide loading overlay and show results
                    loadingOverlay.classList.add('hidden');
                    resultsSection.classList.remove('hidden');
                    
                    // Scroll to results section
                    resultsSection.scrollIntoView({ behavior: 'smooth' });
                })
                .catch(error => {
                    loadingOverlay.classList.add('hidden');
                    showError('An error occurred while analyzing your resume. Please try again.');
                    console.error('Error:', error);
                });
        }
    }

    // Function to update the results UI
    function updateResults(data) {
        // Update score
        scoreNumber.textContent = data.score;
        scoreMeterFill.style.width = `${data.score}%`;
        
        // Update suggestions
        suggestionsList.innerHTML = '';
        if (data.suggestions && data.suggestions.length > 0) {
            data.suggestions.forEach(suggestion => {
                const li = document.createElement('li');
                li.textContent = suggestion;
                suggestionsList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'Your resume looks great! No major issues detected.';
            suggestionsList.appendChild(li);
        }

        // Update parsed information
        parsedName.textContent = data.name || 'Not detected';
        parsedEmail.textContent = data.email || 'Not detected';
        parsedPhone.textContent = data.phone || 'Not detected';
        
        // Update skills list
        parsedSkills.innerHTML = '';
        if (data.skills && data.skills.length > 0) {
            data.skills.forEach(skill => {
                const span = document.createElement('span');
                span.className = 'skill-tag';
                span.textContent = skill;
                parsedSkills.appendChild(span);
            });
        } else {
            parsedSkills.textContent = 'No skills detected';
        }
        
        // Update education and experience (replace newlines with HTML breaks)
        parsedEducation.innerHTML = data.education ? data.education.replace(/\n/g, '<br>') : 'Not detected';
        parsedExperience.innerHTML = data.experience ? data.experience.replace(/\n/g, '<br>') : 'Not detected';
    }
});