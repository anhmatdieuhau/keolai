import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SocialFloat from "@/components/SocialFloat";
import ExitPopup from "@/components/ExitPopup";
import Script from "next/script";

const font = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL("https://keolaigiamhom.vn"),
  title: {
    default: "Keo Lai Giâm Hom — Giống Cây Lâm Nghiệp Chất Lượng Cao | Keo Lai Xanh",
    template: "%s | Keo Lai Xanh",
  },
  description: "Vườn ươm chuyên giâm đọt Keo lai AH1 — ươm 2-3 tháng, hệ thống phun sương tự động, tỷ lệ sống trên 95%. Giao cây tận vườn toàn quốc.",
  keywords: ["keo lai", "giâm hom", "cây giống lâm nghiệp", "trồng rừng", "AH1", "vườn ươm"],
  openGraph: {
    locale: "vi_VN",
    type: "website",
    siteName: "Keo Lai Xanh",
    title: "Keo Lai Giâm Hom — Giống Cây Lâm Nghiệp Chất Lượng Cao | Keo Lai Xanh",
    description: "Vườn ươm chuyên giâm đọt Keo lai AH1 — ươm 2-3 tháng, hệ thống phun sương tự động, tỷ lệ sống trên 95%. Giao cây tận vườn toàn quốc.",
    images: [
      {
        url: "https://keolaigiamhom.vn/images/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Vườn ươm Keo Lai Xanh — giâm hom keo lai AH1",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Keo Lai Giâm Hom — Giống Cây Lâm Nghiệp Chất Lượng Cao | Keo Lai Xanh",
    description: "Vườn ươm chuyên giâm đọt Keo lai AH1 — ươm 2-3 tháng, hệ thống phun sương tự động, tỷ lệ sống trên 95%. Giao cây tận vườn toàn quốc.",
    images: ["https://keolaigiamhom.vn/images/og-default.jpg"],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://keolaigiamhom.vn" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={font.className} data-scroll-behavior="smooth">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-CT8B2E0YF0"
          strategy="afterInteractive"
        />
        <Script id="ga4" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-CT8B2E0YF0');`}
        </Script>
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "w1778a2drp");`}
        </Script>
        <Script id="facebook-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', 'YOUR_FB_PIXEL_ID'); // Replace with actual Pixel ID
          fbq('track', 'PageView');`}
        </Script>
        <Script id="error-monitoring" strategy="afterInteractive">
          {`window.addEventListener('error', function(e) {
            if (typeof window.gtag === 'function') {
              window.gtag('event', 'exception', {
                description: e.message || 'Unknown error',
                fatal: true
              });
            }
          });
          window.addEventListener('unhandledrejection', function(e) {
            if (typeof window.gtag === 'function') {
              window.gtag('event', 'exception', {
                description: e.reason ? e.reason.toString() : 'Unhandled Promise Rejection',
                fatal: true
              });
            }
          });`}
        </Script>
      </head>
      <body>
        <Header />
        {children}
        <Footer />
        <SocialFloat />
        <ExitPopup />
      </body>
    </html>
  );
}
