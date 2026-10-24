import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Enterprise Workspace & Asset Management System',
  description:
    'Hệ thống quản lý không gian làm việc doanh nghiệp tích hợp Redis Distributed Lock, BullMQ Message Queue và Gemini AI Assistant.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
