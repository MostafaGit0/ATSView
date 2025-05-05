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

    // PDF.js library
    const pdfjsLib = window.pdfjsLib;
    if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
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
    
    // File object to store the uploaded file
    let uploadedFile = null;
    let extractedText = "";

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
        extractedText = "";
        fileInput.value = '';
        filePreview.classList.add('hidden');
        analyzeButton.disabled = true;
    }

    // Function to extract text from PDF
    async function extractTextFromPDF(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function(event) {
                try {
                    const typedArray = new Uint8Array(event.target.result);
                    const pdf = await pdfjsLib.getDocument(typedArray).promise;
                    let fullText = '';
                    
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + '\n';
                    }
                    
                    resolve(fullText);
                } catch (error) {
                    console.error('Error extracting text from PDF:', error);
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // Function to extract text from DOCX using Mammoth.js
    async function extractTextFromDOCX(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    mammoth.extractRawText({ arrayBuffer: event.target.result })
                        .then(result => resolve(result.value))
                        .catch(reject);
                } catch (error) {
                    console.error('Error extracting text from DOCX:', error);
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // Function to extract name
    function extractName(text) {
        // Common name patterns at the top of resumes
        const namePatterns = [
            /^([A-Z][a-z]+(?: [A-Z][a-z]+)+)$/m,  // First Last at beginning of line
            /^([A-Z][A-Z]+(?: [A-Z][a-z]+)+)$/m,  // JOHN Smith
            /^([A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+)$/m,  // First M. Last
        ];
        
        // Get the first 10 lines (likely to contain the name)
        const firstLines = text.split('\n').slice(0, 10).join('\n');
        
        for (const pattern of namePatterns) {
            const match = firstLines.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        
        // Fallback: look for capitalized words at beginning, likely a name
        const lines = text.split('\n').slice(0, 5);
        for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine && cleanLine.length > 3 && cleanLine.length < 40) {
                // Check if it looks like a name (capitalized words, no special chars)
                if (/^[A-Z][a-z]+(?: [A-Z][a-z]+)+$/.test(cleanLine)) {
                    return cleanLine;
                }
            }
        }
        
        return 'Not detected';
    }

    // Function to extract email
    function extractEmail(text) {
        const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
        const match = text.match(emailPattern);
        return match ? match[0] : 'Not detected';
    }

    // Function to extract phone
    function extractPhone(text) {
        // Various phone number formats
        const phonePatterns = [
            /\b\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/,  // (123) 456-7890 or 123-456-7890
            /\b(\+\d{1,3}[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/  // +1 (123) 456-7890
        ];
        
        for (const pattern of phonePatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[0];
            }
        }
        
        return 'Not detected';
    }

    // Function to extract skills
    function extractSkills(text) {
        const commonSkills = [
            // Programming Languages
            "Python", "Java", "JavaScript", "C\\+\\+", "C#", "Ruby", "PHP", "Swift", "Kotlin", "Go", "Rust",
            // Web Technologies
            "HTML", "CSS", "React", "Angular", "Vue", "Node.js", "Express", "Django", "Flask", "Spring Boot",
            // Databases
            "SQL", "MySQL", "PostgreSQL", "MongoDB", "Oracle", "DynamoDB", "Firebase",
            // Cloud Platforms
            "AWS", "Azure", "Google Cloud", "Heroku", "Netlify", "Vercel",
            // DevOps & Tools
            "Docker", "Kubernetes", "Jenkins", "Git", "GitHub", "GitLab", "CI/CD", "Terraform",
            // Data Science & AI
            "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "pandas", "NumPy", "Data Analysis",
            "NLP", "Computer Vision", "AI",
            // Mobile
            "Android", "iOS", "React Native", "Flutter", "Xamarin",
            // Microsoft Office
            "Word", "Excel", "PowerPoint", "Outlook", "Microsoft Office",
            // Design
            "Photoshop", "Illustrator", "InDesign", "Figma", "Sketch", "UX/UI", "UX Design", "UI Design",
            // Languages
            "English", "Spanish", "French", "German", "Chinese", "Japanese", "Korean",
            // Soft Skills
            "Project Management", "Team Leadership", "Communication", "Problem Solving", "Agile", "Scrum", 
            "Critical Thinking", "Teamwork", "Time Management"
        ];
        
        // Create a regex pattern to search for skills
        const pattern = new RegExp("\\b(" + commonSkills.join("|") + ")\\b", "gi");
        const matches = text.match(pattern) || [];
        
        // Remove duplicates (case-insensitive)
        const uniqueSkills = [];
        matches.forEach(skill => {
            if (!uniqueSkills.some(s => s.toLowerCase() === skill.toLowerCase())) {
                uniqueSkills.push(skill);
            }
        });
        
        return uniqueSkills;
    }

    // Function to extract education
    function extractEducation(text) {
        // Look for education section
        const educationPatterns = [
            /EDUCATION(?:[\s\S]*?)(?=EXPERIENCE|SKILLS|PROJECTS|\n\n\n|$)/i,
            /ACADEMIC(?:[\s\S]*?)(?=EXPERIENCE|SKILLS|PROJECTS|\n\n\n|$)/i,
            /QUALIFICATION(?:[\s\S]*?)(?=EXPERIENCE|SKILLS|PROJECTS|\n\n\n|$)/i
        ];
        
        for (const pattern of educationPatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[0].trim();
            }
        }
        
        // If no section found, try to find degree mentions
        const degreePattern = /(Bachelor|Master|PhD|B\.S\.|M\.S\.|B\.A\.|M\.A\.|B\.Tech|M\.Tech|MBA)(?:[\s\S]*?)(?=\n\n|$)/i;
        const match = text.match(degreePattern);
        if (match) {
            return match[0].trim();
        }
        
        return 'Not detected';
    }

    // Function to extract experience
    function extractExperience(text) {
        // Look for experience section
        const experiencePatterns = [
            /(?:EXPERIENCE|EMPLOYMENT|WORK HISTORY)(?:[\s\S]*?)(?=EDUCATION|SKILLS|PROJECTS|\n\n\n|$)/i,
            /(?:PROFESSIONAL BACKGROUND)(?:[\s\S]*?)(?=EDUCATION|SKILLS|PROJECTS|\n\n\n|$)/i
        ];
        
        for (const pattern of experiencePatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[0].trim();
            }
        }
        
        return 'Not detected';
    }

    // Function to calculate ATS score
    function calculateATSScore(parsedData, text) {
        let score = 70; // Base score
        let suggestions = [];
        
        // Check for key sections presence
        if (parsedData.name === 'Not detected') {
            score -= 5;
            suggestions.push("Include your full name prominently at the top of your resume");
        }
        
        if (parsedData.email === 'Not detected') {
            score -= 5;
            suggestions.push("Add a professional email address");
        }
        
        if (parsedData.phone === 'Not detected') {
            score -= 3;
            suggestions.push("Include a phone number for contact");
        }
        
        // Check skills
        const skillsCount = parsedData.skills.length;
        if (skillsCount === 0) {
            score -= 10;
            suggestions.push("Add a dedicated skills section with relevant keywords");
        } else if (skillsCount < 5) {
            score -= 5;
            suggestions.push("Consider adding more relevant skills to improve keyword matching");
        } else {
            score += 5;
        }
        
        // Check education
        if (parsedData.education === 'Not detected') {
            score -= 5;
            suggestions.push("Include your educational background");
        }
        
        // Check experience
        if (parsedData.experience === 'Not detected') {
            score -= 10;
            suggestions.push("Add your work experience with clear job titles and dates");
        }
        
        // Check for common formatting issues
        if (/[│┃┆┇┊┋╎╏┆┇┊┋]/.test(text)) { // Vertical bars often indicate tables
            score -= 5;
            suggestions.push("Avoid using tables or columns as they may confuse ATS systems");
        }
        
        // Check for section headers
        if (!/(EXPERIENCE|EMPLOYMENT|WORK HISTORY)/i.test(text)) {
            score -= 3;
            suggestions.push("Use clear section headers like 'Experience', 'Education', and 'Skills'");
        }
        
        // Check for date formats
        const dateFormats = (text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w* \d{4}\b/g) || []).length;
        if (dateFormats < 2) {
            suggestions.push("Use a consistent date format (Month YYYY) for work and education entries");
        }
        
        // Check length
        const wordCount = text.split(/\s+/).length;
        if (wordCount < 200) {
            score -= 5;
            suggestions.push("Your resume may be too short - consider adding more details");
        } else if (wordCount > 1000) {
            score -= 3;
            suggestions.push("Your resume is quite lengthy - consider focusing on the most relevant information");
        }
        
        // Summary/Objective section check
        if (!/(SUMMARY|OBJECTIVE|PROFILE)/i.test(text)) {
            suggestions.push("Consider adding a summary section highlighting your key qualifications");
        }
        
        // Cap the score
        score = Math.max(Math.min(score, 100), 0);
        
        return { score, suggestions };
    }

    // Function to analyze the resume
    async function analyzeResume(file) {
        // Show loading overlay
        loadingOverlay.classList.remove('hidden');
        
        try {
            // Extract text based on file type
            if (file.type === 'application/pdf') {
                if (!window.pdfjsLib) {
                    throw new Error('PDF.js library not loaded. Please ensure you have an internet connection.');
                }
                extractedText = await extractTextFromPDF(file);
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                if (!window.mammoth) {
                    throw new Error('Mammoth.js library not loaded. Please ensure you have an internet connection.');
                }
                extractedText = await extractTextFromDOCX(file);
            } else {
                throw new Error('Unsupported file type');
            }
            
            if (!extractedText || extractedText.trim() === '') {
                throw new Error('Could not extract text from file');
            }
            
            // Parse the extracted text
            const parsedData = {
                name: extractName(extractedText),
                email: extractEmail(extractedText),
                phone: extractPhone(extractedText),
                skills: extractSkills(extractedText),
                education: extractEducation(extractedText),
                experience: extractExperience(extractedText)
            };
            
            // Calculate ATS friendliness score
            const { score, suggestions } = calculateATSScore(parsedData, extractedText);
            parsedData.score = score;
            parsedData.suggestions = suggestions;
            
            // Update the UI with the parsed data
            updateResults(parsedData);
            
            // Hide loading overlay and show results
            loadingOverlay.classList.add('hidden');
            resultsSection.classList.remove('hidden');
            
            // Scroll to results section
            resultsSection.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            loadingOverlay.classList.add('hidden');
            showError(`An error occurred: ${error.message}`);
            console.error('Error:', error);
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
        parsedName.textContent = data.name;
        parsedEmail.textContent = data.email;
        parsedPhone.textContent = data.phone;
        
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