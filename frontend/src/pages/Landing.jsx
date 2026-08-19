import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicLayout } from '@components/layout/PublicLayout';
import { Button, Field, Input, Spinner, Stat } from '@components/ui';
import { BellIcon, BookIcon, CalendarIcon, CartIcon, CardIcon, ChartIcon, ChatIcon, ClockIcon, CrownIcon, GraduationIcon, MicIcon, MusicNoteIcon, PhoneIcon, PinIcon, TargetIcon, UserIcon } from '@components/icons';
import { api } from '../services/apiClient';
import { useApp } from '../context/AppContext';
import { homePath } from '@app/utils/avatar';
import reviews from '@data/reviews.json';
const PKG_IMG = {
    beginner: '/img/pkg-desk.jpg',
    pro: '/img/pkg-stage.jpg',
    master: '/img/pkg-studio.jpg',
};
function localized(value, language) {
    if (value && typeof value === 'object') {
        return value[language] ?? value.th ?? value.en ?? '';
    }
    return value ?? '';
}
export default function Landing() {
    const navigate = useNavigate();
    const { language, t, toast, user } = useApp();
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
    return (<PublicLayout>
      {/* ===== Hero ===== */}
      <section className="hero">
        <div className="hero-orb" aria-hidden="true"/>
        <div className="hero-arch" aria-hidden="true"/>
        <div className="hero-staff" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <MusicNoteIcon className="sn s1"/>
          <MusicNoteIcon className="sn s2"/>
        </div>
        <div className="hero-notes" aria-hidden="true">
          <MusicNoteIcon className="hn n1"/>
          <MusicNoteIcon className="hn n2"/>
          <MusicNoteIcon className="hn n3"/>
          <MusicNoteIcon className="hn n4"/>
          <MusicNoteIcon className="hn n5"/>
        </div>
        <div className="wrap hero-center reveal">
          <div className="hero-orn" aria-hidden="true">
            <i />
            <svg viewBox="0 0 24 24" width={10} height={10} fill="currentColor">
              <path d="M12 2l10 10-10 10L2 12z"/>
            </svg>
            <i />
          </div>
          <div className="tagline">{t('landing.tagline')}</div>
          <h1>
            {t('landing.heroBefore')} <em>ครูแอร์</em>
            <br />
            {t('landing.heroAfter')}
          </h1>
          <p>
            {t('landing.heroBody')}
          </p>
          <div className="cta">
            <Button pink onClick={() => navigate(user?.role === 'student' ? '/app/booking' : user ? homePath(user) : '/register')}>
              <MicIcon width={17} height={17}/> {user?.role === 'student' ? t('nav.booking') : t('landing.startNow')}
            </Button>
            <Button ghost onClick={() => document.getElementById('pkg')?.scrollIntoView({ behavior: 'smooth' })}>
              {t('landing.viewPackages')}
            </Button>
          </div>
          <div className="stats">
            <Stat value="120+" label={t('landing.students')}/>
            <i className="stats-line" aria-hidden="true"/>
            <Stat value="2,400+" label={t('landing.hoursTaught')}/>
            <i className="stats-line" aria-hidden="true"/>
            <Stat value="5.0 ★" label={t('landing.reviewScore')}/>
          </div>
        </div>
      </section>

      {/* ===== แพ็กเกจ ===== */}
      <section className="sec" id="pkg">
        <div className="wrap">
          <div className="sec-h reveal">
            <span className="k">PACKAGES</span>
            <h2>{t('landing.packagesTitle')}</h2>
            <p>{t('landing.packagesSub')}</p>
          </div>

          {pkgs === null ? (<Spinner />) : (<div className="grid cols-3" style={{ marginBottom: 18 }}>
              {pkgs.map((p, i) => (<div key={p.id} className={`pkg reveal d${i + 1} ${p.id === 'pro' ? 'popular' : ''}`}>
                  {p.tag && (<div className="crown">
                      <CrownIcon width={13} height={13}/> {p.tag}
                    </div>)}
                  <div className="top">
                    <img src={PKG_IMG[p.id]} alt={p.name} loading="lazy"/>
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

      {/* ===== วิธีเรียน ===== */}
      <section className="sec alt" id="how">
        <div className="wrap">
          <div className="sec-h reveal">
            <span className="k">HOW IT WORKS</span>
            <h2>{t('landing.howTitle')}</h2>
          </div>
          <div className="grid cols-4">
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

      {/* ===== ทำไมต้องเรา ===== */}
      <section className="sec" id="why">
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
                <div className="ic">{ic}</div>
                <div>
                  <h4>{title}</h4>
                  <p>{d}</p>
                </div>
              </div>))}
          </div>
        </div>
      </section>

      {/* ===== พบกับครูแอร์ ===== */}
      <section className="sec teacher" id="teacher">
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

      {/* ===== รีวิว ===== */}
      <section className="sec alt" id="rev">
        <div className="wrap">
          <div className="sec-h reveal">
            <span className="k">REVIEWS</span>
            <h2>{t('landing.reviewsTitle')}</h2>
          </div>
          <div className="grid cols-3">
            {reviews.map((review, i) => (<div className={`card rev reveal d${i + 1}`} key={review.name}>
                <div className="stars">★★★★★</div>
                <p>"{localized(review.quote, language)}"</p>
                <div className="who">
                  <div className="ava">
                    <img src={review.photo} alt={review.name} loading="lazy"/>
                  </div>
                  <div>
                    <b>{review.name}</b>
                    <span>{localized(review.detail, language)}</span>
                  </div>
                </div>
              </div>))}
          </div>
        </div>
      </section>

      {/* ===== ฟังก์ชันหลักของระบบ ===== */}
      <section className="sec alt" id="features">
        <div className="wrap">
          <div className="sec-h reveal">
            <span className="k">SYSTEM FEATURES</span>
            <h2>{t('landing.featuresTitle')}</h2>
            <p>{t('landing.featuresSub')}</p>
          </div>
          <div className="grid cols-3">
            {[
            [<UserIcon key="u"/>, t('landing.feat1Title'), t('landing.feat1Body')],
            [<CartIcon key="c"/>, t('landing.feat2Title'), t('landing.feat2Body')],
            [<CardIcon key="cd"/>, t('landing.feat3Title'), t('landing.feat3Body')],
            [<CalendarIcon key="ca"/>, t('landing.feat4Title'), t('landing.feat4Body')],
            [<BellIcon key="b"/>, t('landing.feat5Title'), t('landing.feat5Body')],
            [<BookIcon key="bk"/>, t('landing.feat6Title'), t('landing.feat6Body')],
        ].map(([ic, title, d], i) => (<div className={`card feat reveal d${i + 1}`} key={i}>
                <div className="ic">{ic}</div>
                <div>
                  <h4>{title}</h4>
                  <p>{d}</p>
                </div>
              </div>))}
          </div>
        </div>
      </section>




      {/* ===== ติดต่อ ===== */}
      <section className="sec contact-section" id="contact">
        <div className="wrap">
          <div className="sec-h reveal">
            <span className="k">CONTACT</span>
            <h2>{t('landing.contactTitle')}</h2>
            <p>{t('landing.contactSub')}</p>
          </div>

          {/* Big CTA cards */}
          <div className="contact-cards reveal">
            <div className="cc-item" onClick={() => toast(t('landing.toastLine'))}>
              <div className="cc-icon green">
                <ChatIcon width={28} height={28}/>
              </div>
              <div className="cc-info">
                <b>LINE Official</b>
                <span>@kruaersinging</span>
              </div>
              <div className="cc-arrow">→</div>
            </div>

            <div className="cc-item" onClick={() => window.open('tel:09X-XXX-XXXX')}>
              <div className="cc-icon pink">
                <PhoneIcon width={28} height={28}/>
              </div>
              <div className="cc-info">
                <b>{t('landing.phone')}</b>
                <span>09X-XXX-XXXX</span>
              </div>
              <div className="cc-arrow">→</div>
            </div>

            <div className="cc-item" onClick={() => toast(t('landing.toastMaps'))}>
              <div className="cc-icon wine">
                <PinIcon width={28} height={28}/>
              </div>
              <div className="cc-info">
                <b>{t('landing.studio')}</b>
                <span>{t('landing.studioAddr')}</span>
              </div>
              <div className="cc-arrow">→</div>
            </div>

            <div className="cc-item">
              <div className="cc-icon violet">
                <ClockIcon width={28} height={28}/>
              </div>
              <div className="cc-info">
                <b>{t('landing.hours')}</b>
                <span>{t('landing.hoursValue')}</span>
              </div>
            </div>
          </div>

          {/* Contact form */}
          <div className="contact-form-card reveal d2">
            <div className="cf-header">
              <h3>{t('landing.formTitle')}</h3>
              <p>{t('landing.formSub')}</p>
            </div>
            <div className="cf-form">
              <div className="two-col">
                <Field label={t('landing.formName')}>
                  <Input placeholder={t('landing.formNamePh')}/>
                </Field>
                <Field label={t('landing.formContact')}>
                  <Input placeholder={t('landing.formContactPh')}/>
                </Field>
              </div>
              <Field label={t('landing.formMessage')}>
                <textarea className="input" rows={3} placeholder={t('landing.formMessagePh')}/>
              </Field>
              <Button pink style={{ width: '100%', padding: '14px 28px' }} onClick={() => toast(t('landing.toastSent'), 'ok')}>
                <ChatIcon width={16} height={16}/> {t('landing.sendMessage')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>);
}
