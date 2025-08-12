// Landing Page Constants
export const LANDING_PAGE_CONSTANTS = {
  // Navigation
  NAVIGATION: {
    LOGO_TEXT: 'Kshitij Bhatnagar',
    MENU_ITEMS: [
      { href: '#home', label: 'Home' },
      { href: '#skills', label: 'Skills' },
      { href: '#projects', label: 'Projects' },
      { href: '#journey', label: 'Journey' },
    ],
    MOBILE_MENU_ARIA_LABEL: 'Toggle mobile menu',
  },

  // Hero Section
  HERO: {
    TITLE: 'I build systems that reveal patterns.',
    SUBTITLE:
      'Whether in our daily lives or in complex data, I create tools that transform information into insights and habits into sustainable growth.',
    CTA_TEXT: 'Explore My Work',
    CTA_HREF: '#projects',
    SECONDARY_CTA: {
      TEXT: 'View Resume',
      HREF: '/resume', // Link to resume PDF or page
    },
    PROFILE_IMAGE: {
      SRC: '/images/Profile.JPG',
      ALT: 'Kshitij Bhatnagar - Software Engineer'
    }
  },

  // Skills Section
  SKILLS: {
    SECTION_TITLE: 'Technical Expertise',
    SECTION_SUBTITLE: 'Building modern solutions with proven technologies',
    
    CATEGORIES: [
      {
        TITLE: 'Frontend Expert',
        ICON: '⚛️',
        DESCRIPTION: 'Crafting intuitive, performant user experiences',
        TECHNOLOGIES: [
          'React & TypeScript',
          'SCSS & CSS3',
          'Chart.js & D3.js',
          'Material-UI',
          'Component Libraries',
          'Responsive Design'
        ],
        HIGHLIGHT: 'Modern UI/UX patterns'
      },
      {
        TITLE: 'Backend Architect', 
        ICON: '🔧',
        DESCRIPTION: 'Building scalable, secure server solutions',
        TECHNOLOGIES: [
          'Node.js & Express',
          'Firebase & GCP',
          'RESTful APIs',
          'Authentication (OKTA)',
          'Database Design',
          'Cloud Functions'
        ],
        HIGHLIGHT: 'Enterprise-grade solutions'
      },
      {
        TITLE: 'DevOps & Tools',
        ICON: '🚀', 
        DESCRIPTION: 'Streamlining development and deployment',
        TECHNOLOGIES: [
          'Jest & Testing Library',
          'Webpack & Vite',
          'CI/CD (Jenkins, GitHub)',
          'Docker & Cloud',
          'Performance Optimization',
          'Code Quality Tools'
        ],
        HIGHLIGHT: 'Quality-driven development'
      }
    ],

    ACHIEVEMENTS: [
      {
        ICON: '🏆',
        TITLE: '3× Spot Awards',
        SUBTITLE: 'HashedIn by Deloitte',
        DESCRIPTION: 'Exceptional collaboration and impact',
        IMAGES: [
          '/images/Linkedin/Work/Spot-Award-02-08-23.jpeg',
          '/images/Linkedin/Work/Spot-Award-11-09-23.jpeg',
          '/images/Linkedin/Work/Spot-Award-04-09-24.jpeg'
        ]
      },
      {
        ICON: '🌟',
        TITLE: 'Excellence Award',
        SUBTITLE: 'HashedIn by Deloitte', 
        DESCRIPTION: 'Leadership and technical excellence',
        IMAGES: ['/images/Linkedin/Work/Excellence-Award-12-06-22.jpeg']
      },
      {
        ICON: '📜',
        TITLE: 'Lean Six Sigma Green Belt',
        SUBTITLE: 'Process Optimization',
        DESCRIPTION: 'PSLSSGB67545 certification',
        IMAGES: [
          '/images/Linkedin/Certifications/LeanSixSigma-GreenBeltCertificate.jpeg',
          '/images/Linkedin/Certifications/LeanSixSigma-LetterOfAknowledgment.jpeg'
        ]
      },
      {
        ICON: '🧠',
        TITLE: 'Neural Networks & Deep Learning',
        SUBTITLE: 'DeepLearning.AI',
        DESCRIPTION: 'Advanced AI/ML knowledge',
        IMAGES: ['/images/Linkedin/Certifications/Neural-Networks-and-Deep-learning-Certificate.jpeg']
      },
      {
        ICON: '📋',
        TITLE: 'Loyalty Certificate',
        SUBTITLE: 'HashedIn by Deloitte',
        DESCRIPTION: 'Consistent dedication and commitment',
        IMAGES: ['/images/Linkedin/Work/LoyaltyCertificate.jpeg']
      }
    ]
  },

  // Projects Section
  PROJECTS: {
    SECTION_TITLE: 'Featured Projects',
    SECTION_SUBTITLE:
      'Tools that combine technical excellence with real-world impact',

    HABIT_TRACKER: {
      TITLE: 'The System for Self-Improvement',
      TECH_TAGS: ['React', 'TypeScript', 'Chart.js'],
      DESCRIPTION: {
        PARAGRAPH_1:
          "Building better habits isn't just about motivation—it's about having the right data. This comprehensive habit tracker transforms your daily routines into actionable insights through advanced analytics, streak tracking, and beautiful visualizations.",
        PARAGRAPH_2:
          'Built with React Context for state management, Chart.js for data visualization, and dnd-kit for intuitive drag-and-drop interactions. Every chart tells a story of progress, every streak represents commitment.',
      },
      ACTIONS: {
        PRIMARY: {
          TEXT: 'Visit Habit Tracker',
          HREF: 'https://habittracker.in',
        },
        SECONDARY: {
          TEXT: 'Source Code',
          HREF: 'https://github.com/kbhatnagar97/Habit-Tracker',
        },
      },
      IMAGE: {
        SRC: '/images/habit-tracker.gif',
        ALT: 'Habit Tracker Demo',
      },
    },

    GAUSSIAN_VISUALIZER: {
      TITLE: 'The System for Understanding Data',
      TECH_TAGS: ['React', 'TypeScript', 'Chart.js'],
      DESCRIPTION: {
        PARAGRAPH_1:
          'Statistics come alive when you can see them change in real-time. This interactive Gaussian distribution visualizer makes complex statistical concepts accessible through intuitive controls and instant visual feedback.',
        PARAGRAPH_2:
          "Built with cutting-edge technology that Chart.js doesn't readily provide, using lightweight statistical libraries running mathematical computations under the hood to make this level of real-time visualization possible. Watch as process capability metrics update instantly, revealing the story hidden in your data.",
      },
      ACTIONS: {
        PRIMARY: {
          TEXT: 'Interactive Demo',
          HREF: '/gaussian-visualizer',
        },
        SECONDARY: {
          TEXT: 'Source Code',
          HREF: 'https://github.com/kbhatnagar97/Portfolio',
        },
      },
      IMAGE: {
        SRC: '/images/gaussian-tracker.gif',
        ALT: 'Gaussian Visualizer Demo',
      },
    },
  },

  // Journey Section
  JOURNEY: {
    SECTION_TITLE: 'My Professional Journey',
    SECTION_SUBTITLE: 'A story of continuous learning, growth, and meaningful impact',

    EDUCATION: {
      TITLE: 'Education Foundation',
      INSTITUTIONS: [
        {
          DEGREE: 'B.Tech Electronics & Communication',
          MINOR: 'Computer Science Engineering',
          INSTITUTION: 'VIT University',
          DURATION: '2016-2020',
          CGPA: '8.8',
          ICON: '🎓',
          CERTIFICATES: [
            '/images/Linkedin/VIT/VIT-Degree.jpeg',
            '/images/Linkedin/VIT/VIT-Transfer-Certificate.jpeg',
            '/images/Linkedin/VIT/Teaching-Assistant-Certificate.png',
            '/images/Linkedin/VIT/SPIE-Membership-Certificate.jpeg'
          ]
        },
        {
          DEGREE: 'Higher Secondary, Science',
          INSTITUTION: 'The Shri Ram School', 
          DURATION: '2002-2016',
          ICON: '🏫',
          CERTIFICATES: [
            '/images/Linkedin/School/ShrRam-Transfer-Certificate.jpeg',
            '/images/Linkedin/School/ShriRam-Character-Certificate.jpeg'
          ]
        }
      ],

      LEADERSHIP_ACTIVITIES: [
        'Under Secretary General - Internal Affairs (VITCMUN)',
        'SPIE Treasurer (Optics & Photonics Society)',
        'OWASP Technical Adviser (Cybersecurity)',
        'Head of Marketing (TechnoVIT & Vibrance)',
        'VITeach Student Mentor (Social Impact)',
        'Teaching Assistant - Circuit Theory',
        'Sociothon Organizer (Engineering Solutions)'
      ],

      COLLEGE_PROJECTS: [
        {
          TITLE: 'Mobile Phone System',
          YEAR: '2019',
          CATEGORY: 'IoT & Communication',
          TECH: ['Raspberry Pi', 'GSM Module', 'Python'],
          DESCRIPTION: 'Complete mobile communication system with call management and SMS functionality',
          FEATURES: [
            'Voice call processing',
            'SMS send/receive capability', 
            'Contact management',
            'Network signal optimization'
          ],
          ICON: '📱',
          COMPLEXITY: 'Advanced',
          TEAM_SIZE: '3 members'
        },
        {
          TITLE: 'Digital Lock System', 
          YEAR: '2018',
          CATEGORY: 'Embedded Security',
          TECH: ['8051 Microcontroller', 'EEPROM', 'Keypad Interface'],
          DESCRIPTION: 'Secure password-based access control system with reset functionality',
          FEATURES: [
            'Password authentication',
            'Emergency override',
            'Attempt tracking',
            'Auto-lock mechanism'
          ],
          ICON: '🔐',
          COMPLEXITY: 'Intermediate',
          TEAM_SIZE: '2 members'
        },
        {
          TITLE: 'Universal Remote Control',
          YEAR: '2017', 
          CATEGORY: 'Home Automation',
          TECH: ['IR Transmitter', 'AC Mains Control', 'Signal Processing'],
          DESCRIPTION: 'Centralized control system for multiple home appliances',
          FEATURES: [
            'Multi-device compatibility',
            'Learning IR codes',
            'AC mains switching',
            'Safety interlocks'
          ],
          ICON: '📺',
          COMPLEXITY: 'Intermediate',
          TEAM_SIZE: '4 members'
        },
        {
          TITLE: 'Smart Home Security',
          YEAR: '2016-17',
          CATEGORY: 'IoT Security',
          TECH: ['PIR Sensor', 'Thermistor', 'Alert System'],
          DESCRIPTION: 'Intelligent monitoring system with motion detection and environmental alerts',
          FEATURES: [
            'Motion detection',
            'Temperature monitoring',
            'Real-time alerts',
            'Zone-based security'
          ],
          ICON: '🏠',
          COMPLEXITY: 'Beginner',
          TEAM_SIZE: '2 members'
        }
      ]
    },

    PROFESSIONAL: {
      TITLE: 'Professional Evolution',
      ROLES: [
        {
          POSITION: 'Software Engineer II',
          COMPANY: 'HashedIn by Deloitte',
          DURATION: '2022 - Present',
          TYPE: 'Technical Leadership & Innovation',
          ICON: '🚀',
          ACHIEVEMENTS: [
            'Leading React.js development for enterprise applications',
            '40% improved data visualization accuracy',
            'Built reusable component library (-40% dev time)',
            'Architected Microfrontend POC migration',
            'Mentoring 5+ junior engineers'
          ]
        },
        {
          POSITION: 'Software Engineer I',
          COMPANY: 'HashedIn by Deloitte', 
          DURATION: '2020 - 2022',
          TYPE: 'Foundation Building & Core Development',
          ICON: '🛠️',
          ACHIEVEMENTS: [
            'Multi-factor authentication (OKTA) implementation',
            'Secure PDF export & text editors (DraftJS)',
            '85%+ unit test coverage maintenance',
            '30-40% page load performance boost'
          ]
        },
        {
          POSITION: 'Intern',
          COMPANY: 'HashedIn by Deloitte',
          DURATION: 'Feb 2020 - Oct 2020', 
          TYPE: 'Rapid Skill Acquisition',
          ICON: '🎯',
          ACHIEVEMENTS: [
            'HTML/CSS → ReactJS transition',
            'Mastered React lifecycle, Redux, Context API',
            'Built responsive PWAs'
          ]
        }
      ],

      EARLY_EXPERIENCE: [
        {
          COMPANY: 'Ericsson India',
          ROLE: 'Summer Intern',
          DURATION: 'May 2019 - Jun 2019',
          FOCUS: '5G wireless research'
        },
        {
          COMPANY: 'Government of India',
          ROLE: 'Summer Intern', 
          DURATION: 'May 2018 - Jul 2018',
          FOCUS: 'Power plant efficiency studies',
          CERTIFICATE: '/images/Linkedin/Work/GOV-Summer-Intern-Certificate.jpeg'
        }
      ]
    }
  },

  // Projects Section Enhancement
  FEATURED_PROJECTS: {
    SECTION_TITLE: 'Featured Work',
    SECTION_SUBTITLE: 'Showcasing innovation through code',
    
    PROJECTS: [
      {
        ID: 'gaussian-visualizer',
        TITLE: 'Gaussian Distribution Visualizer',
        SUBTITLE: 'Interactive Statistical Learning',
        DESCRIPTION: 'Real-time Gaussian distribution visualization with dynamic parameter control, built with React and D3.js for enhanced statistical understanding.',
        TECH_STACK: ['React', 'TypeScript', 'D3.js', 'SCSS', 'Vite'],
        FEATURES: [
          'Real-time parameter adjustment',
          'Interactive probability calculations',
          'Responsive data visualization',
          'Educational tooltips'
        ],
        DEMO_URL: '/gaussian-visualizer',
        GITHUB_URL: '#',
        STATUS: 'LIVE',
        IMPACT: '40% improved data visualization accuracy',
        ICON: '📊'
      },
      {
        ID: 'habit-tracker',
        TITLE: 'Smart Habit Tracker',
        SUBTITLE: 'Behavioral Analytics Platform',
        DESCRIPTION: 'Progressive habit tracking with data analytics, streak visualization, and personalized insights to drive behavioral change.',
        TECH_STACK: ['React', 'Chart.js', 'LocalStorage', 'PWA'],
        FEATURES: [
          'Streak tracking & analytics',
          'Progress visualization',
          'Goal setting & reminders',
          'Offline functionality'
        ],
        DEMO_URL: '/habit-tracker',
        GITHUB_URL: '#',
        STATUS: 'DEVELOPMENT',
        IMPACT: 'Enhanced user engagement patterns',
        ICON: '📈'
      }
    ]
  },

  // Contact Section
  CONTACT: {
    SECTION_TITLE: 'Let\'s Connect',
    SECTION_SUBTITLE: 'Ready to collaborate and build something amazing',
    
    METHODS: [
      {
        TYPE: 'Email',
        VALUE: 'kshitijbhatnagar97@gmail.com',
        ICON: '📧',
        PRIMARY: false,
        HREF: 'mailto:kshitijbhatnagar97@gmail.com'
      },
      {
        TYPE: 'LinkedIn',
        VALUE: 'linkedin.com/in/kshitij-bhatnagar-18046374/',
        ICON: '💼',
        PRIMARY: false,
        HREF: 'https://www.linkedin.com/in/kshitij-bhatnagar-18046374/'
      },
      {
        TYPE: 'GitHub',
        VALUE: 'kbhatnagar97',
        ICON: '🔗',
        PRIMARY: false,
        HREF: 'https://github.com/kbhatnagar97'
      },
      {
        TYPE: 'Stack Overflow',
        VALUE: 'stackoverflow.com/users/20596775/kshitij-bhatnagar',
        ICON: '💻',
        PRIMARY: false,
        HREF: 'https://stackoverflow.com/users/20596775/kshitij-bhatnagar'
      },
      {
        TYPE: 'Instagram',
        VALUE: '@kbhatnagar97',
        ICON: '📸',
        PRIMARY: false,
        HREF: 'https://www.instagram.com/kbhatnagar97'
      },
      {
        TYPE: 'DEV',
        VALUE: '@kbhatnagar',
        ICON: '✍️',
        PRIMARY: false,
        HREF: 'https://dev.to/kbhatnagar'
      }
    ]
  },

  // Animation and Interaction Settings
  ANIMATION: {
    SCROLL_OBSERVER: {
      THRESHOLD: 0.15,
      ROOT_MARGIN: '0px 0px -100px 0px',
    },
    SCROLL_BEHAVIOR: {
      BEHAVIOR: 'smooth' as ScrollBehavior,
      BLOCK: 'start' as ScrollLogicalPosition,
    },
  },

  // CSS Classes
  CSS_CLASSES: {
    SCROLL_ANIMATE: '.scroll-animate',
    NAV_LINKS: '.landing-header__nav-link, .landing-header__mobile-nav-link',
    HEADER: '.landing-header',
    ANIMATE_IN: 'animate-in',
    ANIMATE_OUT: 'animate-out',
  },
} as const;

// Type definitions for better type safety
export type NavigationItem = {
  href: string;
  label: string;
};

export type ProjectAction = {
  TEXT: string;
  HREF: string;
};

export type SocialLink = {
  href: string;
  ariaLabel: string;
  icon: string;
};
