import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaGithub, FaArrowRight, FaBars, FaTimes } from 'react-icons/fa';
import { LANDING_PAGE_CONSTANTS } from './constants';
import { FileViewerModal } from '../../common/components';
import './LandingPage.scss';

const LandingPage: React.FC = () => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    src: string;
    title: string;
    subtitle: string;
  } | null>(null);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleViewFile = (src: string, title: string, subtitle: string) => {
    setModalData({ src, title, subtitle });
  };

  const handleCloseModal = () => {
    setModalData(null);
  };

  useEffect(() => {
    document.documentElement.style.scrollBehavior =
      LANDING_PAGE_CONSTANTS.ANIMATION.SCROLL_BEHAVIOR.BEHAVIOR;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isPersistent =
            entry.target.classList.contains('persist-on-scroll');

          if (entry.isIntersecting) {
            entry.target.classList.add(
              LANDING_PAGE_CONSTANTS.CSS_CLASSES.ANIMATE_IN
            );
            entry.target.classList.remove(
              LANDING_PAGE_CONSTANTS.CSS_CLASSES.ANIMATE_OUT
            );
          } else if (!isPersistent) {
            // Only reverse animation for non-persistent elements
            entry.target.classList.remove(
              LANDING_PAGE_CONSTANTS.CSS_CLASSES.ANIMATE_IN
            );
            entry.target.classList.add(
              LANDING_PAGE_CONSTANTS.CSS_CLASSES.ANIMATE_OUT
            );
          }
          // Persistent elements keep their animate-in state even when out of view
        });
      },
      {
        threshold: LANDING_PAGE_CONSTANTS.ANIMATION.SCROLL_OBSERVER.THRESHOLD,
        rootMargin:
          LANDING_PAGE_CONSTANTS.ANIMATION.SCROLL_OBSERVER.ROOT_MARGIN,
      }
    );

    const animatedElements = document.querySelectorAll(
      LANDING_PAGE_CONSTANTS.CSS_CLASSES.SCROLL_ANIMATE
    );
    animatedElements.forEach((el) => {
      observerRef.current?.observe(el);
    });

    // Smooth scroll for navigation links
    const handleNavClick = (e: Event) => {
      const target = e.target as HTMLAnchorElement;
      if (target.hash) {
        e.preventDefault();
        const targetElement = document.querySelector(target.hash);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: LANDING_PAGE_CONSTANTS.ANIMATION.SCROLL_BEHAVIOR.BEHAVIOR,
            block: LANDING_PAGE_CONSTANTS.ANIMATION.SCROLL_BEHAVIOR.BLOCK,
          });
        }
      }
    };

    const navLinks = document.querySelectorAll(
      LANDING_PAGE_CONSTANTS.CSS_CLASSES.NAV_LINKS
    );
    navLinks.forEach((link) => {
      link.addEventListener('click', handleNavClick);
    });

    // Close mobile menu when clicking outside
    const handleOutsideClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const header = document.querySelector(
        LANDING_PAGE_CONSTANTS.CSS_CLASSES.HEADER
      );
      if (header && !header.contains(target)) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);

    return () => {
      observerRef.current?.disconnect();
      navLinks.forEach((link) => {
        link.removeEventListener('click', handleNavClick);
      });
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  return (
    <div className='landing-page'>
      <div className='background-animations'>
        <div className='shape shape-1'></div>
        <div className='shape shape-2'></div>
        <div className='shape shape-3'></div>
      </div>

      {/* Header */}
      <header className='landing-header'>
        <div className='landing-header__content'>
          <div className='landing-header__logo'>
            {LANDING_PAGE_CONSTANTS.NAVIGATION.LOGO_TEXT}
          </div>

          {/* Desktop Navigation */}
          <nav className='landing-header__nav'>
            {LANDING_PAGE_CONSTANTS.NAVIGATION.MENU_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className='landing-header__nav-link'
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            className='landing-header__mobile-toggle'
            onClick={toggleMobileMenu}
            aria-label={
              LANDING_PAGE_CONSTANTS.NAVIGATION.MOBILE_MENU_ARIA_LABEL
            }
          >
            {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        <div
          className={`landing-header__mobile-menu ${
            isMobileMenuOpen ? 'landing-header__mobile-menu--open' : ''
          }`}
        >
          <nav className='landing-header__mobile-nav'>
            {LANDING_PAGE_CONSTANTS.NAVIGATION.MENU_ITEMS.map((item) => (
              <a
                key={`mobile-${item.label}`}
                href={item.href}
                className='landing-header__mobile-nav-link'
                onClick={closeMobileMenu}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <section id='home' className='hero'>
        <div className='hero__content'>
          <div className='hero__profile-image scroll-animate fade-in-up persist-on-scroll'>
            <img
              src={LANDING_PAGE_CONSTANTS.HERO.PROFILE_IMAGE.SRC}
              alt={LANDING_PAGE_CONSTANTS.HERO.PROFILE_IMAGE.ALT}
              className='profile-image'
            />
          </div>
          <h1 className='hero__title scroll-animate fade-in-up persist-on-scroll'>
            {LANDING_PAGE_CONSTANTS.HERO.TITLE}
          </h1>
          <p className='hero__subtitle scroll-animate fade-in-up persist-on-scroll stagger-1'>
            {LANDING_PAGE_CONSTANTS.HERO.SUBTITLE}
          </p>
          <div className='hero__cta scroll-animate fade-in-up persist-on-scroll stagger-2'>
            <a
              href={LANDING_PAGE_CONSTANTS.HERO.CTA_HREF}
              className='hero__button'
            >
              {LANDING_PAGE_CONSTANTS.HERO.CTA_TEXT} <FaArrowRight />
            </a>
          </div>
        </div>
        <div className='hero__scroll-indicator scroll-animate fade-in-up persist-on-scroll stagger-3'>
          <div className='scroll-arrow'></div>
        </div>
      </section>

      {/* Projects Section with Enhanced Layout */}
      <section id='projects' className='projects-section'>
        <div className='section-header scroll-animate fade-in-up persist-on-scroll'>
          <h2 className='section-title'>
            {LANDING_PAGE_CONSTANTS.PROJECTS.SECTION_TITLE}
          </h2>
          <p className='section-subtitle'>
            {LANDING_PAGE_CONSTANTS.PROJECTS.SECTION_SUBTITLE}
          </p>
        </div>

        <div className='projects-container'>
          {/* Habit Tracker Project */}
          <div className='project-card scroll-animate fade-in-up'>
            <div className='project-card__image'>
              <img
                src={LANDING_PAGE_CONSTANTS.PROJECTS.HABIT_TRACKER.IMAGE.SRC}
                alt={LANDING_PAGE_CONSTANTS.PROJECTS.HABIT_TRACKER.IMAGE.ALT}
                loading='lazy'
              />
            </div>
            <div className='project-card__content'>
              <h3 className='project-card__title'>
                {LANDING_PAGE_CONSTANTS.PROJECTS.HABIT_TRACKER.TITLE}
              </h3>
              <div className='project-card__tech-tags'>
                {LANDING_PAGE_CONSTANTS.PROJECTS.HABIT_TRACKER.TECH_TAGS.map(
                  (tag, index) => (
                    <span key={index} className='tech-tag'>
                      {tag}
                    </span>
                  )
                )}
              </div>
              <p className='project-card__description'>
                {
                  LANDING_PAGE_CONSTANTS.PROJECTS.HABIT_TRACKER.DESCRIPTION
                    .PARAGRAPH_1
                }
              </p>
              <p className='project-card__description'>
                {
                  LANDING_PAGE_CONSTANTS.PROJECTS.HABIT_TRACKER.DESCRIPTION
                    .PARAGRAPH_2
                }
              </p>
              <div className='project-card__actions'>
                <a
                  href={
                    LANDING_PAGE_CONSTANTS.PROJECTS.HABIT_TRACKER.ACTIONS
                      .PRIMARY.HREF
                  }
                  className='btn btn--primary'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  {
                    LANDING_PAGE_CONSTANTS.PROJECTS.HABIT_TRACKER.ACTIONS
                      .PRIMARY.TEXT
                  }
                  <FaArrowRight />
                </a>
                <a
                  href={
                    LANDING_PAGE_CONSTANTS.PROJECTS.HABIT_TRACKER.ACTIONS
                      .SECONDARY.HREF
                  }
                  className='btn btn--secondary'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <FaGithub />
                  {
                    LANDING_PAGE_CONSTANTS.PROJECTS.HABIT_TRACKER.ACTIONS
                      .SECONDARY.TEXT
                  }
                </a>
              </div>
            </div>
          </div>

          {/* Gaussian Visualizer Project */}
          <div className='project-card scroll-animate fade-in-up'>
            <div className='project-card__image'>
              <img
                src={
                  LANDING_PAGE_CONSTANTS.PROJECTS.GAUSSIAN_VISUALIZER.IMAGE.SRC
                }
                alt={
                  LANDING_PAGE_CONSTANTS.PROJECTS.GAUSSIAN_VISUALIZER.IMAGE.ALT
                }
                loading='lazy'
              />
            </div>
            <div className='project-card__content'>
              <h3 className='project-card__title'>
                {LANDING_PAGE_CONSTANTS.PROJECTS.GAUSSIAN_VISUALIZER.TITLE}
              </h3>
              <div className='project-card__tech-tags'>
                {LANDING_PAGE_CONSTANTS.PROJECTS.GAUSSIAN_VISUALIZER.TECH_TAGS.map(
                  (tag, index) => (
                    <span key={index} className='tech-tag'>
                      {tag}
                    </span>
                  )
                )}
              </div>
              <p className='project-card__description'>
                {
                  LANDING_PAGE_CONSTANTS.PROJECTS.GAUSSIAN_VISUALIZER
                    .DESCRIPTION.PARAGRAPH_1
                }
              </p>
              <p className='project-card__description'>
                {
                  LANDING_PAGE_CONSTANTS.PROJECTS.GAUSSIAN_VISUALIZER
                    .DESCRIPTION.PARAGRAPH_2
                }
              </p>
              <div className='project-card__actions'>
                <Link
                  to={
                    LANDING_PAGE_CONSTANTS.PROJECTS.GAUSSIAN_VISUALIZER.ACTIONS
                      .PRIMARY.HREF
                  }
                  className='btn btn--primary'
                >
                  {
                    LANDING_PAGE_CONSTANTS.PROJECTS.GAUSSIAN_VISUALIZER.ACTIONS
                      .PRIMARY.TEXT
                  }
                  <FaArrowRight />
                </Link>
                <a
                  href={
                    LANDING_PAGE_CONSTANTS.PROJECTS.GAUSSIAN_VISUALIZER.ACTIONS
                      .SECONDARY.HREF
                  }
                  className='btn btn--secondary'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <FaGithub />
                  {
                    LANDING_PAGE_CONSTANTS.PROJECTS.GAUSSIAN_VISUALIZER.ACTIONS
                      .SECONDARY.TEXT
                  }
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Skills Section */}
      <section id='skills' className='skills-section'>
        <div className='section-header scroll-animate fade-in-up persist-on-scroll'>
          <h2 className='section-title'>
            {LANDING_PAGE_CONSTANTS.SKILLS.SECTION_TITLE}
          </h2>
          <p className='section-subtitle'>
            {LANDING_PAGE_CONSTANTS.SKILLS.SECTION_SUBTITLE}
          </p>
        </div>

        <div className='skills-grid'>
          {/* Skills Categories */}
          {LANDING_PAGE_CONSTANTS.SKILLS.CATEGORIES.map((category, index) => (
            <div
              key={index}
              className='skill-category scroll-animate slide-in-up'
              style={{ animationDelay: `${0.1 + index * 0.1}s` }}
            >
              <div className='skill-category__header'>
                <div className='skill-category__icon'>{category.ICON}</div>
                <h3 className='skill-category__title'>{category.TITLE}</h3>
                <p className='skill-category__subtitle'>
                  {category.DESCRIPTION}
                </p>
                <p className='skill-category__highlight'>
                  {category.HIGHLIGHT}
                </p>
              </div>
              <div className='skill-category__technologies'>
                {category.TECHNOLOGIES.map((tech, techIndex) => (
                  <span
                    key={techIndex}
                    className={`tech-badge tech-badge--${
                      index === 0
                        ? 'frontend'
                        : index === 1
                        ? 'backend'
                        : 'devops'
                    }`}
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Achievements Section */}
        <div className='achievements-section scroll-animate fade-in-up'>
          <h3 className='achievements-title scroll-animate zoom-in'>
            Key Achievements & Recognition
          </h3>
          <div className='achievements-grid'>
            {LANDING_PAGE_CONSTANTS.SKILLS.ACHIEVEMENTS.map(
              (achievement, index) => (
                <div
                  key={index}
                  className='achievement-card scroll-animate scale-in-center'
                  style={{ animationDelay: `${0.2 + index * 0.15}s` }}
                >
                  <div className='achievement-card__header'>
                    <div
                      className='achievement-card__icon scroll-animate bounce-in'
                      style={{ animationDelay: `${0.3 + index * 0.15}s` }}
                    >
                      {achievement.ICON}
                    </div>
                    <div className='achievement-card__info'>
                      <h4
                        className='achievement-card__title scroll-animate fade-in-right'
                        style={{ animationDelay: `${0.35 + index * 0.15}s` }}
                      >
                        {achievement.TITLE}
                      </h4>
                      <p
                        className='achievement-card__subtitle scroll-animate fade-in-right'
                        style={{ animationDelay: `${0.4 + index * 0.15}s` }}
                      >
                        {achievement.SUBTITLE}
                      </p>
                    </div>
                  </div>

                  <p
                    className='achievement-card__description scroll-animate fade-in-up'
                    style={{ animationDelay: `${0.45 + index * 0.15}s` }}
                  >
                    {achievement.DESCRIPTION}
                  </p>

                  {'IMAGES' in achievement &&
                    achievement.IMAGES &&
                    achievement.IMAGES.length > 0 && (
                      <div
                        className='achievement-card__certificates scroll-animate fade-in-up'
                        style={{ animationDelay: `${0.5 + index * 0.15}s` }}
                      >
                        <div className='certificates-header'>
                          <span className='certificates-label'>
                            📜 Certificates ({achievement.IMAGES.length})
                          </span>
                          <span className='certificates-hint'>
                            Click to view full size
                          </span>
                        </div>

                        <div className='certificates-gallery'>
                          {achievement.IMAGES.map((image, imgIndex) => (
                            <div
                              key={imgIndex}
                              className='certificate-container scroll-animate float-in'
                              style={{
                                animationDelay: `${
                                  0.55 + index * 0.15 + imgIndex * 0.05
                                }s`,
                              }}
                            >
                              <div
                                className='certificate-wrapper'
                                onClick={() =>
                                  handleViewFile(
                                    image,
                                    achievement.TITLE,
                                    achievement.SUBTITLE
                                  )
                                }
                              >
                                <img
                                  src={image}
                                  alt={`${achievement.TITLE} certificate ${
                                    imgIndex + 1
                                  }`}
                                  className='certificate-image'
                                  loading='lazy'
                                />
                                <div className='certificate-overlay'>
                                  <div className='certificate-overlay__icon'>
                                    🔍
                                  </div>
                                  <div className='certificate-overlay__text'>
                                    View Certificate
                                  </div>
                                </div>
                              </div>
                              <div className='certificate-number'>
                                #{imgIndex + 1}
                              </div>
                            </div>
                          ))}
                        </div>

                        {achievement.IMAGES.length > 3 && (
                          <div className='certificates-more'>
                            <span className='more-indicator'>
                              +{achievement.IMAGES.length - 3} more certificates
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* Journey Section */}
      <section id='journey' className='journey-section'>
        <div className='section-header scroll-animate fade-in-up persist-on-scroll'>
          <h2 className='section-title'>
            {LANDING_PAGE_CONSTANTS.JOURNEY.SECTION_TITLE}
          </h2>
          <p className='section-subtitle'>
            {LANDING_PAGE_CONSTANTS.JOURNEY.SECTION_SUBTITLE}
          </p>
        </div>

        {/* Education Section */}
        <div className='journey-block education-block scroll-animate slide-in-left persist-on-scroll'>
          <h3
            className='journey-block__title scroll-animate zoom-in'
            style={{ animationDelay: '0.2s' }}
          >
            {LANDING_PAGE_CONSTANTS.JOURNEY.EDUCATION.TITLE}
          </h3>

          <div className='education-timeline'>
            {LANDING_PAGE_CONSTANTS.JOURNEY.EDUCATION.INSTITUTIONS.map(
              (institution, index) => (
                <div
                  key={index}
                  className='timeline-item scroll-animate slide-in-up staggered-item'
                  style={{ animationDelay: `${0.3 + index * 0.15}s` }}
                >
                  <div
                    className='timeline-item__icon scroll-animate'
                    style={{ animationDelay: `${0.5 + index * 0.15}s` }}
                  >
                    {institution.ICON}
                  </div>
                  <div className='timeline-item__content'>
                    <h4
                      className='timeline-item__title scroll-animate fade-in-right'
                      style={{ animationDelay: `${0.4 + index * 0.15}s` }}
                    >
                      {institution.DEGREE}
                    </h4>
                    {'MINOR' in institution && (
                      <p
                        className='timeline-item__minor scroll-animate fade-in-right'
                        style={{ animationDelay: `${0.45 + index * 0.15}s` }}
                      >
                        Minor: {institution.MINOR}
                      </p>
                    )}
                    <p
                      className='timeline-item__institution scroll-animate fade-in-right'
                      style={{ animationDelay: `${0.5 + index * 0.15}s` }}
                    >
                      {institution.INSTITUTION}
                    </p>
                    <div
                      className='timeline-item__meta scroll-animate fade-in-up'
                      style={{ animationDelay: `${0.55 + index * 0.15}s` }}
                    >
                      <span className='timeline-item__duration'>
                        {institution.DURATION}
                      </span>
                      {'CGPA' in institution && (
                        <span className='timeline-item__cgpa'>
                          CGPA: {institution.CGPA}
                        </span>
                      )}
                    </div>

                    {/* Certificates Section */}
                    {institution.CERTIFICATES &&
                      institution.CERTIFICATES.length > 0 && (
                        <div
                          className='timeline-item__certificates scroll-animate fade-in-up'
                          style={{ animationDelay: `${0.6 + index * 0.15}s` }}
                        >
                          <h5 className='certificates-title'>
                            Documents & Certificates
                          </h5>
                          <div className='certificates-grid'>
                            {institution.CERTIFICATES.map((cert, certIndex) => (
                              <button
                                key={certIndex}
                                className='certificate-thumbnail scroll-animate scale-in-center'
                                style={{
                                  animationDelay: `${
                                    0.65 + index * 0.15 + certIndex * 0.05
                                  }s`,
                                }}
                                onClick={() =>
                                  handleViewFile(
                                    cert,
                                    `${institution.INSTITUTION} Certificate`,
                                    institution.DEGREE
                                  )
                                }
                              >
                                <img
                                  src={cert}
                                  alt={`Certificate ${certIndex + 1}`}
                                  loading='lazy'
                                />
                                <div className='certificate-overlay'>
                                  <div className='certificate-overlay__icon'>
                                    🔍
                                  </div>
                                  <div className='certificate-overlay__text'>
                                    View Certificate
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Leadership Activities */}
          <div
            className='leadership-section scroll-animate fade-in-up'
            style={{ animationDelay: '0.8s' }}
          >
            <h4
              className='leadership-title scroll-animate slide-in-left'
              style={{ animationDelay: '0.9s' }}
            >
              Leadership & Activities
            </h4>
            <div className='leadership-grid'>
              {LANDING_PAGE_CONSTANTS.JOURNEY.EDUCATION.LEADERSHIP_ACTIVITIES.map(
                (activity, index) => (
                  <div
                    key={index}
                    className='leadership-badge scroll-animate float-in'
                    style={{ animationDelay: `${1.0 + index * 0.05}s` }}
                  >
                    {activity}
                  </div>
                )
              )}
            </div>
          </div>

          {/* College Projects */}
          <div
            className='college-projects scroll-animate fade-in-up'
            style={{ animationDelay: '1.2s' }}
          >
            <h4
              className='college-projects__title scroll-animate slide-in-left'
              style={{ animationDelay: '1.3s' }}
            >
              Key College Projects
            </h4>
            <div className='college-projects__grid'>
              {LANDING_PAGE_CONSTANTS.JOURNEY.EDUCATION.COLLEGE_PROJECTS.map(
                (project, index) => (
                  <div
                    key={index}
                    className='enhanced-project-card scroll-animate scale-in-center'
                    style={{ animationDelay: `${1.4 + index * 0.1}s` }}
                  >
                    <div className='enhanced-project-card__header'>
                      <div
                        className='project-icon-wrapper scroll-animate rotate-in'
                        style={{ animationDelay: `${1.5 + index * 0.1}s` }}
                      >
                        <span className='project-icon'>{project.ICON}</span>
                      </div>
                      <div className='project-meta'>
                        <span
                          className='project-year scroll-animate slide-in-right'
                          style={{ animationDelay: `${1.45 + index * 0.1}s` }}
                        >
                          {project.YEAR}
                        </span>
                        <span
                          className='project-complexity scroll-animate fade-in-up'
                          style={{ animationDelay: `${1.48 + index * 0.1}s` }}
                        >
                          {project.COMPLEXITY}
                        </span>
                      </div>
                    </div>

                    <div className='enhanced-project-card__content'>
                      <h5
                        className='project-title scroll-animate fade-in-up'
                        style={{ animationDelay: `${1.55 + index * 0.1}s` }}
                      >
                        {project.TITLE}
                      </h5>
                      <p
                        className='project-category scroll-animate fade-in-up'
                        style={{ animationDelay: `${1.58 + index * 0.1}s` }}
                      >
                        {project.CATEGORY}
                      </p>
                      <p
                        className='project-description scroll-animate fade-in-up'
                        style={{ animationDelay: `${1.6 + index * 0.1}s` }}
                      >
                        {project.DESCRIPTION}
                      </p>

                      <div
                        className='project-tech-stack scroll-animate fade-in-up'
                        style={{ animationDelay: `${1.65 + index * 0.1}s` }}
                      >
                        <h6 className='tech-stack-title'>Technologies</h6>
                        <div className='tech-tags'>
                          {project.TECH.map((tech, techIndex) => (
                            <span
                              key={techIndex}
                              className='tech-tag scroll-animate scale-in-center'
                              style={{
                                animationDelay: `${
                                  1.7 + index * 0.1 + techIndex * 0.02
                                }s`,
                              }}
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div
                        className='project-features scroll-animate fade-in-up'
                        style={{ animationDelay: `${1.75 + index * 0.1}s` }}
                      >
                        <h6 className='features-title'>Key Features</h6>
                        <ul className='features-list'>
                          {project.FEATURES.map((feature, featureIndex) => (
                            <li
                              key={featureIndex}
                              className='feature-item scroll-animate slide-in-left'
                              style={{
                                animationDelay: `${
                                  1.8 + index * 0.1 + featureIndex * 0.03
                                }s`,
                              }}
                            >
                              <span className='feature-bullet'>•</span>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div
                        className='project-footer scroll-animate fade-in-up'
                        style={{ animationDelay: `${1.85 + index * 0.1}s` }}
                      >
                        <div className='team-info'>
                          <span className='team-icon'>👥</span>
                          <span className='team-size'>{project.TEAM_SIZE}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Professional Section */}
        <div className='journey-block professional-block scroll-animate slide-in-right persist-on-scroll'>
          <h3
            className='journey-block__title scroll-animate zoom-in'
            style={{ animationDelay: '0.2s' }}
          >
            {LANDING_PAGE_CONSTANTS.JOURNEY.PROFESSIONAL.TITLE}
          </h3>

          <div className='professional-timeline'>
            {LANDING_PAGE_CONSTANTS.JOURNEY.PROFESSIONAL.ROLES.map(
              (role, index) => (
                <div
                  key={index}
                  className='professional-role scroll-animate slide-in-up staggered-item'
                  style={{ animationDelay: `${0.3 + index * 0.2}s` }}
                >
                  <div
                    className='role-header scroll-animate fade-in-left'
                    style={{ animationDelay: `${0.4 + index * 0.2}s` }}
                  >
                    <div
                      className='role-icon scroll-animate pulse-grow'
                      style={{ animationDelay: `${0.5 + index * 0.2}s` }}
                    >
                      {role.ICON}
                    </div>
                    <div className='role-info'>
                      <h4
                        className='role-title scroll-animate slide-in-right'
                        style={{ animationDelay: `${0.45 + index * 0.2}s` }}
                      >
                        {role.POSITION}
                      </h4>
                      <p
                        className='role-company scroll-animate slide-in-right'
                        style={{ animationDelay: `${0.5 + index * 0.2}s` }}
                      >
                        {role.COMPANY}
                      </p>
                      <p
                        className='role-duration scroll-animate slide-in-right'
                        style={{ animationDelay: `${0.55 + index * 0.2}s` }}
                      >
                        {role.DURATION}
                      </p>
                      <p
                        className='role-type scroll-animate fade-in-up'
                        style={{ animationDelay: `${0.6 + index * 0.2}s` }}
                      >
                        {role.TYPE}
                      </p>
                    </div>
                  </div>
                  <div
                    className='role-achievements scroll-animate fade-in-up'
                    style={{ animationDelay: `${0.65 + index * 0.2}s` }}
                  >
                    {role.ACHIEVEMENTS.map((achievement, achIndex) => (
                      <div
                        key={achIndex}
                        className='achievement-item scroll-animate slide-in-left'
                        style={{
                          animationDelay: `${
                            0.7 + index * 0.2 + achIndex * 0.05
                          }s`,
                        }}
                      >
                        <span
                          className='achievement-bullet scroll-animate '
                          style={{
                            animationDelay: `${
                              0.75 + index * 0.2 + achIndex * 0.05
                            }s`,
                          }}
                        >
                          ▶
                        </span>
                        <span className='achievement-text'>{achievement}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Early Experience */}
          <div
            className='early-experience scroll-animate fade-in-up'
            style={{ animationDelay: '1.2s' }}
          >
            <h4
              className='early-experience__title scroll-animate slide-in-right'
              style={{ animationDelay: '1.3s' }}
            >
              Early Experience
            </h4>
            <div className='early-experience__grid'>
              {LANDING_PAGE_CONSTANTS.JOURNEY.PROFESSIONAL.EARLY_EXPERIENCE.map(
                (exp, index) => (
                  <div
                    key={index}
                    className='early-exp-card scroll-animate scale-in-center'
                    style={{ animationDelay: `${1.4 + index * 0.1}s` }}
                  >
                    <h5
                      className='early-exp-card__company scroll-animate fade-in-down'
                      style={{ animationDelay: `${1.45 + index * 0.1}s` }}
                    >
                      {exp.COMPANY}
                    </h5>
                    <p
                      className='early-exp-card__role scroll-animate fade-in-up'
                      style={{ animationDelay: `${1.5 + index * 0.1}s` }}
                    >
                      {exp.ROLE}
                    </p>
                    <p
                      className='early-exp-card__duration scroll-animate fade-in-up'
                      style={{ animationDelay: `${1.55 + index * 0.1}s` }}
                    >
                      {exp.DURATION}
                    </p>
                    <p
                      className='early-exp-card__focus scroll-animate fade-in-up'
                      style={{ animationDelay: `${1.6 + index * 0.1}s` }}
                    >
                      {exp.FOCUS}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id='contact' className='contact-section'>
        <div className='section-header scroll-animate fade-in-up'>
          <h2 className='section-title'>
            {LANDING_PAGE_CONSTANTS.CONTACT.SECTION_TITLE}
          </h2>
          <p className='section-subtitle'>
            {LANDING_PAGE_CONSTANTS.CONTACT.SECTION_SUBTITLE}
          </p>
        </div>

        <div className='contact-content scroll-animate fade-in-up'>
          <div className='contact-methods'>
            {LANDING_PAGE_CONSTANTS.CONTACT.METHODS.map((method, index) => (
              <a
                key={index}
                href={method.HREF}
                target='_blank'
                rel='noopener noreferrer'
                className={`contact-method ${
                  method.PRIMARY ? 'contact-method--primary' : ''
                } scroll-animate slide-in-up`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className='contact-method__icon'>{method.ICON}</div>
                <h4 className='contact-method__type'>{method.TYPE}</h4>
                <p className='contact-method__value'>{method.VALUE}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* File Viewer Modal */}
      <FileViewerModal
        src={modalData?.src || ''}
        title={modalData?.title || ''}
        subtitle={modalData?.subtitle || ''}
        isOpen={!!modalData}
        onClose={handleCloseModal}
        alt={`${modalData?.title || ''} certificate`}
        showOpenInNewTab={true}
      />
    </div>
  );
};

export default LandingPage;
