export const metadata = {
  title: 'KeoLai Operations Portal',
  robots: { index: false, follow: false },
}

export default function PortalLayout({ children }) {
  // Portal has its own full-screen layout, no public header/footer
  return <>{children}</>
}
