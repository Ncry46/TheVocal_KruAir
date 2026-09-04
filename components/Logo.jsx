import { useCallback, useState } from 'react';

const LOGO_PNG = '/img/vocality-logo.png';
const LOGO_SVG = '/img/vocality-logo.svg';

export function BrandStarIcon({ size = 24 }) {
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} fill="none" aria-hidden="true">
        <path
          fill="currentColor"
          d="M32 4 36.8 22.4 55.2 17.6 40.8 32 55.2 46.4 36.8 41.6 32 60 27.2 41.6 8.8 46.4 23.2 32 8.8 17.6 27.2 22.4z"
        />
      </svg>
    );
}

function resolveLogoSrc(preferImage) {
    if (!preferImage) {
        return null;
    }
    return LOGO_PNG;
}

export function LogoMark({ size = 46, light = false, className = '', style, preferImage = false }) {
    const [src, setSrc] = useState(() => resolveLogoSrc(preferImage));
    const [failed, setFailed] = useState(false);

    const onError = useCallback(() => {
        if (src === LOGO_PNG) {
            setSrc(LOGO_SVG);
            return;
        }
        setFailed(true);
    }, [src]);

    const showImage = src && !failed;

    return (
      <div
        className={`logo ${light ? 'light' : ''} ${className}`}
        style={{ width: size, height: size, ...style }}
      >
        {showImage ? (
          <img
            src={src}
            alt=""
            className="logo-img"
            onError={onError}
            draggable={false}
          />
        ) : (
          <BrandStarIcon size={Math.round(size * 0.52)} />
        )}
      </div>
    );
}

export function Logo({
    size = 46,
    light = false,
    name = 'VOCALITY',
    academy = 'ACADEMY',
    by = 'BY KRU AIR',
    showText = true,
    stacked = false,
    preferImage = false,
    onClick,
    className = '',
    style,
}) {
    return (
      <div
        className={`brand ${stacked ? 'stacked' : ''} ${light ? 'light' : ''} ${className}`}
        onClick={onClick}
        style={style}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick(event);
            }
        } : undefined}
      >
        <LogoMark size={size} light={light} preferImage={preferImage} />
        {showText && (
          <div className="bt">
            <b className="bt-name">{name}</b>
            <div className="bt-subrow">
              <span className="bt-academy">{academy}</span>
              <span className="bt-by">{by}</span>
            </div>
          </div>
        )}
      </div>
    );
}