export function SectionDivider() {
    return (
      <div className="sec-divider" aria-hidden="true">
        <span className="sec-divider-line"/>
        <span className="sec-divider-star">
          <svg viewBox="0 0 64 64" width={18} height={18} fill="none">
            <path
              fill="currentColor"
              d="M32 4 36.8 22.4 55.2 17.6 40.8 32 55.2 46.4 36.8 41.6 32 60 27.2 41.6 8.8 46.4 23.2 32 8.8 17.6 27.2 22.4z"
            />
          </svg>
        </span>
        <span className="sec-divider-line"/>
      </div>
    );
}
