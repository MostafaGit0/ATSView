from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import re
import pdfplumber
import docx
import tempfile
import spacy
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except:
    # If model not available, download it
    import subprocess
    subprocess.call(['python', '-m', 'spacy', 'download', 'en_core_web_sm'])
    nlp = spacy.load("en_core_web_sm")

# Define allowed file extensions
ALLOWED_EXTENSIONS = {'pdf', 'docx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file."""
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
    return text

def extract_text_from_docx(docx_path):
    """Extract text from a DOCX file."""
    text = ""
    try:
        doc = docx.Document(docx_path)
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
    except Exception as e:
        print(f"Error extracting text from DOCX: {e}")
    return text

def extract_name(text):
    """Extract name using spaCy's named entity recognition."""
    doc = nlp(text[:1000])  # Process only the first 1000 chars for efficiency
    
    # Look for PERSON entities
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            return ent.text
    
    # Fallback: Look for lines that might be names near the top
    lines = text.split('\n')
    for line in lines[:5]:  # Check first 5 lines
        # Avoid lines that look like addresses, emails, etc.
        if len(line.strip()) > 0 and len(line.strip()) < 40 and "@" not in line and "http" not in line:
            # Look for a name pattern (First Last)
            name_match = re.search(r"^[A-Z][a-z]+ [A-Z][a-z]+$", line.strip())
            if name_match:
                return line.strip()
    
    return None

def extract_email(text):
    """Extract email using regex."""
    email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
    match = re.search(email_pattern, text)
    return match.group(0) if match else None

def extract_phone(text):
    """Extract phone number using regex."""
    # Match various phone formats
    patterns = [
        r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",  # (123) 456-7890 or 123-456-7890
        r"\+\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",  # +1 (123) 456-7890
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    
    return None

def extract_skills(text):
    """Extract skills from text."""
    # Common skill keywords
    common_skills = [
        # Programming Languages
        "Python", "Java", "JavaScript", "C\\+\\+", "C#", "Ruby", "PHP", "Swift", "Kotlin", "Go", "Rust",
        # Web Technologies
        "HTML", "CSS", "React", "Angular", "Vue", "Node.js", "Express", "Django", "Flask", "Spring Boot",
        # Databases
        "SQL", "MySQL", "PostgreSQL", "MongoDB", "Oracle", "DynamoDB", "Firebase",
        # Cloud Platforms
        "AWS", "Azure", "Google Cloud", "Heroku", "Netlify", "Vercel",
        # DevOps & Tools
        "Docker", "Kubernetes", "Jenkins", "Git", "GitHub", "GitLab", "CI/CD", "Terraform",
        # Data Science & AI
        "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "pandas", "NumPy", "Data Analysis",
        "NLP", "Computer Vision", "AI",
        # Mobile
        "Android", "iOS", "React Native", "Flutter", "Xamarin",
        # Soft Skills
        "Project Management", "Team Leadership", "Communication", "Problem Solving", "Agile", "Scrum"
    ]
    
    pattern = r"\b(" + "|".join(common_skills) + r")\b"
    skills_found = re.findall(pattern, text, re.IGNORECASE)
    
    # Remove duplicates and preserve case
    unique_skills = []
    for skill in skills_found:
        if skill.lower() not in [s.lower() for s in unique_skills]:
            # Find the best case version in the text
            for match in re.finditer(re.escape(skill), text, re.IGNORECASE):
                skill_with_case = match.group(0)
                break
            unique_skills.append(skill_with_case)
    
    return unique_skills

def extract_education(text):
    """Extract education information."""
    # Look for education section
    education_patterns = [
        r"(?i)EDUCATION.*?(?=EXPERIENCE|SKILLS|PROJECTS|\n\n\n)",
        r"(?i)ACADEMIC.*?(?=EXPERIENCE|SKILLS|PROJECTS|\n\n\n)",
        r"(?i)QUALIFICATION.*?(?=EXPERIENCE|SKILLS|PROJECTS|\n\n\n)"
    ]
    
    for pattern in education_patterns:
        match = re.search(pattern, text, re.DOTALL)
        if match:
            return match.group(0).strip()
    
    # If no section found, try to find degree mentions
    degree_pattern = r"(?i)(Bachelor|Master|PhD|B\.S\.|M\.S\.|B\.A\.|M\.A\.|B\.Tech|M\.Tech|MBA).*?(?=\n\n)"
    match = re.search(degree_pattern, text, re.DOTALL)
    if match:
        return match.group(0).strip()
    
    return None

def extract_experience(text):
    """Extract work experience information."""
    # Look for experience section
    experience_patterns = [
        r"(?i)(EXPERIENCE|EMPLOYMENT|WORK HISTORY).*?(?=EDUCATION|SKILLS|PROJECTS|\n\n\n|$)",
        r"(?i)(PROFESSIONAL BACKGROUND).*?(?=EDUCATION|SKILLS|PROJECTS|\n\n\n|$)"
    ]
    
    for pattern in experience_patterns:
        match = re.search(pattern, text, re.DOTALL)
        if match:
            return match.group(0).strip()
    
    return None

def calculate_ats_score(parsed_data, text):
    """Calculate ATS friendliness score."""
    score = 70  # Base score
    suggestions = []
    
    # Check for key sections presence
    if not parsed_data.get("name"):
        score -= 5
        suggestions.append("Include your full name prominently at the top of your resume")
    
    if not parsed_data.get("email"):
        score -= 5
        suggestions.append("Add a professional email address")
    
    if not parsed_data.get("phone"):
        score -= 3
        suggestions.append("Include a phone number for contact")
    
    # Check skills
    skills_count = len(parsed_data.get("skills", []))
    if skills_count == 0:
        score -= 10
        suggestions.append("Add a dedicated skills section with relevant keywords")
    elif skills_count < 5:
        score -= 5
        suggestions.append("Consider adding more relevant skills to improve keyword matching")
    else:
        score += 5
    
    # Check education
    if not parsed_data.get("education"):
        score -= 5
        suggestions.append("Include your educational background")
    
    # Check experience
    if not parsed_data.get("experience"):
        score -= 10
        suggestions.append("Add your work experience with clear job titles and dates")
    
    # Check for common formatting issues
    if re.search(r"[│┃┆┇┊┋╎╏┆┇┊┋]", text):  # Vertical bars often indicate tables
        score -= 5
        suggestions.append("Avoid using tables or columns as they may confuse ATS systems")
    
    # Check for section headers
    if not re.search(r"(?i)(EXPERIENCE|EMPLOYMENT|WORK HISTORY)", text):
        score -= 3
        suggestions.append("Use clear section headers like 'Experience', 'Education', and 'Skills'")
    
    # Check for date formats
    date_formats = len(re.findall(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w* \d{4}\b", text))
    if date_formats < 2:
        suggestions.append("Use a consistent date format (Month YYYY) for work and education entries")
    
    # Check length
    if len(text.split()) < 200:
        score -= 5
        suggestions.append("Your resume may be too short - consider adding more details")
    elif len(text.split()) > 1000:
        score -= 3
        suggestions.append("Your resume is quite lengthy - consider focusing on the most relevant information")
    
    # Summary/Objective section check
    if not re.search(r"(?i)(SUMMARY|OBJECTIVE|PROFILE)", text):
        suggestions.append("Consider adding a summary section highlighting your key qualifications")
    
    # Cap the score
    score = max(min(score, 100), 0)
    
    return score, suggestions

@app.route('/upload', methods=['POST'])
def upload_file():
    # Check if the post request has the file part
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    
    # If user does not select file, browser also
    # submit an empty part without filename
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        
        # Create a temporary file
        fd, temp_path = tempfile.mkstemp(suffix=os.path.splitext(filename)[1])
        
        try:
            os.close(fd)
            file.save(temp_path)
            
            # Extract text based on file type
            if filename.lower().endswith('.pdf'):
                text = extract_text_from_pdf(temp_path)
            elif filename.lower().endswith('.docx'):
                text = extract_text_from_docx(temp_path)
            else:
                return jsonify({'error': 'Unsupported file type'}), 400
            
            if not text:
                return jsonify({'error': 'Could not extract text from file'}), 400
            
            # Parse the text
            parsed_data = {
                "name": extract_name(text),
                "email": extract_email(text),
                "phone": extract_phone(text),
                "skills": extract_skills(text),
                "education": extract_education(text),
                "experience": extract_experience(text)
            }
            
            # Calculate ATS friendliness score
            score, suggestions = calculate_ats_score(parsed_data, text)
            parsed_data["score"] = score
            parsed_data["suggestions"] = suggestions
            
            return jsonify(parsed_data)
            
        finally:
            # Remove the temporary file
            try:
                os.unlink(temp_path)
            except:
                pass
    
    return jsonify({'error': 'Invalid file type'}), 400

if __name__ == '__main__':
    # For production deployment on Render
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
