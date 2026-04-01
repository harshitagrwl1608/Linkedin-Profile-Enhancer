/**
 * roleProfiles.js
 * Predefined keyword sets and ideal profile templates per role.
 * Used by analysis, benchmark, and recruiter services.
 */

const ROLES = {
  'backend-developer': {
    displayName: 'Backend Developer',
    requiredKeywords: [
      'node.js', 'express', 'rest api', 'sql', 'database', 'mongodb', 'postgresql',
      'authentication', 'jwt', 'git', 'docker', 'api design', 'microservices',
      'server', 'backend', 'http', 'json'
    ],
    niceToHaveKeywords: [
      'redis', 'kafka', 'rabbitmq', 'graphql', 'kubernetes', 'aws', 'azure',
      'ci/cd', 'unit testing', 'jest', 'mocha', 'grpc', 'websockets', 'nginx',
      'linux', 'bash', 'typescript', 'golang', 'python', 'spring boot'
    ],
    recruiterSearchTerms: [
      'Node.js', 'Express', 'REST API', 'backend developer', 'microservices'
    ],
    idealProfile: {
      skills: ['Node.js', 'Express.js', 'PostgreSQL', 'MongoDB', 'REST APIs', 'Docker', 'AWS', 'Redis', 'JWT'],
      experienceYears: 3,
      projectCount: 3,
      certifications: ['AWS Certified Developer', 'MongoDB University'],
      education: "Bachelor's in CS or equivalent"
    }
  },

  'frontend-developer': {
    displayName: 'Frontend Developer',
    requiredKeywords: [
      'react', 'javascript', 'html', 'css', 'responsive design', 'git',
      'ui', 'component', 'webpack', 'rest api', 'dom', 'typescript'
    ],
    niceToHaveKeywords: [
      'next.js', 'vue', 'angular', 'redux', 'tailwind', 'sass', 'figma',
      'accessibility', 'performance', 'seo', 'jest', 'testing library',
      'storybook', 'graphql', 'pwa', 'web vitals'
    ],
    recruiterSearchTerms: ['React', 'JavaScript', 'frontend developer', 'Next.js', 'TypeScript'],
    idealProfile: {
      skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Redux', 'Jest', 'Figma'],
      experienceYears: 2,
      projectCount: 4,
      certifications: ['Meta Front-End Developer Certificate'],
      education: "Bachelor's in CS or equivalent"
    }
  },

  'fullstack-developer': {
    displayName: 'Full Stack Developer',
    requiredKeywords: [
      'react', 'node.js', 'rest api', 'sql', 'mongodb', 'javascript',
      'git', 'html', 'css', 'database', 'authentication', 'deployment'
    ],
    niceToHaveKeywords: [
      'typescript', 'next.js', 'docker', 'aws', 'graphql', 'redis',
      'ci/cd', 'testing', 'microservices', 'kubernetes', 'tailwind'
    ],
    recruiterSearchTerms: ['full stack developer', 'React', 'Node.js', 'MERN', 'MEAN'],
    idealProfile: {
      skills: ['React', 'Node.js', 'MongoDB', 'PostgreSQL', 'TypeScript', 'Docker', 'AWS'],
      experienceYears: 3,
      projectCount: 4,
      certifications: [],
      education: "Bachelor's in CS or equivalent"
    }
  },

  'sde-intern': {
    displayName: 'SDE Intern',
    requiredKeywords: [
      'data structures', 'algorithms', 'git', 'c++', 'java', 'python',
      'problem solving', 'object-oriented', 'leetcode', 'competitive programming'
    ],
    niceToHaveKeywords: [
      'react', 'node.js', 'sql', 'machine learning', 'open source',
      'hackathon', 'internship', 'project', 'github', 'api', 'rest'
    ],
    recruiterSearchTerms: ['SDE intern', 'software engineering intern', 'computer science', 'DSA'],
    idealProfile: {
      skills: ['Data Structures', 'Algorithms', 'C++/Java/Python', 'Git', 'SQL'],
      experienceYears: 0,
      projectCount: 2,
      certifications: [],
      education: "Pursuing B.Tech / B.E. in CS"
    }
  },

  'data-scientist': {
    displayName: 'Data Scientist',
    requiredKeywords: [
      'python', 'machine learning', 'pandas', 'numpy', 'scikit-learn',
      'statistics', 'data analysis', 'model', 'sql', 'visualization',
      'feature engineering', 'regression', 'classification'
    ],
    niceToHaveKeywords: [
      'tensorflow', 'pytorch', 'deep learning', 'nlp', 'computer vision',
      'spark', 'hadoop', 'a/b testing', 'hypothesis testing', 'tableau',
      'power bi', 'mlops', 'aws sagemaker', 'xgboost', 'neural network'
    ],
    recruiterSearchTerms: ['data scientist', 'machine learning', 'Python', 'scikit-learn', 'NLP'],
    idealProfile: {
      skills: ['Python', 'TensorFlow', 'PyTorch', 'SQL', 'Statistics', 'NLP', 'MLOps'],
      experienceYears: 2,
      projectCount: 3,
      certifications: ['Google ML Certification', 'Coursera Deep Learning Specialization'],
      education: "Master's in CS, Statistics, or Data Science"
    }
  },

  'devops-engineer': {
    displayName: 'DevOps Engineer',
    requiredKeywords: [
      'docker', 'kubernetes', 'ci/cd', 'jenkins', 'linux', 'bash',
      'aws', 'terraform', 'ansible', 'monitoring', 'git', 'pipelines'
    ],
    niceToHaveKeywords: [
      'prometheus', 'grafana', 'helm', 'gitlab', 'github actions',
      'azure devops', 'gcp', 'nginx', 'load balancing', 'elk stack',
      'argocd', 'vault', 'security', 'chaos engineering'
    ],
    recruiterSearchTerms: ['DevOps engineer', 'Kubernetes', 'Docker', 'CI/CD', 'Terraform'],
    idealProfile: {
      skills: ['Kubernetes', 'Docker', 'Terraform', 'AWS', 'Ansible', 'Prometheus', 'Jenkins'],
      experienceYears: 3,
      projectCount: 2,
      certifications: ['AWS DevOps Professional', 'CKA — Certified Kubernetes Administrator'],
      education: "Bachelor's in CS or IT"
    }
  },

  'product-manager': {
    displayName: 'Product Manager',
    requiredKeywords: [
      'product roadmap', 'user research', 'agile', 'scrum', 'stakeholder',
      'metrics', 'kpi', 'a/b testing', 'product strategy', 'user stories',
      'wireframe', 'jira', 'backlog', 'go-to-market'
    ],
    niceToHaveKeywords: [
      'sql', 'figma', 'okrs', 'customer interviews', 'competitive analysis',
      'retention', 'funnel', 'nps', 'pricing strategy', 'growth hacking',
      'b2b', 'b2c', 'saas', 'api knowledge'
    ],
    recruiterSearchTerms: ['product manager', 'agile', 'roadmap', 'stakeholder management', 'SaaS PM'],
    idealProfile: {
      skills: ['Product Strategy', 'Agile', 'SQL', 'Figma', 'A/B Testing', 'Jira', 'OKRs'],
      experienceYears: 4,
      projectCount: 3,
      certifications: ['Pragmatic Marketing', 'CSPO'],
      education: "MBA or B.Tech + product experience"
    }
  }
};

// Master skills list for extraction
const MASTER_SKILLS = [
  // Languages
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'golang', 'rust',
  'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'bash',
  // Frontend
  'react', 'next.js', 'vue', 'angular', 'html', 'css', 'tailwind', 'sass',
  'redux', 'webpack', 'vite', 'svelte', 'jquery',
  // Backend
  'node.js', 'express', 'django', 'flask', 'spring boot', 'fastapi',
  'graphql', 'rest api', 'grpc', 'websockets',
  // Databases
  'mongodb', 'postgresql', 'mysql', 'sqlite', 'redis', 'elasticsearch',
  'cassandra', 'dynamodb', 'firebase',
  // Cloud & DevOps
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'ansible',
  'jenkins', 'github actions', 'ci/cd', 'nginx', 'linux',
  // Data / ML
  'pandas', 'numpy', 'scikit-learn', 'tensorflow', 'pytorch', 'keras',
  'machine learning', 'deep learning', 'nlp', 'computer vision', 'mlops',
  'tableau', 'power bi', 'spark', 'hadoop',
  // Tools
  'git', 'jira', 'figma', 'postman', 'vs code', 'webpack', 'babel',
  // Concepts
  'data structures', 'algorithms', 'microservices', 'rest', 'agile', 'scrum',
  'tdd', 'unit testing', 'api design', 'oop', 'system design', 'oauth',
  'jwt', 'authentication', 'ci/cd', 'devops', 'cloud computing'
];

// Normalize a role slug
function normalizeRole(input) {
  if (!input) return 'fullstack-developer';
  const slug = input.toLowerCase().trim().replace(/\s+/g, '-');
  if (ROLES[slug]) return slug;
  // fuzzy match
  for (const key of Object.keys(ROLES)) {
    if (slug.includes(key) || key.includes(slug.split('-')[0])) return key;
  }
  return 'fullstack-developer';
}

module.exports = { ROLES, MASTER_SKILLS, normalizeRole };
