export const courseGroups = [
  { label: "Engineering & Technology", courses: ["B.Tech", "B.E.", "M.Tech", "M.E.", "BCA", "MCA", "B.Sc Computer Science", "B.Sc IT", "Diploma Engineering"] },
  { label: "Medical & Healthcare", courses: ["MBBS", "BDS", "BAMS", "BHMS", "B.Pharm", "M.Pharm", "B.Sc Nursing", "GNM", "ANM", "BPT", "BOT", "Medical Laboratory Technology", "Radiology", "Physiotherapy"] },
  { label: "Management & Business", courses: ["BBA", "MBA", "PGDM", "Business Analytics", "Finance", "Marketing", "HR", "Operations", "International Business", "Entrepreneurship"] },
  { label: "Commerce", courses: ["B.Com", "M.Com", "Accounting", "Banking", "Taxation", "Auditing"] },
  { label: "Science", courses: ["B.Sc", "M.Sc", "Physics", "Chemistry", "Mathematics", "Biology", "Biotechnology", "Microbiology", "Environmental Science", "Statistics", "Zoology", "Botany"] },
  { label: "Arts & Humanities", courses: ["BA", "MA", "English", "History", "Political Science", "Psychology", "Sociology", "Economics", "Geography", "Philosophy", "Journalism", "Mass Communication", "Languages"] },
  { label: "Law", courses: ["LLB", "LLM", "Corporate Law", "Criminal Law", "Constitutional Law", "Civil Law", "IPR", "Cyber Law"] },
  { label: "Design & Creative", courses: ["B.Des", "M.Des", "Fashion Design", "Graphic Design", "UI/UX", "Interior Design", "Animation", "Film", "Photography"] },
  { label: "Education", courses: ["B.Ed", "M.Ed", "Teaching", "Special Education", "Educational Administration"] },
  { label: "Hospitality & Tourism", courses: ["Hotel Management", "Travel & Tourism", "Hospitality Management", "Culinary Arts"] },
  { label: "Agriculture", courses: ["B.Sc Agriculture", "M.Sc Agriculture", "Horticulture", "Agricultural Engineering", "Food Technology", "Dairy Technology"] },
  { label: "Vocational & Diploma", courses: ["Diploma courses", "ITI", "Skill-based courses", "Professional certifications"] },
];
export const specializationsByCourse: Record<string, string[]> = {
  "B.Tech": ["Computer Science", "Information Technology", "AI & ML", "Data Science", "Cybersecurity", "Electronics", "Electrical", "Mechanical", "Civil", "Chemical", "Automobile", "Aerospace", "Biomedical", "Robotics", "Mechatronics"],
  "B.E.": ["Computer Science", "Information Technology", "Electrical", "Mechanical", "Civil", "Electronics", "Chemical"],
  "B.Com": ["Accounting & Finance", "Banking", "Taxation", "Auditing", "Business Analytics"],
  "BBA": ["Marketing", "Finance", "Human Resources", "Operations", "Business Analytics", "Entrepreneurship"],
  "MBA": ["Finance", "Marketing", "Human Resources", "Operations", "Business Analytics", "International Business"],
  "B.Sc": ["Physics", "Chemistry", "Mathematics", "Biology", "Biotechnology", "Microbiology", "Environmental Science", "Statistics", "Zoology", "Botany"],
  "BA": ["English", "History", "Political Science", "Psychology", "Sociology", "Economics", "Geography", "Philosophy", "Journalism", "Languages"],
  "LLB": ["Corporate Law", "Criminal Law", "Constitutional Law", "Civil Law", "IPR", "Cyber Law"],
  "B.Des": ["UI/UX", "Fashion Design", "Graphic Design", "Interior Design", "Animation", "Film"],
  "B.Sc Nursing": ["General Nursing", "Community Health", "Critical Care"],
  "B.Pharm": ["Pharmacology", "Pharmaceutics", "Pharmacovigilance", "Quality Assurance"],
  "B.Sc Agriculture": ["Agronomy", "Horticulture", "Agricultural Engineering", "Food Technology", "Dairy Technology"],
};
export const roleOptions = ["Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack Developer", "Data Analyst", "Data Scientist", "Mechanical Design Engineer", "Civil Engineer", "Financial Analyst", "Accountant", "Marketing Executive", "Business Analyst", "Pharmacovigilance Associate", "Medical Representative", "Staff Nurse", "Legal Associate", "Content Writer", "Communication Executive", "Research Assistant", "Lab Technician", "Teacher", "Product Designer", "Agriculture Officer", "Engineering Technician", "Other / custom role"];
export const interviewTypes = ["HR", "Technical", "Domain", "Behavioral", "Situational", "Case Study", "Coding", "Viva", "Communication", "Aptitude", "Mixed"];
export const difficulties = ["Easy", "Medium", "Hard", "Expert"];
export const skillCatalog = ["JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "C++", "SQL", "MongoDB", "AWS", "Docker", "Machine Learning", "Data Structures", "Algorithms", "System Design", "REST APIs", "Software Testing", "Application Security", "Version Control", "Communication", "Problem Solving", "Leadership", "Financial Statements", "Accounting", "GST & Taxation", "Auditing", "Financial Modeling", "Market Research", "Digital Marketing", "Consumer Behavior", "Project Management", "Thermodynamics", "CAD", "Machine Design", "Manufacturing", "Materials Science", "Fluid Mechanics", "Structural Analysis", "Surveying", "Clinical Communication", "Patient Safety", "Pharmacology", "Legal Research", "Case Analysis", "Professional Writing", "Critical Thinking", "Statistics", "Experimental Design", "Curriculum Design", "Lesson Planning", "UI/UX Design", "Prototyping", "Agronomy", "Sustainable Agriculture", "Customer Service", "Food Safety"];
export const readinessLabel = (score: number) => score >= 85 ? "Highly Ready" : score >= 72 ? "Interview Ready" : score >= 55 ? "Improving" : "Needs Preparation";
export function disciplineFor(course: string) {
  const c = course.toLowerCase();
  if (/b\.com|commerce|account|finance|tax|bank/.test(c)) return "commerce";
  if (/mechanical|thermo|cad|manufacturing/.test(c)) return "mechanical";
  if (/marketing|bba|business|mba|management/.test(c)) return "management";
  if (/nurs|medical|pharm|mbbs|bds|health/.test(c)) return "medical";
  if (/law|llb/.test(c)) return "law";
  if (/english|arts|journal|history|psychology/.test(c)) return "arts";
  if (/science|biology|chemistry|physics/.test(c)) return "science";
  if (/design|ui\/ux|graphic/.test(c)) return "design";
  if (/educat|teach|b\.ed/.test(c)) return "education";
  if (/agri|horticultur/.test(c)) return "agriculture";
  return "engineering";
}
