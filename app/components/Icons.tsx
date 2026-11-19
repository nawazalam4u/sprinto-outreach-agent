// Small stroke icon set (inline SVG, inherits currentColor).
type P = { className?: string };
const S = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const IGlobe = (p: P) => (<S {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.8 2.5 15.2 0 18M12 3c-2.5 2.8-2.5 15.2 0 18" /></S>);
export const IDoc = (p: P) => (<S {...p}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></S>);
export const ITarget = (p: P) => (<S {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></S>);
export const IUser = (p: P) => (<S {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></S>);
export const ISpark = (p: P) => (<S {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></S>);
export const IPen = (p: P) => (<S {...p}><path d="M4 20l4-1 11-11-3-3L5 16z" /><path d="M14 6l3 3" /></S>);
export const ISend = (p: P) => (<S {...p}><path d="M21 3 10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></S>);
export const IShield = (p: P) => (<S {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></S>);
export const ITrophy = (p: P) => (<S {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4" /></S>);
export const IBolt = (p: P) => (<S {...p}><path d="M13 3 4 14h7l-1 7 9-11h-7z" /></S>);
export const IEye = (p: P) => (<S {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></S>);
export const IClock = (p: P) => (<S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>);
export const ICheck = (p: P) => (<S {...p}><path d="M5 12l5 5 9-10" /></S>);
export const IX = (p: P) => (<S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>);
export const IFlag = (p: P) => (<S {...p}><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></S>);
export const ISearch = (p: P) => (<S {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></S>);
export const IGrid = (p: P) => (<S {...p}><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></S>);
export const IHome = (p: P) => (<S {...p}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></S>);
export const IPlay = (p: P) => (<S {...p}><path d="M7 4l13 8-13 8z" /></S>);
export const ICols = (p: P) => (<S {...p}><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></S>);
export const IBook = (p: P) => (<S {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5M9 7h6" /></S>);
export const ILoop = (p: P) => (<S {...p}><path d="M4 12a8 8 0 0 1 14-5.3L20 9" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-14 5.3L4 15" /><path d="M4 20v-5h5" /></S>);
export const ILock = (p: P) => (<S {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></S>);
export const IStar = (p: P) => (<S {...p}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></S>);
export const IMail = (p: P) => (<S {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></S>);
export const IAlert = (p: P) => (<S {...p}><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></S>);

export const STEP_ICONS = [IGlobe, IDoc, ITarget, IUser, ISpark, IPen, ISend];
