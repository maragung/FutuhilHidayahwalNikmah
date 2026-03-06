import './globals.css';

export const metadata = {
  title: 'TPQ Futuhil Hidayah Wal Hikmah',
  description: 'Sistem Manajemen TPQ Futuhil Hidayah Wal Hikmah - Santri Qiroati',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
