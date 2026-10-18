import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return <main className="auth-page"><div className="auth-wrap"><div className="auth-logo"><Image src="/branding/krishiunnati-logo.png" alt="KrishiUnnati logo" width={1017} height={182} priority /></div><section className="auth-card"><p className="eyebrow">EMPOWERING FARMERS THROUGH TECHNOLOGY</p><h1>Crop help, in your language.</h1><p>Tell us what is happening in your field. KrishiUnnati will help you understand what to check and what to do next.</p><div className="devanagari-tag">किसान की बात, किसान की भाषा में</div><Link className="primary-button" href="/login">Get started <span aria-hidden="true">→</span></Link><p className="helper">Voice, photo screening, and weather guidance in one simple conversation.</p></section><p className="footer-brand">कृषि उन्नति · Grow with understanding</p></div></main>;
}
