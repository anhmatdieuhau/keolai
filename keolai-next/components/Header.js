"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function Header({ isArticle = false }) {
  const [scrolled, setScrolled] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const cls = [
    "header",
    scrolled ? "scrolled" : "",
    isArticle ? "article-header" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      <header className={cls} id="header">
        <div className="container">
          <div className="header-inner">
            <Link href="/" className="logo-text">KEO LAI XANH</Link>
            <nav className={`nav${navOpen ? " open" : ""}`} id="nav">
              <Link href="/#specs" className="nav-link" onClick={() => setNavOpen(false)}>Sản phẩm</Link>
              <Link href="/#pricing" className="nav-link" onClick={() => setNavOpen(false)}>Bảng giá</Link>
              <Link href="/#knowledge" className="nav-link" onClick={() => setNavOpen(false)}>Kiến thức</Link>
              <Link href="/#faq" className="nav-link" onClick={() => setNavOpen(false)}>Hỏi đáp</Link>
            </nav>
            <a href="tel:0907282960" className="header-phone">0907 282 960</a>
            <button className="menu-toggle" aria-label="Menu" onClick={() => setNavOpen(!navOpen)}>
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>
      {navOpen && <div className="nav-overlay active" onClick={() => setNavOpen(false)} />}
    </>
  );
}
