import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicLayout } from '@components/layout/PublicLayout';
import { Button, Spinner } from '@components/ui';
import { BellIcon, CalendarIcon, CardIcon, ChartIcon, CrownIcon, GraduationIcon, MicIcon, MusicNoteIcon, PinIcon, TargetIcon } from '@components/icons';
import { SectionDivider } from '@components/SectionDivider';
import { api } from '../services/apiClient';
import { useApp } from '../context/AppContext';
import { dashboardPath } from '@app/utils/avatar';
const PKG_IMG = {
    beginner: '/img/pkg-desk.jpg',
    pro: '/img/pkg-stage.jpg',
    master: '/img/pkg-studio.jpg',
    single: '/img/pkg-studio.jpg',
};
function packageImage(id) {
    return PKG_IMG[id] || '/img/pkg-studio.jpg';
}
function CountStat({ end, suffix = '', decimals = 0, label }) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) {
            setValue(end);
            return undefined;
        }
        let frame = 0;
        const started = performance.now();
        const tick = (now) => {
            const t = Math.min(1, (now - started) / 1400);
            const eased = 1 - ((1 - t) ** 3);
            setValue(end * eased);
            if (t < 1) {
                frame = requestAnimationFrame(tick);
            }
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [end]);
    const shown = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();
    return (
      <div>
        <div className="v">{shown}{suffix}</div>
        <div className="l">{label}</div>
      </div>
    );
}
export default function Landing() {
    const navigate = useNavigate();
    const { language, t, user } = useApp();
    const [pkgs, setPkgs] = useState(null);
    useEffect(() => {
        api.getPackages().then(setPkgs).catch(() => setPkgs([]));
    }, [language]);
    useEffect(() => {
        const id = window.location.hash.replace('#', '');
        if (!id) {
            return;
        }
        const timer = window.setTimeout(() => {
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        }, 80);
        return () => window.clearTimeout(timer);
    }, [pkgs]);
    /* scroll-reveal animation */
    useEffect(() => {
        const els = Array.from(document.querySelectorAll('.reveal'));
        if (!('IntersectionObserver' in window)) {
            els.forEach((el) => el.classList.add('in'));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) {
                    e.target.classList.add('in');
                    io.unobserve(e.target);
                }
            });
        }, { threshold: 0.12 });
        els.forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, [pkgs]);
    useEffect(() => {
        const hero = document.querySelector('.hero');
        if (!hero) {
            return undefined;
        }
        const onMove = (event) => {
            const box = hero.getBoundingClientRect();
            hero.style.setProperty('--mx', String((event.clientX - box.left) / box.width - 0.5));
            hero.style.setProperty('--my', String((event.clientY - box.top) / box.height - 0.5));
            hero.style.setProperty('--lx', `${((event.clientX - box.left) / box.width) * 100}%`);
            hero.style.setProperty('--ly', `${((event.clientY - box.top) / box.height) * 100}%`);
        };
        const onLeave = () => {
            hero.style.setProperty('--mx', '0');
            hero.style.setProperty('--my', '0');
            hero.style.setProperty('--lx', '50%');
            hero.style.setProperty('--ly', '32%');
        };
        hero.addEventListener('mousemove', onMove);
        hero.addEventListener('mouseleave', onLeave);
        return () => {
            hero.removeEventListener('mousemove', onMove);
            hero.removeEventListener('mouseleave', onLeave);
        };
    }, []);
    return (<PublicLayout>
      {/* ===== Hero ===== */}
      <section className="hero">
        <div className="hero-wash" aria-hidden="true"/>
        <div className="hero-glow g1" aria-hidden="true"/>
        <div className="hero-glow g2" aria-hidden="true"/>
        <div className="hero-glow g3" aria-hidden="true"/>
        <div className="hero-glow g4" aria-hidden="true"/>
        <div className="hero-spot" aria-hidden="true"/>
        <div className="hero-halo" aria-hidden="true"/>
        <div className="hero-mesh" aria-hidden="true"/>
        <div className="hero-arch" aria-hidden="true"/>
        <div className="hero-arch inner" aria-hidden="true"/>
        <div className="hero-flare" aria-hidden="true"/>
        <div className="hero-grain" aria-hidden="true"/>
        <div className="hero-notes" aria-hidden="true">
          <span className="hn-wrap n1"><MusicNoteIcon className="hn"/></span>
          <span className="hn-wrap n2"><MusicNoteIcon className="hn"/></span>
          <span className="hn-wrap n3"><MusicNoteIcon className="hn"/></span>
          <span className="hn-wrap n4"><MusicNoteIcon className="hn"/></span>
          <span className="hn-wrap n5"><MusicNoteIcon className="hn"/></span>
          <span className="hn-wrap n6"><MusicNoteIcon className="hn"/></span>
          <i className="hero-spark s1"/>
          <i className="hero-spark s2"/>
          <i className="hero-spark s3"/>
          <i className="hero-spark s4"/>
          <i className="hero-spark s5"/>
          <i className="hero-spark s6"/>
        </div>
        <div className="hero-staff" aria-hidden="true">
          <i /><i /><i /><i /><i />
          <MusicNoteIcon className="sn s1"/>
          <MusicNoteIcon className="sn s2"/>
          <MusicNoteIcon className="sn s3"/>
        </div>
        <div className="wrap hero-split reveal">
          <div className="hero-copy">
            <div className="hero-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 64 64" width={28} height={28} fill="none">
                <path fill="currentColor" d="M32 4 36.8 22.4 55.2 17.6 40.8 32 55.2 46.4 36.8 41.6 32 60 27.2 41.6 8.8 46.4 23.2 32 8.8 17.6 27.2 22.4z"/>
              </svg>
            </div>
            <div className="tagline">{t('landing.tagline')}</div>
            <h1>
              <span className="hero-display">{t('brand.name')}</span>
              <span className="hero-lead">{t('landing.heroLine1')}</span>
              <span className="hero-lead accent">{t('landing.heroLine2')}</span>
            </h1>
            <p>{t('landing.heroBody')}</p>
            <div className="cta">
              <Button pink onClick={() => navigate(user?.role === 'student' ? '/app/booking' : user ? dashboardPath(user) : '/register')}>
                <MicIcon width={17} height={17}/> {user?.role === 'student' ? t('nav.booking') : t('landing.startNow')}
              </Button>
              <Button ghost onClick={() => document.getElementById('pkg')?.scrollIntoView({ behavior: 'smooth' })}>
                {t('landing.viewPackages')}
              </Button>
            </div>
            <div className="stats">
              <CountStat end={120} suffix="+" label={t('landing.students')}/>
              <i className="stats-line" aria-hidden="true"/>
              <CountStat end={2400} suffix="+" label={t('landing.hoursTaught')}/>
              <i className="stats-line" aria-hidden="true"/>
              <CountStat end={5} decimals={1} suffix=" ★" label={t('landing.reviewScore')}/>
            </div>
          </div>
          <div className="hero-visual reveal d2">
            <div className="hero-frame">
              <img src="/img/hero-stage.jpg" alt={t('landing.heroImageAlt')} loading="eager"/>
              <div className="hero-caption">
                <MusicNoteIcon width={14} height={14}/>
                {t('landing.heroCaption')}
              </div>
              <div className="hero-frame-glow" aria-hidden="true"/>
            </div>
          </div>
        </div>
      </section>

      <div className="trust-strip" aria-hidden="true">
        <div className="trust-track">
          {[...(Array.isArray(t('landing.trustStrip')) ? t('landing.trustStrip') : []), ...(Array.isArray(t('landing.trustStrip')) ? t('landing.trustStrip') : [])].map((item, index) => (
            <span key={`${item}-${index}`} className="trust-item">
              <svg viewBox="0 0 64 64" width={10} height={10} fill="none" aria-hidden="true">
                <path fill="currentColor" d="M32 4 36.8 22.4 55.2 17.6 40.8 32 55.2 46.4 36.8 41.6 32 60 27.2 41.6 8.8 46.4 23.2 32 8.8 17.6 27.2 22.4z"/>
              </svg>
              {item}
            </span>
          ))}
        </div>
      </div>

      <SectionDivider />

      {/* ===== แพ็กเกจ ===== */}
      <section className="sec sec-pkg" id="pkg">
        <div className="sec-bg-deco" aria-hidden="true"/>
        <div className="wrap">
          <div className="sec-h reveal">
            <span className="k">PACKAGES</span>
            <h2>{t('landing.packagesTitle')}</h2>
            <p>{t('landing.packagesSub')}</p>
          </div>

          {pkgs === null ? (<Spinner />) : (
            <div
              className={
                pkgs.length === 1 ? 'pkg-showcase'
                  : pkgs.length === 2 ? 'pkg-grid-duo'
                    : 'grid cols-3'
              }
              style={{ marginBottom: 18 }}
            >
              {pkgs.map((p, i) => (<div key={p.id} className={`pkg reveal d${i + 1} ${p.id === 'pro' ? 'popular' : ''}`}>
                  {p.tag && (<div className="crown">
                      <CrownIcon width={13} height={13}/> {p.tag}
                    </div>)}
                  <div className="top">
                    <img src={packageImage(p.id)} alt={p.name} loading="lazy"/>
                    <span className="top-em">
                      <MusicNoteIcon width={24} height={24}/>
                    </span>
                  </div>
                  <div className="body">
                    <div className="nm">{p.name}</div>
                    <div className="hrs">
                      {p.hours} <small>{t('landing.hoursUnit')}</small>
                    </div>
                    <div className="price">฿{p.price.toLocaleString()}</div>
                    <div className="per">{p.note}</div>
                    <Button pink onClick={() => navigate(user?.role === 'student' ? `/app/packages?pkg=${p.id}` : '/register')}>
                      {t('landing.buyThis')}
                    </Button>
                  </div>
                </div>))}
            </div>)}

          <div className="termbox reveal">
            <b>
              <PinIcon width={14} height={14}/> {t('landing.termsTitle')}
            </b>{' '}
            {t('landing.termsBody')}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ===== วิธีเรียน ===== */}
      <section className="sec alt sec-how" id="how">
        <div className="sec-bg-deco reverse" aria-hidden="true"/>
        <div className="wrap">
          <div className="sec-h reveal">
            <span className="k">HOW IT WORKS</span>
            <h2>{t('landing.howTitle')}</h2>
          </div>
          <div className="step-track grid cols-4">
            {[
            ['1', t('landing.step1Title'), t('landing.step1Body')],
            ['2', t('landing.step2Title'), t('landing.step2Body')],
            ['3', t('landing.step3Title'), t('landing.step3Body')],
            ['4', t('landing.step4Title'), t('landing.step4Body')],
        ].map(([n, title, d], i) => (<div className={`step reveal d${i + 1}`} key={i}>
                <div className="n">{n}</div>
                <h4>{title}</h4>
                <p>{d}</p>
              </div>))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ===== ทำไมต้องเรา ===== */}
      <section className="sec sec-why" id="why">
        <div className="wrap">
          <div className="sec-h reveal">
            <span className="k">WHY US</span>
            <h2>{t('landing.whyTitle')}</h2>
          </div>
          <div className="grid cols-3">
            {[
            [<GraduationIcon key="g"/>, t('landing.why1Title'), t('landing.why1Body')],
            [<TargetIcon key="t"/>, t('landing.why2Title'), t('landing.why2Body')],
            [<CalendarIcon key="c"/>, t('landing.why3Title'), t('landing.why3Body')],
            [<CardIcon key="cc"/>, t('landing.why4Title'), t('landing.why4Body')],
            [<BellIcon key="b"/>, t('landing.why5Title'), t('landing.why5Body')],
            [<ChartIcon key="ch"/>, t('landing.why6Title'), t('landing.why6Body')],
        ].map(([ic, title, d], i) => (<div className={`card feat reveal d${i + 1}`} key={i}>
                <span className="feat-num">{String(i + 1).padStart(2, '0')}</span>
                <div className="ic">{ic}</div>
                <div>
                  <h4>{title}</h4>
                  <p>{d}</p>
                </div>
              </div>))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ===== พบกับครูแอร์ ===== */}
      <section className="sec alt teacher" id="teacher">
        <div className="wrap teacher-grid">
          <div className="teacher-photo reveal d1">
            <img src="/img/teacher-studio.jpg" alt="สตูดิโอของครูแอร์" loading="lazy"/>
            <div className="teacher-tag">
              <MicIcon width={15} height={15}/> {t('landing.teacherTag')}
            </div>
          </div>
          <div className="teacher-info reveal d2">
            <span className="k">MEET YOUR TEACHER</span>
            <h2>{t('landing.teacherTitle')}</h2>
            <p>
              {t('landing.teacherBody')}
            </p>
            <div className="tlist">
              <div>{t('landing.teacher1')}</div>
              <div>{t('landing.teacher2')}</div>
              <div>{t('landing.teacher3')}</div>
              <div>{t('landing.teacher4')}</div>
            </div>
            <Button pink onClick={() => navigate('/register')}>{t('landing.startWithTeacher')}</Button>
          </div>
        </div>
      </section>
    </PublicLayout>);
}
