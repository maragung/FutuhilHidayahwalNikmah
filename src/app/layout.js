import './globals.css';

export const metadata = {
  title: 'TPQ Futuhil Hidayah Wal Hikmah',
  description: 'Sistem Manajemen TPQ Futuhil Hidayah Wal Hikmah - Santri Qiroati',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
