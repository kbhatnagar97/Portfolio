import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { lockScroll, scrollToHash } from '../smooth';
import { PROFILE } from '../data';

const LINKS = [
  { href: '#skills', label: 'Skills' },
  { href: '#work', label: 'Work' },
  { href: '#journey', label: 'Journey' },
  { href: '#process', label: 'Process' },
  { href: '#contact', label: 'Contact' },
];

const Nav = () => {
  const [active, setActive] = useState('');
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const progress = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sections = LINKS.map((l) => document.querySelector(l.href)).filter((el): el is Element => !!el);
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(`#${e.target.id}`)),
      { rootMargin: '-45% 0px -50% 0px' },
    );
    sections.forEach((s) => io.observe(s));

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      if (progress.current) progress.current.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
      setScrolled(scrollY > 40);
      if (scrollY < innerHeight * 0.5) setActive('');
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      io.disconnect();
      removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    lockScroll(true);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', onKey);
    return () => {
      lockScroll(false);
      removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    // unlock before scrolling: a stopped Lenis ignores scrollTo
    lockScroll(false);
    setOpen(false);
    scrollToHash(href);
  };

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''} ${open ? 'nav--open' : ''}`}>
      <div className='nav__progress' ref={progress} aria-hidden='true' />
      <a href='#top' className='nav__mark' onClick={(e) => go(e, '#top')} aria-label={`${PROFILE.name}, back to top`}>
        <span className='nav__logo'>KB</span>
        <span className='nav__name'>{PROFILE.name}</span>
      </a>
      <nav className='nav__links' aria-label='Sections'>
        {LINKS.map((l, i) => (
          <a key={l.href} href={l.href} onClick={(e) => go(e, l.href)} className={active === l.href ? 'is-active' : ''} aria-current={active === l.href ? 'true' : undefined}>
            <span className='nav__num'>0{i + 1}</span>
            {l.label}
          </a>
        ))}
      </nav>
      <a className='nav__cta' href={`mailto:${PROFILE.email}`}>
        Say hello
      </a>
      <button type='button' className='nav__menu' aria-expanded={open} aria-controls='mobile-menu' onClick={() => setOpen((o) => !o)}>
        <span className='sr-only'>{open ? 'Close menu' : 'Open menu'}</span>
        <span aria-hidden='true' />
        <span aria-hidden='true' />
      </button>
      <div id='mobile-menu' className='nav__sheet' data-lenis-prevent hidden={!open}>
        {LINKS.map((l, i) => (
          <a key={l.href} href={l.href} onClick={(e) => go(e, l.href)}>
            <span className='nav__num'>0{i + 1}</span>
            {l.label}
          </a>
        ))}
        <a href={`mailto:${PROFILE.email}`} className='nav__sheet-mail'>
          {PROFILE.email}
        </a>
      </div>
    </header>
  );
};

export default Nav;
