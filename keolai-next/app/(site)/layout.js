import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SocialFloat from "@/components/SocialFloat";
import ExitPopup from "@/components/ExitPopup";

export default function SiteLayout({ children }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
      <SocialFloat />
      <ExitPopup />
    </>
  );
}
